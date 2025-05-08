import "../Global.css";
import ArrowDown from "../svgs/arrow-down.svg";
import ArrowRight from "../svgs/arrow-right.svg";
import CapturedItemCard from "./components/CapturedItemCard";
import CreateSummaryModal from "./components/CreateSummaryModal";
import CreateProblemModal, { ProblemCreationData } from "./components/CreateProblemModal";
import { CapturedItem, ItemType, UrlGroup } from "../types";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import customTurndown from "../lib/turndown/customTurndown";
import api from "../hooks/useApi";

// --- Helper functions for DOM path comparison ---

// Extracts :nth-of-type(N) value from a selector part
function extractNthOfTypeValue(selectorPart: string): number | null {
  const match = selectorPart.match(/:nth-of-type\((\d+)\)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  // Handle cases like #id or tag without nth-of-type (assume 1st)
  if (!selectorPart.includes(":nth-of-type")) {
    return 1;
  }
  return null; // Other complex selectors or errors
}

// Compares two DOM paths
function compareDomPaths(pathA: string | undefined, pathB: string | undefined): number {
  if (!pathA && !pathB) return 0; // Both missing
  if (!pathA) return 1; // A missing, B comes first
  if (!pathB) return -1; // B missing, A comes first

  const partsA = pathA.split(" > ");
  const partsB = pathB.split(" > ");
  const len = Math.min(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    if (partsA[i] === partsB[i]) continue; // Same part, check next level

    // Parts differ, try comparing nth-of-type
    const nthA = extractNthOfTypeValue(partsA[i]);
    const nthB = extractNthOfTypeValue(partsB[i]);

    if (nthA !== null && nthB !== null && nthA !== nthB) {
      return nthA - nthB; // Compare based on N value
    }

    // If nth-of-type is same or not comparable,
    // consider them structurally different at this level.
    // We could fall back to alphabetical sort of the differing part
    // or just treat as equal for now to avoid overcomplication.
    // For simplicity, returning 0 here might group unrelated siblings.
    // Let's try alphabetical comparison as a fallback.
    return partsA[i].localeCompare(partsB[i]);
  }

  // One path is a prefix of the other (parent/child)
  // Shorter path (parent) comes first
  return partsA.length - partsB.length;
}

// --- End Helper functions ---

export default function History() {
  const { isAuthenticated, authLoading, login, authToken } = useAuth();
  const [urlGroups, setUrlGroups] = useState<UrlGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string>("");
  const [summarizingUrls, setSummarizingUrls] = useState<{
    [url: string]: boolean;
  }>({});
  const [creatingProblemsUrls, setCreatingProblemsUrls] = useState<{
    [url: string]: boolean;
  }>({});
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
  const [selectedItemForProblem, setSelectedItemForProblem] = useState<CapturedItem | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedItemGroupForSummary, setSelectedItemGroupForSummary] = useState<CapturedItem[]>(
    []
  );
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const navigate = useNavigate();

  // Instantiate TurndownService and apply plugins
  const turndownService = customTurndown();

  // 아이템을 URL 그룹으로 변환하는 함수
  const organizeItemsIntoUrlGroups = (items: CapturedItem[]): UrlGroup[] => {
    // 그룹화 로직
    const groupsByUrl: { [url: string]: UrlGroup } = {};

    items.forEach((item) => {
      if (!groupsByUrl[item.pageUrl]) {
        groupsByUrl[item.pageUrl] = {
          url: item.pageUrl,
          title: item.pageTitle,
          favicon: item.meta?.favicon,
          timestamp: item.timestamp,
          items: [],
          summaryId: undefined,
          summaryContent: undefined,
          summaryType: undefined,
          problemId: undefined,
        };
      }

      // 그룹의 timestamp 업데이트 (가장 최근 날짜로)
      const itemTime = new Date(item.timestamp).getTime();
      const groupTime = new Date(groupsByUrl[item.pageUrl].timestamp).getTime();
      if (itemTime > groupTime) {
        groupsByUrl[item.pageUrl].timestamp = item.timestamp;
      }

      // 아이템 추가
      groupsByUrl[item.pageUrl].items.push({ ...item });
    });

    // DOM 경로로 각 그룹 내 아이템 정렬
    Object.values(groupsByUrl).forEach((group) => {
      group.items.sort((a, b) => {
        const pathA = a.meta?.domPath;
        const pathB = b.meta?.domPath;
        return compareDomPaths(pathA, pathB);
      });
    });

    // 최신 업데이트 순으로 그룹 정렬
    return Object.values(groupsByUrl).sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // 최신순
    });
  };

  // 저장된 아이템 불러오기 함수 분리 (재사용 위해)
  const loadItems = useCallback(async () => {
    if (!isAuthenticated) {
      setUrlGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      // URL 그룹 데이터 확인
      if (result.urlGroups) {
        // 이미 새 형식으로 저장된 데이터가 있는 경우
        setUrlGroups(result.urlGroups as UrlGroup[]);
      } else {
        // 이전 형식의 데이터만 있는 경우, 변환 필요
        const items = (result.savedItems || []) as CapturedItem[];
        const groups = organizeItemsIntoUrlGroups(items);

        setUrlGroups(groups);
        // 변환된 데이터 저장
        await chrome.storage.local.set({ urlGroups: groups });
      }
    } catch (error) {
      console.error("아이템 로드/정렬 오류:", error);
      setUrlGroups([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // 인증 상태 변경 또는 초기 로드 시 아이템 로드
  useEffect(() => {
    if (!authLoading) {
      loadItems();
    }
  }, [authLoading, loadItems]);

  // 스토리지 변경 감지
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && (changes.savedItems || changes.urlGroups) && isAuthenticated) {
        console.log("저장 데이터 변경 감지 (로그인 상태), 데이터 리로드");
        loadItems();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [isAuthenticated, loadItems]);

  // 모든 아이템 삭제 처리
  const handleDeleteAll = async () => {
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
  };

  // URL별 아이템 삭제 처리
  const handleDeleteUrlGroup = async (pageUrl: string) => {
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

        setExpandedGroups(""); // 삭제 후 그룹 닫기
      } catch (error) {
        console.error("그룹 삭제 오류:", error);
        alert("그룹 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 아이템 삭제 처리
  const handleDelete = async (itemId: number) => {
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
  };

  // 아이템 다운로드 처리
  const handleDownload = async (item: CapturedItem) => {
    try {
      let markdownContent: string | undefined = undefined;

      // Convert HTML to Markdown for text/html types
      if ((item.type === "text" || item.type === "html") && typeof item.content === "string") {
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
        // Optionally provide default markdown or alert the user
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
        // Provide more specific feedback if possible
        const errorMessage =
          response?.error === "Markdown 콘텐츠 누락 또는 잘못된 타입"
            ? "Markdown 변환 데이터가 없어 다운로드할 수 없습니다."
            : response?.error || "알 수 없는 오류";
        alert(`다운로드 실패: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("다운로드 요청 오류:", error);
      // Check for specific context invalidated error
      if (error.message?.includes("Extension context invalidated")) {
        alert(
          "다운로드 실패: 확장 프로그램 컨텍스트 오류. 페이지를 새로고침하거나 확장 프로그램을 다시 로드해보세요."
        );
      } else {
        alert(`다운로드 요청 오류: ${error.message || error}`);
      }
    }
  };

  // 아이템 수정 처리
  const handleEdit = async (item: CapturedItem, newContent: string) => {
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
  };

  // 필터링된 URL 그룹
  const filteredGroups = urlGroups
    .filter((group) => {
      // 검색어 필터링
      if (searchTerm.trim() !== "") {
        const searchText = searchTerm.toLowerCase();

        // 그룹 제목, URL 검색
        if (
          group.title.toLowerCase().includes(searchText) ||
          group.url.toLowerCase().includes(searchText)
        ) {
          return true;
        }

        // 그룹 내 아이템 콘텐츠 검색
        return group.items.some((item) => {
          if (item.type === "text" && typeof item.content === "string") {
            return item.content.toLowerCase().includes(searchText);
          }
          return false;
        });
      }

      // 타입 필터링
      if (filter !== "all") {
        return group.items.some((item) => item.type === filter);
      }

      return true;
    })
    .sort((a, b) => {
      // 최신 시간순 정렬
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // 최신순
    });

  // 타입 필터링된 아이템 (그룹 내)
  const getFilteredItemsInGroup = (group: UrlGroup) => {
    if (filter === "all") return group.items;
    return group.items.filter((item) => item.type === filter);
  };

  // 그룹 접기/펼치기 토글 함수
  const toggleGroup = (url: string) => {
    setExpandedGroups((prev) => (prev === url ? "" : url));
  };

  // 요약 기능 처리 (모달 열기)
  const handleOpenSummaryModal = (group: UrlGroup) => {
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

    setSelectedItemGroupForSummary(group.items);
    setSelectedGroupInfo({ url: group.url, title: group.title });
    setIsSummaryModalOpen(true);
  };

  // 요약 모달 제출 처리
  const handleSummaryModalSubmit = async (
    selectedItems: CapturedItem[],
    summaryContent: string,
    summaryType: "markdown" | "ai",
    summaryId: string
  ) => {
    if (selectedItems.length === 0 || !selectedGroupInfo) {
      setIsSummaryModalOpen(false);
      return;
    }

    const pageUrl = selectedGroupInfo.url;
    setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: true }));
    setIsSummaryModalOpen(false);

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
    } catch (error) {
      console.error("요약 생성 오류:", error);
      alert("요약 생성 중 오류가 발생했습니다.");
    } finally {
      setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: false }));
      setSelectedItemGroupForSummary([]);
      setSelectedGroupInfo(null);
    }
  };

  // 문제 생성 기능 처리
  const handleCreateProblem = async (group: UrlGroup) => {
    if (group.problemId) {
      navigate(`/problem/${group.problemId}`);
      return;
    }

    if (!group.summaryId) {
      alert("먼저 요약을 생성해주세요.");
      return;
    }

    // 대표 아이템으로 첫 번째 아이템 사용 - 단순히 UI를 위한 것
    setSelectedItemForProblem(group.items[0]);
    // 선택된 그룹 정보 저장
    setSelectedGroupInfo({ url: group.url, title: group.title });
    setIsProblemModalOpen(true);
  };

  const handleProblemModalSubmit = async (data: ProblemCreationData) => {
    setIsProblemModalOpen(false);

    if (!selectedItemForProblem || !authToken || !selectedGroupInfo) {
      alert("인증 토큰이 없거나 선택된 그룹이 없습니다.");
      setSelectedItemForProblem(null);
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
        setSelectedItemForProblem(null);
        return;
      }

      // api 인스턴스 직접 사용
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
      setSelectedItemForProblem(null);
    }
  };

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="max-w-3xl flex flex-col h-screen items-center justify-center mx-auto bg-level1 text-black p-5">
        <h1 className="text-3xl font-bold text-level6 m-0 mb-4">Memozy</h1>
        <div className="flex items-center justify-center gap-2 text-gray">
          <div className="w-5 h-5 border-2 border-gray/20 rounded-full border-t-main animate-spin"></div>
          <span>인증 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  // 인증되지 않았을 때
  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl flex flex-col h-screen items-center justify-center mx-auto bg-level1 text-black p-5 text-center">
        <h1 className="text-3xl font-bold text-level6 m-0 mb-6">Memozy</h1>
        <p className="text-lg text-gray mb-8">
          캡처 기록을 보려면
          <br />
          먼저 로그인이 필요합니다.
        </p>
        <button
          className="bg-main text-white py-2.5 px-6 rounded flex items-center justify-center gap-1 font-medium hover:bg-blue-700 transition-all border border-blue-600"
          onClick={login}
        >
          <span>Google 계정으로 로그인</span>
        </button>
        <p className="text-sm text-gray mt-4">로그인 후 이 페이지가 자동으로 새로고침됩니다.</p>
      </div>
    );
  }

  // 인증되었고 데이터 로딩 중
  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col h-screen items-center justify-center mx-auto bg-level1 text-black p-5">
        <img src="/icon128.png" alt="Memozy" className="w-9 h-9 mb-4" />
        <h1 className="text-3xl font-bold text-level6 m-0 mb-4">Memozy</h1>
        <div className="flex items-center justify-center gap-2 text-gray">
          <div className="w-5 h-5 border-2 border-gray/20 rounded-full border-t-main animate-spin" />
          <span>캡처 기록 로드 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl @container flex flex-col h-screen mx-auto bg-level1 text-black px-5">
      <header className="flex flex-col sticky top-0 justify-between items-center bg-level1 pt-8 pb-3 border-b border-light-gray z-30 h-[160px]">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <img src="/icon128.png" alt="Memozy" className="w-9 h-9" />
            <h1 className="flex text-3xl font-bold text-level6 m-0">Memozy</h1>
          </div>
          <div className="flex gap-2.5">
            {urlGroups.length > 0 && (
              <>
                <button
                  className="flex flex-col text-xs w-14 h-13 px-1 rounded border bg-main/80 border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center"
                  onClick={() => window.open("https://memozy.site/collection")}
                  title="웹으로 이동"
                >
                  <span className="text-lg">🌐</span>
                  <span className="text-sm">웹으로</span>
                </button>
                <button
                  className="flex flex-col w-15 h-13 px-1 rounded border bg-warning/80 border-warning text-black hover:bg-error hover:text-white hover:border-error transition-all flex items-center justify-center"
                  onClick={handleDeleteAll}
                  title="모든 기록 삭제"
                >
                  <span className="text-lg">🗑️</span>
                  <span className="text-sm">전체삭제</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 필터 컨트롤 */}
        {urlGroups.length > 0 && (
          <div className="flex w-full gap-2.5 mt-4 mb-1 bg-level1 py-1 z-10">
            <select
              className="w-25 flex-shrink-0 py-2 px-3 border border-light-gray rounded bg-white text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as ItemType | "all")}
              aria-label="타입 필터"
            >
              <option value="all">모든 타입</option>
              <option value="text">텍스트</option>
              <option value="image">이미지</option>
            </select>

            <div className="flex flex-1">
              <input
                className="w-full py-2 px-3 border border-light-gray rounded text-sm"
                type="text"
                placeholder="내용, 제목, URL 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="검색"
              />
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map((group) => {
          const filteredItems = getFilteredItemsInGroup(group);
          if (filteredItems.length === 0) return null;

          return (
            <div
              key={group.url}
              className="group-container min-h-19 max-h-[calc(90vh-160px)] mb-4 bg-white rounded-lg shadow-sm border border-light-gray overflow-auto"
            >
              <div
                className="sticky top-0 z-20 flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleGroup(group.url)}
              >
                <div className="flex min-w-0 mr-2">
                  <h3
                    className="m-0 text-base font-semibold text-black flex items-center"
                    title={group.title}
                  >
                    <span className="mr-1">
                      {expandedGroups === group.url ? <ArrowDown /> : <ArrowRight />}
                    </span>
                    {group.favicon && (
                      <img
                        src={group.favicon}
                        alt="favicon"
                        className="w-5 h-5 mr-2 rounded"
                        style={{ background: "#fff", border: "1px solid #eee" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span className="line-clamp-1">{group.title}</span>
                    <span className="ml-2 text-sm font-normal text-gray flex-shrink-0">
                      ({filteredItems.length})
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className={`flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border transition-all flex items-center justify-center gap-1 ${
                      group.summaryId
                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                    } ${summarizingUrls[group.url] ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!summarizingUrls[group.url]) handleOpenSummaryModal(group);
                    }}
                    disabled={summarizingUrls[group.url]}
                    title={group.summaryId ? "요약 보기" : "요약 생성"}
                  >
                    {summarizingUrls[group.url] ? (
                      <span className="text-xs">요약중...</span>
                    ) : (
                      <>
                        <span className="text-lg">📋</span>
                        <span className="text-xs">요약</span>
                      </>
                    )}
                  </button>
                  <button
                    className={`flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border transition-all flex items-center justify-center gap-1 ${
                      group.problemId
                        ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
                        : group.summaryId && !creatingProblemsUrls[group.url]
                          ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                          : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                    } ${creatingProblemsUrls[group.url] ? "opacity-50 cursor-wait" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!creatingProblemsUrls[group.url]) handleCreateProblem(group);
                    }}
                    disabled={!group.summaryId || creatingProblemsUrls[group.url]}
                    title={
                      group.problemId
                        ? "문제 보기"
                        : !group.summaryId
                          ? "요약 후 문제 생성 가능"
                          : "문제 만들기"
                    }
                  >
                    {creatingProblemsUrls[group.url] ? (
                      <span className="text-xs">생성중...</span>
                    ) : (
                      <>
                        <span className="text-lg">📝</span>
                        <span className="text-xs">문제</span>
                      </>
                    )}
                  </button>
                  <button
                    className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer transition-all flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(group.url, "_blank");
                    }}
                    title="원본 페이지 새 탭으로 열기"
                  >
                    <span className="text-lg">🔗</span>
                    <span className="text-xs">링크</span>
                  </button>
                  <button
                    className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer transition-all flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUrlGroup(group.url);
                    }}
                    title="이 그룹의 모든 항목 삭제"
                  >
                    <span className="text-lg">🗑️</span>
                    <span className="text-xs">삭제</span>
                  </button>
                </div>
              </div>

              {expandedGroups === group.url && (
                <div className="border-t border-light-gray">
                  <div className="p-3 pt-0 space-y-3 bg-gray-50/50">
                    {filteredItems.map((item) => (
                      <CapturedItemCard
                        key={item.id}
                        item={item}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedGroupInfo && selectedItemGroupForSummary.length > 0 && (
        <CreateSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => {
            setIsSummaryModalOpen(false);
            setSelectedItemGroupForSummary([]);
            setSelectedGroupInfo(null);
          }}
          onSubmit={handleSummaryModalSubmit}
          items={selectedItemGroupForSummary}
          pageUrl={selectedGroupInfo.url}
          pageTitle={selectedGroupInfo.title}
        />
      )}

      {selectedItemForProblem && (
        <CreateProblemModal
          isOpen={isProblemModalOpen}
          onClose={() => {
            setIsProblemModalOpen(false);
            setSelectedItemForProblem(null);
          }}
          onSubmit={handleProblemModalSubmit}
          item={selectedItemForProblem}
        />
      )}
    </div>
  );
}
