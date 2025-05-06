import { useState, useEffect, useCallback } from "react";
import { CapturedItem, ItemType } from "../types";
import CapturedItemCard from "./components/CapturedItemCard";
import "../Global.css";
import { useNavigate } from "react-router-dom";
import CreateProblemModal, {
  ProblemCreationData,
} from "./components/CreateProblemModal";
import { useAuth } from "../hooks/useAuth";
import ArrowDown from "../svgs/arrow-down.svg";
import ArrowRight from "../svgs/arrow-right.svg";
import CreateSummaryModal from "./components/CreateSummaryModal";
import customTurndown from "../lib/turndown/customTurndown";

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
function compareDomPaths(
  pathA: string | undefined,
  pathB: string | undefined
): number {
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
  const [savedItems, setSavedItems] = useState<CapturedItem[]>([]);
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
  const [selectedItemForProblem, setSelectedItemForProblem] =
    useState<CapturedItem | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedItemGroupForSummary, setSelectedItemGroupForSummary] =
    useState<CapturedItem[]>([]);
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const navigate = useNavigate();

  // Instantiate TurndownService and apply plugins
  const turndownService = customTurndown();

  // 저장된 아이템 불러오기 함수 분리 (재사용 위해)
  const loadItems = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await chrome.storage.local.get(["savedItems"]);
      const items = (result.savedItems || []) as CapturedItem[];

      // Group items by URL first
      const itemsByUrl: { [url: string]: CapturedItem[] } = {};
      items.forEach((item) => {
        if (!itemsByUrl[item.pageUrl]) {
          itemsByUrl[item.pageUrl] = [];
        }
        itemsByUrl[item.pageUrl].push(item);
      });

      // Sort items within each group by DOM path, then combine
      let sortedItems: CapturedItem[] = [];
      Object.values(itemsByUrl).forEach((group) => {
        const sortedGroup = group.sort((a, b) => {
          const pathA = a.meta?.domPath;
          const pathB = b.meta?.domPath;
          if (!pathA && !pathB) return 0;
          if (!pathA) return -1;
          if (!pathB) return 1;
          return compareDomPaths(pathA, pathB);
        });
        sortedItems = sortedItems.concat(sortedGroup);
      });

      // Now sort the groups themselves by the timestamp of the *first* item in each sorted group (latest group first)
      // Or keep a fixed order based on URL if preferred. Let's sort groups by latest timestamp for now.
      const finalGroupedItems: {
        [url: string]: { title: string; items: CapturedItem[] };
      } = {};
      sortedItems.forEach((item) => {
        const url = item.pageUrl;
        if (!finalGroupedItems[url]) {
          finalGroupedItems[url] = {
            title: item.pageTitle || url,
            items: [],
          };
        }
        finalGroupedItems[url].items.push(item);
      });

      // Sort the keys (URLs) based on the timestamp of the first item in each group (latest first)
      const sortedUrls = Object.keys(finalGroupedItems).sort((urlA, urlB) => {
        const firstItemA = finalGroupedItems[urlA].items[0];
        const firstItemB = finalGroupedItems[urlB].items[0];
        const timeA = firstItemA ? new Date(firstItemA.timestamp).getTime() : 0;
        const timeB = firstItemB ? new Date(firstItemB.timestamp).getTime() : 0;
        // Handle invalid dates
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA; // Descending order (latest group first)
      });

      // Reconstruct sorted savedItems array based on sorted URL groups
      const finalSortedItems = sortedUrls.flatMap(
        (url) => finalGroupedItems[url].items
      );

      setSavedItems(finalSortedItems);
    } catch (error) {
      console.error("아이템 로드/정렬 오류:", error);
      setSavedItems([]); // 오류 시 빈 배열로 설정
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
      if (areaName === "local" && changes.savedItems && isAuthenticated) {
        console.log("savedItems 변경 감지 (로그인 상태), 데이터 리로드");
        loadItems(); // 변경된 데이터 다시 로드
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [isAuthenticated, loadItems]);

  // 아이템 삭제 처리
  const handleDelete = async (itemId: number) => {
    try {
      const currentItemsResult = await chrome.storage.local.get(["savedItems"]);
      const currentItems = (currentItemsResult.savedItems ||
        []) as CapturedItem[];
      const updatedItems = currentItems.filter((item) => item.id !== itemId);
      await chrome.storage.local.set({ savedItems: updatedItems });
    } catch (error) {
      console.error("아이템 삭제 오류:", error);
      alert("아이템 삭제 중 오류가 발생했습니다.");
    }
  };

  // 모든 아이템 삭제 처리
  const handleDeleteAll = async () => {
    if (
      window.confirm(
        "모든 캡처 아이템을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      try {
        await chrome.storage.local.set({ savedItems: [] });
      } catch (error) {
        console.error("모든 아이템 삭제 오류:", error);
        alert("모든 아이템 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // URL별 아이템 삭제 처리
  const handleDeleteUrlGroup = async (pageUrl: string) => {
    const groupTitle = groupedItemsForDisplay[pageUrl]?.title || pageUrl;
    if (
      window.confirm(
        `'${groupTitle}' 그룹의 모든 내용을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      try {
        const currentItemsResult = await chrome.storage.local.get([
          "savedItems",
        ]);
        const itemsToKeep = (currentItemsResult.savedItems || []).filter(
          (item: CapturedItem) => item.pageUrl !== pageUrl
        );
        await chrome.storage.local.set({ savedItems: itemsToKeep });
        setExpandedGroups(""); // 삭제 후 그룹 닫기
      } catch (error) {
        console.error("그룹 삭제 오류:", error);
        alert("그룹 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 아이템 다운로드 처리
  const handleDownload = async (item: CapturedItem) => {
    try {
      let markdownContent: string | undefined = undefined;

      // Convert HTML to Markdown for text/html types
      if (
        (item.type === "text" || item.type === "html") &&
        typeof item.content === "string"
      ) {
        try {
          markdownContent = turndownService.turndown(item.content);
        } catch (conversionError) {
          console.error("HTML to Markdown 변환 오류:", conversionError);
          alert("Markdown 변환 중 오류가 발생했습니다.");
          return; // Stop download if conversion fails
        }
      } else if (item.type !== "image") {
        // Handle cases where content is not a string for text/html
        console.warn(
          "다운로드할 텍스트/HTML 콘텐츠가 문자열이 아닙니다:",
          item
        );
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
      const currentItemsResult = await chrome.storage.local.get(["savedItems"]);
      const currentItems = (currentItemsResult.savedItems ||
        []) as CapturedItem[];
      const updatedItems = currentItems.map((savedItem) =>
        savedItem.id === item.id
          ? { ...savedItem, content: newContent }
          : savedItem
      );
      await chrome.storage.local.set({ savedItems: updatedItems });
    } catch (error) {
      console.error("아이템 수정 오류:", error);
      alert("아이템 수정 중 오류가 발생했습니다.");
    }
  };

  // 필터링된 아이템 (이제 savedItems는 이미 정렬된 상태)
  const filteredItems = savedItems.filter((item) => {
    // 타입 필터
    if (filter !== "all" && item.type !== filter) {
      return false;
    }

    // 검색어 필터
    if (searchTerm.trim() !== "") {
      const searchText = searchTerm.toLowerCase();

      // 텍스트 타입일 경우 내용 검색
      if (item.type === "text" && typeof item.content === "string") {
        return (
          item.content.toLowerCase().includes(searchText) ||
          item.pageTitle.toLowerCase().includes(searchText) ||
          item.pageUrl.toLowerCase().includes(searchText)
        );
      }

      // 이미지 타입일 경우 페이지 정보만 검색
      return (
        item.pageTitle.toLowerCase().includes(searchText) ||
        item.pageUrl.toLowerCase().includes(searchText)
      );
    }

    return true;
  });

  // url별로 아이템 그룹화 (for display - items within groups are already sorted)
  const groupedItemsForDisplay: {
    [url: string]: { title: string; items: CapturedItem[] };
  } = {};
  filteredItems.forEach((item) => {
    const url = item.pageUrl;
    if (!groupedItemsForDisplay[url]) {
      groupedItemsForDisplay[url] = {
        title: item.pageTitle || url,
        items: [],
      };
    }
    groupedItemsForDisplay[url].items.push(item);
  });

  // Get sorted URLs for rendering based on the original sorting (latest group first)
  // We need to respect the order derived from sorting by the first item's timestamp
  const displayOrderUrls = Object.keys(groupedItemsForDisplay).sort(
    (urlA, urlB) => {
      const firstItemTimestamp = (url: string): number => {
        const firstItem = savedItems.find((item) => item.pageUrl === url);
        if (!firstItem) return 0;
        const time = new Date(firstItem.timestamp).getTime();
        return isNaN(time) ? 0 : time;
      };
      return firstItemTimestamp(urlB) - firstItemTimestamp(urlA); // Descending
    }
  );

  // 그룹 접기/펼치기 토글 함수
  const toggleGroup = (url: string) => {
    setExpandedGroups((prev) => (prev === url ? "" : url));
  };

  // 요약 기능 처리 (모달 열기)
  const handleOpenSummaryModal = (url: string, title: string) => {
    if (!authToken) {
      alert("인증 토큰이 없습니다. 다시 로그인해주세요.");
      return;
    }

    const itemsInGroup = groupedItemsForDisplay[url]?.items;
    if (!itemsInGroup || itemsInGroup.length === 0) {
      console.warn("요약할 아이템이 없는 그룹입니다:", url);
      alert("요약할 항목이 없습니다.");
      return;
    }

    // 이미 요약이 있는 경우 바로 이동
    if (itemsInGroup[0].summaryId) {
      navigate(`/summary/${itemsInGroup[0].summaryId}`);
      return;
    }

    setSelectedItemGroupForSummary(itemsInGroup);
    setSelectedGroupInfo({ url, title });
    setIsSummaryModalOpen(true);
  };

  // 요약 모달 제출 처리
  const handleSummaryModalSubmit = async (
    selectedItems: CapturedItem[],
    summaryContent: string,
    summaryType: "markdown" | "ai",
    summaryId: string
  ) => {
    if (selectedItems.length === 0) {
      setIsSummaryModalOpen(false);
      return;
    }

    const pageUrl = selectedItems[0].pageUrl;
    setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: true }));
    setIsSummaryModalOpen(false);

    try {
      const currentItemsResult = await chrome.storage.local.get(["savedItems"]);
      const currentItems = (currentItemsResult.savedItems ||
        []) as CapturedItem[];

      // 선택된 항목들에만 summaryId 할당
      const updatedItems = currentItems.map((item) =>
        selectedItems.some((selected) => selected.id === item.id)
          ? { ...item, summaryId, summaryContent, summaryType }
          : item
      );

      await chrome.storage.local.set({ savedItems: updatedItems });
    } catch (error) {
      console.error("요약 생성 오류:", error);
      alert("요약 생성 중 오류가 발생했습니다.");
    } finally {
      setSummarizingUrls((prev) => ({ ...prev, [pageUrl]: false }));
      setSelectedItemGroupForSummary([]);
    }
  };

  // 문제 생성 기능 처리
  const handleCreateProblem = async (item: CapturedItem) => {
    if (item.problemId) {
      navigate(`/problem/${item.problemId}`);
      return;
    }

    if (!item.summaryId) {
      alert("먼저 요약을 생성해주세요.");
      return;
    }

    setSelectedItemForProblem(item);
    setIsProblemModalOpen(true);
  };

  const handleProblemModalSubmit = async (data: ProblemCreationData) => {
    if (!selectedItemForProblem || !authToken) {
      alert("인증 토큰이 없거나 선택된 아이템이 없습니다.");
      setIsProblemModalOpen(false);
      setSelectedItemForProblem(null);
      return;
    }
    const pageUrl = selectedItemForProblem.pageUrl;
    setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: true }));
    try {
      console.log(
        "문제 생성 요청:",
        selectedItemForProblem.summaryId,
        "데이터:",
        data,
        "토큰:",
        authToken ? "있음" : "없음"
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const problemId = "problem_" + Date.now();
      const currentItemsResult = await chrome.storage.local.get(["savedItems"]);
      const currentItems = (currentItemsResult.savedItems ||
        []) as CapturedItem[];
      const updatedItems = currentItems.map((savedItem) =>
        savedItem.pageUrl === pageUrl ? { ...savedItem, problemId } : savedItem
      );
      await chrome.storage.local.set({ savedItems: updatedItems });
      setIsProblemModalOpen(false);
      setSelectedItemForProblem(null);
    } catch (error) {
      console.error("문제 생성 오류:", error);
      alert("문제 생성 중 오류가 발생했습니다.");
    } finally {
      setCreatingProblemsUrls((prev) => ({ ...prev, [pageUrl]: false }));
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
          className="bg-main text-white py-2.5 px-6 rounded text-base font-medium hover:bg-blue-700 transition-colors"
          onClick={login}
        >
          Google 계정으로 로그인
        </button>
        <p className="text-sm text-gray mt-4">
          로그인 후 이 페이지가 자동으로 새로고침됩니다.
        </p>
      </div>
    );
  }

  // 인증되었고 데이터 로딩 중
  if (loading) {
    return (
      <div className="max-w-3xl flex flex-col h-screen items-center justify-center mx-auto bg-level1 text-black p-5">
        <h1 className="text-3xl font-bold text-level6 m-0 mb-4">Memozy</h1>
        <div className="flex items-center justify-center gap-2 text-gray">
          <div className="w-5 h-5 border-2 border-gray/20 rounded-full border-t-main animate-spin"></div>
          <span>캡처 기록 로드 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl @container flex flex-col h-screen mx-auto bg-level1 text-black px-5">
      {/* header 높이를 명시적으로 지정 (필터가 있을 때 140px, 없을 때 100px) */}
      <header className="flex flex-col sticky top-0 justify-between items-center bg-level1 pt-8 pb-3 border-b border-light-gray z-30 h-[160px]">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <img src="/icon128.png" alt="Memozy" className="w-9 h-9" />
            <h1 className="flex text-3xl font-bold text-level6 m-0">Memozy</h1>
          </div>
          <div className="flex gap-2.5">
            {savedItems.length > 0 && (
              <button
                className="bg-warning text-white border-0 py-2 px-4 rounded hover:bg-error transition-colors font-medium text-sm"
                onClick={handleDeleteAll}
                title="모든 기록 삭제"
              >
                모두 삭제
              </button>
            )}
          </div>
        </div>

        {/* 필터 컨트롤 */}
        {savedItems.length > 0 && (
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
        {displayOrderUrls.map((url) => {
          const group = groupedItemsForDisplay[url];
          if (!group || !group.items || group.items.length === 0) return null;
          const { title: groupTitle, items } = group;

          return (
            <div
              key={url}
              className="group-container min-h-19 max-h-[calc(90vh-160px)] mb-4 bg-white rounded-lg shadow-sm border border-light-gray overflow-auto"
            >
              <div
                className="sticky top-0 z-20 flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleGroup(url)}
              >
                <div className="flex min-w-0 mr-2">
                  <h3
                    className="m-0 text-base font-semibold text-black flex items-center"
                    title={groupTitle}
                  >
                    <span className="mr-1">
                      {expandedGroups === url ? <ArrowDown /> : <ArrowRight />}
                    </span>
                    <span className="line-clamp-1">{groupTitle}</span>
                    <span className="ml-2 text-sm font-normal text-gray flex-shrink-0">
                      ({items.length})
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    className={`flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border transition-all flex items-center justify-center gap-1 ${
                      items[0].summaryId
                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                    } ${
                      summarizingUrls[url]
                        ? "opacity-50 cursor-wait"
                        : "cursor-pointer"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!summarizingUrls[url])
                        handleOpenSummaryModal(url, groupTitle);
                    }}
                    disabled={summarizingUrls[url]}
                    title={items[0].summaryId ? "요약 보기" : "요약 생성"}
                  >
                    {summarizingUrls[url] ? (
                      <span className="text-xs">요약중...</span>
                    ) : (
                      <>
                        <span className="text-lg">📋</span>
                        <span className="ml-0.5 text-xs">요약</span>
                      </>
                    )}
                  </button>
                  <button
                    className={`flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border transition-all flex items-center justify-center gap-1 ${
                      items[0].problemId
                        ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
                        : items[0].summaryId && !creatingProblemsUrls[url]
                        ? "bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                        : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                    } ${
                      creatingProblemsUrls[url] ? "opacity-50 cursor-wait" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!creatingProblemsUrls[url])
                        handleCreateProblem(items[0]);
                    }}
                    disabled={!items[0]?.summaryId || creatingProblemsUrls[url]}
                    title={
                      items[0].problemId
                        ? "문제 보기"
                        : !items[0].summaryId
                        ? "요약 후 문제 생성 가능"
                        : "문제 만들기"
                    }
                  >
                    {creatingProblemsUrls[url] ? (
                      <span className="text-xs">생성중...</span>
                    ) : (
                      <>
                        <span className="text-lg">📝</span>
                        <span className="ml-0.5 text-xs">문제</span>
                      </>
                    )}
                  </button>
                  <button
                    className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer transition-all flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(items[0].pageUrl, "_blank");
                    }}
                    title="원본 페이지 새 탭으로 열기"
                  >
                    <span className="text-lg">🔗</span>
                    <span className="ml-0.5 text-xs">링크</span>
                  </button>
                  <button
                    className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer transition-all flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUrlGroup(url);
                    }}
                    title="이 그룹의 모든 항목 삭제"
                  >
                    <span className="text-lg">🗑️</span>
                    <span className="ml-0.5 text-xs">삭제</span>
                  </button>
                </div>
              </div>

              {expandedGroups === url && (
                <div className="border-t border-light-gray">
                  <div className="p-3 pt-0 space-y-3 bg-gray-50/50">
                    {items.map((item) => (
                      <CapturedItemCard
                        key={item.id}
                        item={item}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
                        onEdit={handleEdit}
                        showUrl={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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

      {/* 추가: 요약 모달 */}
      {selectedGroupInfo && selectedItemGroupForSummary.length > 0 && (
        <CreateSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => {
            setIsSummaryModalOpen(false);
            setSelectedItemGroupForSummary([]);
            setSelectedGroupInfo(null); // 모달 닫을 때 상태 초기화
          }}
          onSubmit={handleSummaryModalSubmit}
          items={selectedItemGroupForSummary}
          pageUrl={selectedGroupInfo.url} // url prop 전달
          pageTitle={selectedGroupInfo.title} // title prop 전달
        />
      )}
    </div>
  );
}
