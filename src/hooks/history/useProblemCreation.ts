import { useCallback } from "react";
import { useNavigate } from "react-router";
import { CapturedItem, UrlGroup } from "../../types";
import { useAuth } from "../useAuth";
import api from "../useApi";

export interface ProblemCreationData {
  quizCount: number;
  quizTypes: string[];
}

export function useProblemCreation(
  setUrlGroups: (groups: UrlGroup[]) => void,
  setCreatingProblemsUrls: React.Dispatch<React.SetStateAction<{ [url: string]: boolean }>>
) {
  const navigate = useNavigate();
  const { authToken } = useAuth();

  // 문제 생성 모달 열기 전 처리
  const handleCreateProblem = useCallback(
    (group: UrlGroup) => {
      if (group.problemId) {
        navigate(`/problem/${group.problemId}`);
        return null;
      }

      if (!group.summaryId) {
        alert("먼저 요약을 생성해주세요.");
        return null;
      }

      return {
        group,
        // 대표 아이템으로 첫 번째 아이템 사용
        representativeItem: group.items.length > 0 ? group.items[0] : null,
      };
    },
    [navigate]
  );

  // 문제 생성 모달 제출 처리
  const handleProblemModalSubmit = useCallback(
    async (
      data: ProblemCreationData,
      selectedItemForProblem: CapturedItem | null,
      selectedGroupInfo: { url: string; title: string } | null
    ) => {
      if (!selectedItemForProblem || !authToken || !selectedGroupInfo) {
        alert("인증 토큰이 없거나 선택된 그룹이 없습니다.");
        return;
      }

      const pageUrl = selectedItemForProblem.pageUrl;
      setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: true }));

      try {
        // 현재 URL 그룹 찾기
        const currentData = await chrome.storage.local.get(["urlGroups"]);
        const currentGroups = (currentData.urlGroups || []) as UrlGroup[];
        const currentGroup = currentGroups.find((g) => g.url === pageUrl);

        if (!currentGroup || !currentGroup.summaryId) {
          alert("요약 정보를 찾을 수 없습니다. 먼저 요약을 생성해주세요.");
          setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
          return;
        }

        // API 호출하여 문제 생성
        const { data: result } = await api.post(`/quiz/${currentGroup.summaryId}`, {
          quizCount: data.quizCount,
          quizTypes: data.quizTypes,
        });

        if (result.success) {
          const problemId = currentGroup.summaryId;

          // 그룹 업데이트
          const updatedGroups = currentGroups.map((group) => {
            if (group.url === pageUrl) {
              return {
                ...group,
                problemId,
              };
            }
            return group;
          });

          // 저장
          await chrome.storage.local.set({
            urlGroups: updatedGroups,
          });

          // 컴포넌트 상태 업데이트
          setUrlGroups(updatedGroups);
        } else if (result.errorCode === "QUIZ400") {
          alert(
            `${selectedItemForProblem.pageTitle} \n문제 생성 중 오류가 발생했습니다. \nMemozy는 현재 IT&개발자에 관련된 내용만 취급하고 있습니다.`
          );
        } else {
          alert(result.errorMsg);
        }
      } catch (error) {
        console.error("문제 생성 오류:", error);
        alert("문제 생성 중 오류가 발생했습니다.");
      } finally {
        setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
      }
    },
    [authToken, setCreatingProblemsUrls, setUrlGroups]
  );

  return {
    handleCreateProblem,
    handleProblemModalSubmit,
  };
}
