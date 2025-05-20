import { useState, useEffect, useCallback } from "react";
import { CapturedItem, UrlGroup, ItemType } from "../../types";
import { useAuth } from "../useAuth";

// Helper function for DOM path comparison (moved from History.tsx)
function extractNthOfTypeValue(selectorPart: string): number | null {
  const match = selectorPart.match(/:nth-of-type\((\d+)\)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  if (!selectorPart.includes(":nth-of-type")) {
    return 1;
  }
  return null;
}

function compareDomPaths(pathA: string | undefined, pathB: string | undefined): number {
  if (!pathA && !pathB) return 0;
  if (!pathA) return 1;
  if (!pathB) return -1;

  const partsA = pathA.split(" > ");
  const partsB = pathB.split(" > ");
  const len = Math.min(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    if (partsA[i] === partsB[i]) continue;

    const nthA = extractNthOfTypeValue(partsA[i]);
    const nthB = extractNthOfTypeValue(partsB[i]);

    if (nthA !== null && nthB !== null && nthA !== nthB) {
      return nthA - nthB;
    }
    return partsA[i].localeCompare(partsB[i]);
  }
  return partsA.length - partsB.length;
}

export function useUrlGroups(userEmail: string | null) {
  const { isAuthenticated, authLoading } = useAuth();
  const [urlGroups, setUrlGroups] = useState<UrlGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // 아이템을 URL 그룹으로 변환하는 함수
  const organizeItemsIntoUrlGroups = useCallback(
    (items: CapturedItem[], currentUserEmail: string | null): UrlGroup[] => {
      const groupsByUrl: { [url: string]: UrlGroup } = {};

      const userItems = currentUserEmail
        ? items.filter((item) => item.userEmail === currentUserEmail)
        : items;

      userItems.forEach((item) => {
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
            userEmail: currentUserEmail || undefined,
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
    },
    []
  );

  // 저장된 아이템 불러오기 함수
  const loadItems = useCallback(async () => {
    if (!isAuthenticated || !userEmail) {
      setUrlGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await chrome.storage.local.get(["savedItems", "urlGroups"]);
      const allItems = (result.savedItems || []) as CapturedItem[];
      const allGroups = (result.urlGroups || []) as UrlGroup[];

      // 현재 사용자의 그룹만 필터링하거나, 아이템으로부터 그룹 생성
      const userSpecificGroups = allGroups.filter((group) => group.userEmail === userEmail);

      if (userSpecificGroups.length > 0) {
        // 기존 그룹 데이터가 있고, 이메일 정보가 있는 그룹이 현재 사용자의 것이라면 사용
        // (기존 저장 방식에 userEmail이 없었을 수 있으므로, 아이템 기반으로 재구성할 수도 있음)
        // 여기서는 간단히 userEmail 필드가 일치하는 그룹만 사용
        const validatedUserGroups = userSpecificGroups
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.userEmail === userEmail || !item.userEmail), // 아이템도 사용자 이메일 확인 (기존 데이터 호환)
          }))
          .filter((group) => group.items.length > 0); // 아이템이 없는 그룹은 제외할 수 있음
        setUrlGroups(validatedUserGroups);
      } else {
        // 사용자 특정 그룹이 없거나, 기존 그룹 데이터에 userEmail 필드가 없다면
        // 전체 아이템에서 사용자 아이템을 필터링하여 그룹 재구성
        const itemsForCurrentUser = allItems.filter((item) => item.userEmail === userEmail);
        if (itemsForCurrentUser.length > 0) {
          const groups = organizeItemsIntoUrlGroups(itemsForCurrentUser, userEmail);
          setUrlGroups(groups);
          // 필터링된 사용자 그룹 정보를 전체 그룹 정보에 반영하여 저장 (선택적)
          // 다른 사용자의 그룹 정보는 유지하면서 현재 사용자 그룹만 업데이트하여 저장할 수 있음
          // 예: const updatedAllGroups = [...allGroups.filter(g => g.userEmail !== userEmail), ...groups];
          // await chrome.storage.local.set({ urlGroups: updatedAllGroups });
          // 여기서는 우선 현재 사용자 그룹만 로드하고, 저장 로직은 각 기능에서 처리하도록 함.
        } else {
          setUrlGroups([]);
        }
      }
    } catch (error) {
      console.error("아이템 로드/정렬 오류:", error);
      setUrlGroups([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userEmail, organizeItemsIntoUrlGroups]);

  // 인증 상태 변경 또는 초기 로드 시 아이템 로드
  useEffect(() => {
    if (!authLoading && userEmail) {
      loadItems();
    }
  }, [authLoading, userEmail, loadItems]);

  // 스토리지 변경 감지
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (
        areaName === "local" &&
        (changes.savedItems || changes.urlGroups) &&
        isAuthenticated &&
        userEmail
      ) {
        console.log("저장 데이터 변경 감지 (로그인 상태, 특정 유저), 데이터 리로드");
        loadItems();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [isAuthenticated, userEmail, loadItems]);

  // 필터링된 아이템 (그룹 내)
  const getFilteredItemsInGroup = useCallback(
    (group: UrlGroup) => {
      let items = group.items;

      // 타입 필터링
      if (filter !== "all") {
        items = items.filter((item) => item.type === filter);
      }

      // 검색어 필터링
      if (searchTerm.trim() !== "") {
        const searchText = searchTerm.toLowerCase();
        items = items.filter((item) => {
          if (typeof item.content === "string") {
            return (
              item.content.toLowerCase().includes(searchText) ||
              item.pageTitle.toLowerCase().includes(searchText)
            );
          }

          if (item.type === "image") {
            return item.pageTitle.toLowerCase().includes(searchText);
          }
          // 이미지 콘텐츠의 경우 항상 검색 결과에 포함 (텍스트 검색 불가)
          return false;
        });
      }

      return items;
    },
    [filter, searchTerm]
  );

  // 필터링된 URL 그룹
  const filteredGroups = useCallback(() => {
    return urlGroups
      .filter((group) => {
        // 검색어가 없고 필터가 all이면 모든 그룹 표시
        if (searchTerm.trim() === "" && filter === "all") {
          return true;
        }

        // 그룹 제목, URL 검색
        if (searchTerm.trim() !== "") {
          const searchText = searchTerm.toLowerCase();
          if (
            group.title.toLowerCase().includes(searchText) ||
            group.url.toLowerCase().includes(searchText)
          ) {
            return true;
          }
        }

        // 필터링된 아이템이 있는 그룹만 표시
        const filteredItems = getFilteredItemsInGroup(group);
        return filteredItems.length > 0;
      })
      .sort((a, b) => {
        // 최신 시간순 정렬
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
  }, [urlGroups, searchTerm, filter, getFilteredItemsInGroup]);

  return {
    urlGroups,
    setUrlGroups,
    loading,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    getFilteredItemsInGroup,
    filteredGroups: filteredGroups(),
    loadItems,
    organizeItemsIntoUrlGroups,
  };
}
