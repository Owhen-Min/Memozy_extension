import { useCallback } from "react";
import { CapturedItem, UrlGroup } from "../../types";
import customTurndown from "../../lib/turndown/customTurndown";

export function useHistoryItems(urlGroups: UrlGroup[], setUrlGroups: (groups: UrlGroup[]) => void) {
  // 모든 아이템 삭제 처리
  const handleDeleteAll = useCallback(async () => {
    if (window.confirm("모든 캡처 아이템을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      try {
        // urlGroups는 유지하되 각 그룹의 items 배열만 비우기
        const currentData = await chrome.storage.local.get(["urlGroups"]);
        const currentGroups = (currentData.urlGroups || []) as UrlGroup[];

        const preservedGroups = currentGroups.map((group) => ({
          ...group,
          items: [], // 아이템은 비우고 그룹 정보는 유지
        }));

        await chrome.storage.local.set({
          savedItems: [],
          urlGroups: preservedGroups,
        });
      } catch (error) {
        console.error("모든 아이템 삭제 오류:", error);
        alert("모든 아이템 삭제 중 오류가 발생했습니다.");
      }
    }
  }, []);

  // URL별 아이템 삭제 처리
  const handleDeleteUrlGroup = useCallback(
    async (pageUrl: string) => {
      const group = urlGroups.find((g) => g.url === pageUrl);
      if (!group) return;

      if (
        window.confirm(
          `'${group.title}' 그룹의 모든 내용을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
        )
      ) {
        try {
          // 현재 데이터 가져오기
          const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
          const currentItems = (currentData.savedItems || []) as CapturedItem[];
          const currentGroups = (currentData.urlGroups || []) as UrlGroup[];

          // 아이템 필터링
          const updatedItems = currentItems.filter((item) => item.pageUrl !== pageUrl);

          // 그룹 업데이트 - 요약과 문제 정보는 유지하고 아이템만 비우기
          const updatedGroups = currentGroups.map((group) => {
            if (group.url === pageUrl) {
              return {
                ...group,
                items: [], // 아이템은 비우고 그룹 정보는 유지
              };
            }
            return group;
          });

          // 저장
          await chrome.storage.local.set({
            savedItems: updatedItems,
            urlGroups: updatedGroups,
          });
        } catch (error) {
          console.error("그룹 삭제 오류:", error);
          alert("그룹 삭제 중 오류가 발생했습니다.");
        }
      }
    },
    [urlGroups]
  );

  // 아이템 삭제 처리
  const handleDelete = useCallback(async (itemId: number) => {
    try {
      // 현재 데이터 가져오기
      const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      const currentItems = (currentData.savedItems || []) as CapturedItem[];
      const currentGroups = (currentData.urlGroups || []) as UrlGroup[];

      // 삭제할 아이템 찾기
      const itemToDelete = currentItems.find((item) => item.id === itemId);
      if (!itemToDelete) return;

      // 아이템 삭제
      const updatedItems = currentItems.filter((item) => item.id !== itemId);

      // 그룹 데이터 업데이트 - 그룹 정보 유지하면서 해당 아이템만 제거
      const updatedGroups = currentGroups.map((group) => {
        if (group.url === itemToDelete.pageUrl) {
          return {
            ...group,
            items: group.items.filter((item) => item.id !== itemId),
          };
        }
        return group;
      });

      // 저장
      await chrome.storage.local.set({
        savedItems: updatedItems,
        urlGroups: updatedGroups,
      });
    } catch (error) {
      console.error("아이템 삭제 오류:", error);
      alert("아이템 삭제 중 오류가 발생했습니다.");
    }
  }, []);

  // 아이템 다운로드 처리
  const handleDownload = useCallback(async (item: CapturedItem) => {
    console.log("handleDownload called with item:", item);
    try {
      let markdownContent: string | undefined = undefined;
      const turndownService = customTurndown();

      // Convert HTML to Markdown for text/html types
      if (item.type === "text" && typeof item.content === "string") {
        try {
          markdownContent = turndownService.turndown(item.content);
        } catch (conversionError) {
          console.error("HTML to Markdown 변환 오류:", conversionError);
          alert("Markdown 변환 중 오류가 발생했습니다.");
          return; // Stop download if conversion fails
        }
      } else if (item.type !== "image") {
        // Handle cases where content is not a string for text/html
        console.warn("다운로드할 텍스트/HTML 콘텐츠가 문자열이 아닙니다:", item);
        markdownContent = `# ${
          item.pageTitle || "제목 없음"
        }\n\n콘텐츠를 Markdown으로 변환할 수 없습니다.`;
      }

      // Send message to background script
      const messagePayload: any = {
        action: "downloadItem",
        item: item,
      };

      // Include markdownContent only if it was generated
      if (markdownContent !== undefined) {
        messagePayload.markdownContent = markdownContent;
      }

      const response = await chrome.runtime.sendMessage(messagePayload);

      if (!response || !response.success) {
        console.error("다운로드 실패:", response?.error || "알 수 없는 오류");
        const errorMessage =
          response?.error === "Markdown 콘텐츠 누락 또는 잘못된 타입"
            ? "Markdown 변환 데이터가 없어 다운로드할 수 없습니다."
            : response?.error || "알 수 없는 오류";
        alert(`다운로드 실패: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("다운로드 요청 오류:", error);
      if (error.message?.includes("Extension context invalidated")) {
        alert(
          "다운로드 실패: 확장 프로그램 컨텍스트 오류. 페이지를 새로고침하거나 확장 프로그램을 다시 로드해보세요."
        );
      } else {
        alert(`다운로드 요청 오류: ${error.message || error}`);
      }
    }
  }, []);

  // 아이템 수정 처리
  const handleEdit = useCallback(async (item: CapturedItem, newContent: string) => {
    try {
      // 현재 데이터 가져오기
      const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      const currentItems = (currentData.savedItems || []) as CapturedItem[];
      const currentGroups = (currentData.urlGroups || []) as UrlGroup[];

      // 아이템 수정
      const updatedItems = currentItems.map((savedItem) =>
        savedItem.id === item.id ? { ...savedItem, content: newContent } : savedItem
      );

      // 그룹 내 아이템 수정
      const updatedGroups = currentGroups.map((group) => {
        const updatedGroupItems = group.items.map((groupItem) =>
          groupItem.id === item.id ? { ...groupItem, content: newContent } : groupItem
        );

        return { ...group, items: updatedGroupItems };
      });

      // 저장
      await chrome.storage.local.set({
        savedItems: updatedItems,
        urlGroups: updatedGroups,
      });
    } catch (error) {
      console.error("아이템 수정 오류:", error);
      alert("아이템 수정 중 오류가 발생했습니다.");
    }
  }, []);

  return {
    handleDeleteAll,
    handleDeleteUrlGroup,
    handleDelete,
    handleDownload,
    handleEdit,
  };
}
