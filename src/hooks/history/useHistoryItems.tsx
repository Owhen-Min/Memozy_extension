import { useCallback } from "react";
import { CapturedItem, UrlGroup } from "../../types";
import customTurndown from "../../lib/turndown/customTurndown";
import showdown from "showdown";
import { useModal } from "../../context/ModalContext";

export function useHistoryItems(urlGroups: UrlGroup[], userEmail: string | null) {
  const { openModal, closeModal } = useModal();
  // Showdown 컨버터 설정
  const converter = new showdown.Converter({
    tables: true,
    tasklists: true,
    emoji: true,
    openLinksInNewWindow: true,
  });

  const deleteAllfunction = async () => {
    try {
      const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      const allItems = (currentData.savedItems || []) as CapturedItem[];
      const allGroups = (currentData.urlGroups || []) as UrlGroup[];

      // 현재 사용자의 아이템만 필터링하여 삭제
      const remainingItems = allItems.filter((item) => item.userEmail !== userEmail);

      // 현재 사용자의 그룹은 아이템을 비우고, 다른 사용자 그룹은 유지
      const updatedGroups = allGroups
        .map((group) => {
          if (group.userEmail === userEmail) {
            return { ...group, items: [] };
          }
          return group;
        })
        .filter((group) => group.userEmail !== userEmail || group.items.length > 0); // 현재 사용자의 빈 그룹은 제거하거나, 필요시 유지

      await chrome.storage.local.set({
        savedItems: remainingItems,
        urlGroups: updatedGroups,
      });
      closeModal();
    } catch (error) {
      alert("모든 아이템 삭제 중 오류가 발생했습니다.");
      closeModal();
    }
  };

  // 모든 아이템 삭제 처리 (현재 사용자의 것만)
  const handleDeleteAll = useCallback(async () => {
    if (!userEmail) {
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-pre-bold text-center mb-4">
            로그인 정보가 없어 모든 항목을 삭제할 수 없습니다.
          </h1>
        </div>,
        { closeable: true }
      );
      return;
    }
    openModal(
      <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
        <h1 className="text-xl font-pre-bold text-center mb-4">
          현재 사용자의 모든 캡처들을 삭제하시겠습니까?
          <br />이 작업은 되돌릴 수 없습니다.
        </h1>
        <div className="flex grid grid-cols-2 gap-4">
          <button
            className="bg-red-500 text-white text-lg px-4 py-2 rounded-md cursor-pointer"
            onClick={deleteAllfunction}
          >
            확인
          </button>
          <button
            className="bg-gray-500 text-white text-lg px-4 py-2 rounded-md cursor-pointer"
            onClick={() => {
              closeModal();
            }}
          >
            취소
          </button>
        </div>
      </div>,
      { closeable: true }
    );
  }, [userEmail]);

  const deleteUrlGroupfunction = async (pageUrl: string) => {
    try {
      const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      const allItems = (currentData.savedItems || []) as CapturedItem[];
      const allGroups = (currentData.urlGroups || []) as UrlGroup[];

      // 현재 사용자의 해당 URL 아이템만 필터링하여 삭제
      const remainingItems = allItems.filter(
        (item) => !(item.pageUrl === pageUrl && item.userEmail === userEmail)
      );

      // 해당 그룹의 아이템을 비우거나 그룹 자체를 제거 (현재 사용자 그룹만 해당)
      const updatedGroups = allGroups.map((group) => {
        if (group.url === pageUrl && group.userEmail === userEmail) {
          return { ...group, items: [] }; // 아이템만 비움
        }
        return group;
      });

      await chrome.storage.local.set({
        savedItems: remainingItems,
        urlGroups: updatedGroups,
      });
      closeModal();
    } catch (error) {
      alert("그룹 삭제 중 오류가 발생했습니다.");
      closeModal();
    }
  };

  // URL별 아이템 삭제 처리 (현재 사용자의 그룹만)
  const handleDeleteUrlGroup = useCallback(
    async (pageUrl: string) => {
      if (!userEmail) {
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">
              로그인 정보가 없어 그룹을 삭제할 수 없습니다.
            </h1>
          </div>,
          { closeable: true }
        );
        return;
      }
      const groupToDelete = urlGroups.find((g) => g.url === pageUrl && g.userEmail === userEmail);
      if (!groupToDelete) {
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">
              삭제할 그룹을 찾을 수 없거나 다른 사용자의 그룹입니다.
            </h1>
          </div>,
          { closeable: true }
        );
        return;
      }
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-bold text-center mb-4">
            {groupToDelete.title} <br />
            그룹의 모든 내용을 삭제하시겠습니까?
          </h1>
          <div className="flex grid grid-cols-2 gap-4">
            <button
              className="bg-red-500 text-white text-lg px-4 py-2 rounded-md cursor-pointer"
              onClick={() => {
                deleteUrlGroupfunction(groupToDelete.url);
              }}
            >
              확인
            </button>
            <button
              className="bg-gray-500 text-white text-lg px-4 py-2 rounded-md cursor-pointer"
              onClick={() => {
                closeModal();
              }}
            >
              취소
            </button>
          </div>
        </div>,
        { closeable: true }
      );
    },
    [urlGroups, userEmail]
  );

  // 아이템 삭제 처리 (현재 사용자의 아이템만)
  const handleDelete = useCallback(
    async (itemId: number) => {
      if (!userEmail) {
        alert("로그인 정보가 없어 아이템을 삭제할 수 없습니다.");
        return;
      }

      try {
        // 1) 현재 저장된 데이터 조회
        const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
        const allItems = (currentData.savedItems || []) as CapturedItem[];
        const allGroups = (currentData.urlGroups || []) as UrlGroup[];

        // 2) 삭제 대상 아이템 찾기
        const itemToDelete = allItems.find(
          (item) => item.id === itemId && item.userEmail === userEmail
        );
        if (!itemToDelete) {
          alert("삭제할 아이템을 찾을 수 없거나 다른 사용자의 아이템입니다.");
          return;
        }

        // 3) savedItems에서 필터링
        const updatedItems = allItems.filter(
          (item) => !(item.id === itemId && item.userEmail === userEmail)
        );

        // 4) urlGroups 중 해당 그룹만 업데이트
        const groupIndex = allGroups.findIndex(
          (g) => g.userEmail === userEmail && g.url === itemToDelete.pageUrl
        );

        // 변경될 키만 담을 객체
        const changes: Record<string, any> = {
          savedItems: updatedItems,
        };

        if (groupIndex !== -1) {
          const targetGroup = allGroups[groupIndex];
          const filteredItems = targetGroup.items.filter((item) => item.id !== itemId);

          // 빈 그룹이면서 summaryId가 없으면 제거, 아니면 items만 교체
          let updatedGroups: UrlGroup[];
          if (filteredItems.length === 0 && !targetGroup.summaryId) {
            updatedGroups = [...allGroups.slice(0, groupIndex), ...allGroups.slice(groupIndex + 1)];
          } else {
            updatedGroups = [...allGroups];
            updatedGroups[groupIndex] = {
              ...targetGroup,
              items: filteredItems,
            };
          }

          // 5) 실제로 변경됐는지 간단 비교
          const lengthChanged = updatedGroups.length !== allGroups.length;
          const itemsCountChanged =
            !lengthChanged &&
            updatedGroups.some((g, i) => g.items.length !== allGroups[i].items.length);

          if (lengthChanged || itemsCountChanged) {
            changes.urlGroups = updatedGroups;
          }
        }

        // 6) 변경된 키만 storage에 set
        await chrome.storage.local.set(changes);
      } catch (error) {
        console.error("아이템 삭제 오류 (현재 사용자):", error);
        alert("아이템 삭제 중 오류가 발생했습니다.");
      }
    },
    [userEmail]
  );

  // 아이템 다운로드 처리
  const handleDownload = useCallback(async (item: CapturedItem) => {
    try {
      let markdownContent: string | undefined = undefined;
      const turndownService = customTurndown();

      // Convert HTML to Markdown for text/html types
      if (item.type === "text" && typeof item.content === "string") {
        if (item.markdownContent) {
          markdownContent = item.markdownContent;
        } else {
          try {
            markdownContent = turndownService.turndown(item.content);
          } catch (conversionError) {
            console.error("HTML to Markdown 변환 오류:", conversionError);
            alert("Markdown 변환 중 오류가 발생했습니다.");
            return; // Stop download if conversion fails
          }
        }
      } else if (item.type !== "image") {
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

  // 아이템 수정 처리 (현재 사용자의 아이템만)
  const handleEdit = useCallback(
    async (itemToEdit: CapturedItem, newMarkdownContent: string) => {
      if (!userEmail || itemToEdit.userEmail !== userEmail) {
        alert("수정 권한이 없거나 다른 사용자의 아이템입니다.");
        return;
      }
      try {
        const currentData = await chrome.storage.local.get(["savedItems", "urlGroups"]);
        const allItems = (currentData.savedItems || []) as CapturedItem[];
        const allGroups = (currentData.urlGroups || []) as UrlGroup[];

        // 마크다운을 HTML로 변환
        const newHtmlContent = converter.makeHtml(newMarkdownContent);

        const updatedItems = allItems.map((savedItem) =>
          savedItem.id === itemToEdit.id && savedItem.userEmail === userEmail
            ? {
                ...savedItem,
                content: newHtmlContent, // HTML 업데이트
                markdownContent: newMarkdownContent, // 마크다운 업데이트
                userEmail,
              }
            : savedItem
        );

        const updatedGroups = allGroups.map((group) => {
          if (group.userEmail === userEmail && group.url === itemToEdit.pageUrl) {
            const updatedGroupItems = group.items.map((groupItem) =>
              groupItem.id === itemToEdit.id
                ? {
                    ...groupItem,
                    content: newHtmlContent, // HTML 업데이트
                    markdownContent: newMarkdownContent, // 마크다운 업데이트
                    userEmail,
                  }
                : groupItem
            );
            return { ...group, items: updatedGroupItems, userEmail };
          }
          return group;
        });

        await chrome.storage.local.set({
          savedItems: updatedItems,
          urlGroups: updatedGroups,
        });
      } catch (error) {
        console.error("아이템 수정 오류 (현재 사용자):", error);
        alert("아이템 수정 중 오류가 발생했습니다.");
      }
    },
    [userEmail, converter]
  );

  return {
    handleDeleteAll,
    handleDeleteUrlGroup,
    handleDelete,
    handleDownload,
    handleEdit,
  };
}
