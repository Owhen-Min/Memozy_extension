import { useCallback } from "react";
import { useNavigate } from "react-router";
import { CapturedItem, UrlGroup } from "../../types";
import { useAuth } from "../useAuth";

export function useSummary(
  setUrlGroups: (groups: UrlGroup[]) => void,
  setSummarizingUrls: React.Dispatch<React.SetStateAction<{ [url: string]: boolean }>>
) {
  const navigate = useNavigate();
  const { authToken } = useAuth();

  // 요약 모달을 열기 위한 함수
  const handleOpenSummaryModal = useCallback(
    (group: UrlGroup, getFilteredItemsInGroup: (group: UrlGroup) => CapturedItem[]) => {
      if (!authToken) {
        alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
        return;
      }

      // 이미 요약이 있는 경우 바로 이동
      if (group.summaryId) {
        console.log("Navigating to summaryId:", group.summaryId);
        navigate(`/summary/${group.summaryId}`);
        return;
      }

      // 필터링된 아이템 중 요약 가능한 아이템만 선택
      const summarizableItems = getFilteredItemsInGroup(group).filter(
        (item) => item.type === "text" || item.type === "image"
      );

      if (summarizableItems.length === 0) {
        alert("요약할 수 있는 아이템이 없습니다.");
        return;
      }

      return {
        items: summarizableItems,
        groupInfo: { url: group.url, title: group.title },
      };
    },
    [authToken, navigate]
  );

  // 요약 모달 제출 처리 함수
  const handleSummaryModalSubmit = useCallback(
    async (
      selectedItems: CapturedItem[],
      summaryContent: string,
      summaryType: "markdown" | "ai",
      summaryId: number,
      selectedGroupInfo: { url: string; title: string } | null
    ) => {
      if (selectedItems.length === 0 || !selectedGroupInfo) {
        return;
      }

      const pageUrl = selectedGroupInfo.url;
      setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: true }));

      try {
        // 현재 데이터 가져오기
        const currentData = await chrome.storage.local.get(["urlGroups"]);
        const currentGroups = (currentData.urlGroups || []) as UrlGroup[];

        // 그룹 데이터 업데이트
        const updatedGroups = currentGroups.map((group) => {
          if (group.url === pageUrl) {
            // 현재 URL 그룹 업데이트
            return {
              ...group,
              summaryId,
              summaryContent,
              summaryType,
            };
          }
          return group;
        });

        await chrome.storage.local.set({
          urlGroups: updatedGroups,
        });

        // 컴포넌트 상태 업데이트
        setUrlGroups(updatedGroups);
      } catch (error) {
        console.error("요약 생성 오류:", error);
        alert("요약 생성 중 오류가 발생했습니다.");
      } finally {
        setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: false }));
      }
    },
    [setSummarizingUrls, setUrlGroups]
  );

  return {
    handleOpenSummaryModal,
    handleSummaryModalSubmit,
  };
}
