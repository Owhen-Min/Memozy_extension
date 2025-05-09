import { useState, useCallback } from "react";
import { UrlGroup, CapturedItem } from "../../types";
import { useNavigate } from "react-router";
import { useAuth } from "../useAuth";

export function useHistoryUI() {
  const navigate = useNavigate();
  const { authToken } = useAuth();

  // 그룹 확장/축소 상태 관리
  const [expandedGroups, setExpandedGroups] = useState<string>("");

  // 그룹 접기/펼치기 토글 함수
  const toggleGroup = useCallback((url: string) => {
    setExpandedGroups((prev) => (prev === url ? "" : url));
  }, []);

  // 로딩 상태를 위한 플래그들
  const [summarizingUrls, setSummarizingUrls] = useState<{ [url: string]: boolean }>({});
  const [creatingProblemsUrls, setCreatingProblemsUrls] = useState<{ [url: string]: boolean }>({});

  // 모달 상태 관리
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // 그룹 정보 및 선택된 아이템 상태 관리
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [selectedItemGroupForSummary, setSelectedItemGroupForSummary] = useState<CapturedItem[]>(
    []
  );
  const [selectedItemForProblem, setSelectedItemForProblem] = useState<CapturedItem | null>(null);

  // 요약 생성 모달 열기
  const openSummaryModal = useCallback(
    (group: UrlGroup, getFilteredItemsInGroup: (group: UrlGroup) => CapturedItem[]) => {
      if (!authToken) {
        alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
        return;
      }

      // 이미 요약이 있는 경우 바로 이동
      if (group.summaryId) {
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

      setSelectedItemGroupForSummary(summarizableItems);
      setSelectedGroupInfo({ url: group.url, title: group.title });
      setIsSummaryModalOpen(true);
    },
    [authToken, navigate]
  );

  // 문제 생성 모달 열기
  const openProblemModal = useCallback(
    (group: UrlGroup) => {
      if (group.problemId) {
        navigate(`/problem/${group.problemId}`);
        return;
      }

      if (!group.summaryId) {
        alert("먼저 요약을 생성해주세요.");
        return;
      }

      // 대표 아이템으로 첫 번째 아이템 사용
      setSelectedItemForProblem(group.items.length > 0 ? group.items[0] : null);
      setSelectedGroupInfo({ url: group.url, title: group.title });
      setIsProblemModalOpen(true);
    },
    [navigate]
  );

  // 모달 닫기
  const closeSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(false);
    setSelectedItemGroupForSummary([]);
    setSelectedGroupInfo(null);
  }, []);

  const closeProblemModal = useCallback(() => {
    setIsProblemModalOpen(false);
    setSelectedItemForProblem(null);
    setSelectedGroupInfo(null);
  }, []);

  return {
    // 그룹 확장/축소 상태
    expandedGroups,
    toggleGroup,

    // 로딩 상태 플래그
    summarizingUrls,
    setSummarizingUrls,
    creatingProblemsUrls,
    setCreatingProblemsUrls,

    // 모달 상태
    isProblemModalOpen,
    setIsProblemModalOpen,
    isSummaryModalOpen,
    setIsSummaryModalOpen,

    // 선택된 아이템/그룹 정보
    selectedGroupInfo,
    setSelectedGroupInfo,
    selectedItemGroupForSummary,
    setSelectedItemGroupForSummary,
    selectedItemForProblem,
    setSelectedItemForProblem,

    // 모달 관련 함수
    openSummaryModal,
    openProblemModal,
    closeSummaryModal,
    closeProblemModal,
  };
}
