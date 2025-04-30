import { useState, useEffect } from 'react';
import { CapturedItem, ItemType } from '../types';
import CapturedItemCard from './components/CapturedItemCard';
import axios from 'axios';
import '../Global.css';
import { useNavigate } from 'react-router-dom';
import CreateProblemModal, { ProblemCreationData } from './components/CreateProblemModal';

// --- Helper functions for DOM path comparison ---

// Extracts :nth-of-type(N) value from a selector part
function extractNthOfTypeValue(selectorPart: string): number | null {
    const match = selectorPart.match(/:nth-of-type\((\d+)\)$/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    // Handle cases like #id or tag without nth-of-type (assume 1st)
    if (!selectorPart.includes(':nth-of-type')) {
        return 1; 
    }
    return null; // Other complex selectors or errors
}

// Compares two DOM paths
function compareDomPaths(pathA: string | undefined, pathB: string | undefined): number {
    if (!pathA && !pathB) return 0; // Both missing
    if (!pathA) return 1;         // A missing, B comes first
    if (!pathB) return -1;        // B missing, A comes first

    const partsA = pathA.split(' > ');
    const partsB = pathB.split(' > ');
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
  const [savedItems, setSavedItems] = useState<CapturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ItemType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string>('');
  const [summarizingUrls, setSummarizingUrls] = useState<{[url: string]: boolean}>({});
  const [creatingProblemsUrls, setCreatingProblemsUrls] = useState<{[url: string]: boolean}>({});
  const [isProblemModalOpen, setIsProblemModalOpen] = useState(false);
  const [selectedItemForProblem, setSelectedItemForProblem] = useState<CapturedItem | null>(null);
  const navigate = useNavigate();
  
  // 저장된 아이템 불러오기
  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      try {
        const result = await chrome.storage.local.get(['savedItems']);
        const items = (result.savedItems || []) as CapturedItem[]; // Add type assertion
        
        // Group items by URL first
        const itemsByUrl: { [url: string]: CapturedItem[] } = {};
        items.forEach(item => {
          if (!itemsByUrl[item.pageUrl]) {
            itemsByUrl[item.pageUrl] = [];
          }
          itemsByUrl[item.pageUrl].push(item);
        });

        // Sort items within each group by DOM path, then combine
        let sortedItems: CapturedItem[] = [];
        Object.values(itemsByUrl).forEach(group => {
          const sortedGroup = group.sort((a, b) => {
            // Handle items without domPath (put them first or last)
            const pathA = a.meta?.domPath;
            const pathB = b.meta?.domPath;
            if (!pathA && !pathB) return 0; // Both missing, keep original order relative to each other
            if (!pathA) return -1;       // A missing, comes first
            if (!pathB) return 1;        // B missing, comes last
            
            // Use the comparison function
            return compareDomPaths(pathA, pathB);
          });
          sortedItems = sortedItems.concat(sortedGroup);
        });

        // Now sort the groups themselves by the timestamp of the *first* item in each sorted group (latest group first)
        // Or keep a fixed order based on URL if preferred. Let's sort groups by latest timestamp for now.
        const finalGroupedItems: { [url: string]: { title: string, items: CapturedItem[] } } = {};
        sortedItems.forEach(item => {
            const url = item.pageUrl;
            if (!finalGroupedItems[url]) {
                finalGroupedItems[url] = {
                    title: item.pageTitle || url,
                    items: []
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
        const finalSortedItems = sortedUrls.flatMap(url => finalGroupedItems[url].items);

        setSavedItems(finalSortedItems);

      } catch (error) {
        console.error('아이템 로드/정렬 오류:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadItems();
    
    // 스토리지 변경 감지
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.savedItems) {
        // Reload and re-sort items when storage changes
        loadItems(); 
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);
  
  // 아이템 삭제 처리
  const handleDelete = async (itemId: number) => {
    try {
      const updatedItems = savedItems.filter(item => item.id !== itemId);
      await chrome.storage.local.set({ savedItems: updatedItems });
      setSavedItems(updatedItems);
    } catch (error) {
      console.error('아이템 삭제 오류:', error);
    }
  };
  
  // 모든 아이템 삭제 처리
  const handleDeleteAll = async () => {
    if (window.confirm('모든 캡처 아이템을 삭제하시겠습니까?')) {
      try {
        await chrome.storage.local.set({ savedItems: [] });
        setSavedItems([]);
      } catch (error) {
        console.error('모든 아이템 삭제 오류:', error);
      }
    }
  };
  
  // URL별 아이템 삭제 처리
  const handleDeleteUrlGroup = async (pageUrl: string) => {
    if (window.confirm('모든 내용을 삭제하시겠습니까?')) {
      try {
        const updatedItems = savedItems.filter(item => item.pageUrl !== pageUrl);
        await chrome.storage.local.set({ savedItems: updatedItems });
        setSavedItems(updatedItems);
      } catch (error) {
        console.error('그룹 삭제 오류:', error);
      }
    }
  };
  
  // 아이템 다운로드 처리
  const handleDownload = async (item: CapturedItem) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadItem',
        item: item
      });
      
      if (!response || !response.success) {
        console.error('다운로드 실패:', response?.error || '알 수 없는 오류');
      }
    } catch (error) {
      console.error('다운로드 요청 오류:', error);
    }
  };
  
  // 필터링된 아이템 (이제 savedItems는 이미 정렬된 상태)
  const filteredItems = savedItems.filter(item => {
    // 타입 필터
    if (filter !== 'all' && item.type !== filter) {
      return false;
    }
    
    // 검색어 필터
    if (searchTerm.trim() !== '') {
      const searchText = searchTerm.toLowerCase();
      
      // 텍스트 타입일 경우 내용 검색
      if (item.type === 'text' && typeof item.content === 'string') {
        return item.content.toLowerCase().includes(searchText) ||
               item.pageTitle.toLowerCase().includes(searchText) ||
               item.pageUrl.toLowerCase().includes(searchText);
      }
      
      // HTML 타입일 경우 내용 검색
      if (item.type === 'html' && typeof item.content === 'string') {
        return item.content.toLowerCase().includes(searchText) ||
               item.pageTitle.toLowerCase().includes(searchText) ||
               item.pageUrl.toLowerCase().includes(searchText);
      }
      
      // 이미지 타입일 경우 페이지 정보만 검색
      return item.pageTitle.toLowerCase().includes(searchText) ||
             item.pageUrl.toLowerCase().includes(searchText);
    }
    
    return true;
  });
  
  // url별로 아이템 그룹화 (for display - items within groups are already sorted)
  const groupedItemsForDisplay: {[url: string]: {title: string, items: CapturedItem[]}} = {};
  filteredItems.forEach(item => {
    const url = item.pageUrl;
    if (!groupedItemsForDisplay[url]) {
      groupedItemsForDisplay[url] = {
        title: item.pageTitle || url,
        items: []
      };
    }
    groupedItemsForDisplay[url].items.push(item);
  });

   // Get sorted URLs for rendering based on the original sorting (latest group first)
   // We need to respect the order derived from sorting by the first item's timestamp
   const displayOrderUrls = Object.keys(groupedItemsForDisplay).sort((urlA, urlB) => {
        const firstItemTimestamp = (url: string): number => {
            const firstItem = savedItems.find(item => item.pageUrl === url); // Find first item in original sorted list
            if (!firstItem) return 0;
            const time = new Date(firstItem.timestamp).getTime();
            return isNaN(time) ? 0 : time;
        };
        return firstItemTimestamp(urlB) - firstItemTimestamp(urlA); // Descending
    });

  // 그룹 접기/펼치기 토글 함수
  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => prev === title ? '' : title);
  };
  
  // 요약 기능 처리
  const handleCreateSummary = async (item: CapturedItem) => {
    // 이미 요약이 있는 경우 요약 보기 페이지로 이동
    if (item.summaryId) {
      navigate(`/summary/${item.summaryId}`);
      return;
    }

    try {
      // 요약 생성 중 상태로 변경
      setSummarizingUrls(prev => ({...prev, [item.pageUrl]: true}));
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 가상의 summaryId 설정 (실제로는 API 응답에서 받아야 함)
      const summaryId = "summary_" + Date.now();
      
      // 저장된 아이템 업데이트
      const updatedItems = savedItems.map(savedItem => {
        if (savedItem.pageUrl === item.pageUrl) {
          return {...savedItem, summaryId};
        }
        return savedItem;
      });
      
      // 스토리지에 저장
      await chrome.storage.local.set({ savedItems: updatedItems });
      setSavedItems(updatedItems);
      
      // 요약 생성 후 요약 보기 페이지로 이동
    } catch (error) {
      console.error('요약 생성 오류:', error);
      alert('요약 생성 중 오류가 발생했습니다.');
    } finally {
      // 요약 생성 중 상태 해제
      setSummarizingUrls(prev => ({...prev, [item.pageUrl]: false}));
    }
  };
  
  // 문제 생성 기능 처리
  const handleCreateProblem = async (item: CapturedItem) => {
    // 이미 문제가 있는 경우 문제 보기 페이지로 이동
    if (item.problemId) {
      navigate(`/problem/${item.problemId}`);
      return;
    }

    if (!item.summaryId) {
      alert('먼저 요약을 생성해주세요.');
      return;
    }
    
    setSelectedItemForProblem(item);
    setIsProblemModalOpen(true);
  };
  
  const handleProblemModalSubmit = async (data: ProblemCreationData) => {
    if (!selectedItemForProblem) return;

    try {
      // 문제 생성 중 상태로 변경
      setCreatingProblemsUrls(prev => ({...prev, [selectedItemForProblem.pageUrl]: true}));
      
      // 1초 대기 (실제로는 API 호출로 대체)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 가상의 problemId 설정 (실제로는 API 응답에서 받아야 함)
      const problemId = "problem_" + Date.now();
      
      // 저장된 아이템 업데이트
      const updatedItems = savedItems.map(savedItem => {
        if (savedItem.pageUrl === selectedItemForProblem.pageUrl) {
          return {...savedItem, problemId};
        }
        return savedItem;
      });
      
      // 스토리지에 저장
      await chrome.storage.local.set({ savedItems: updatedItems });
      setSavedItems(updatedItems);
      
      // 모달 닫기
      setIsProblemModalOpen(false);
      setSelectedItemForProblem(null);
      
      
    } catch (error) {
      console.error('문제 생성 오류:', error);
      alert('문제 생성 중 오류가 발생했습니다.');
    } finally {
      // 문제 생성 중 상태 해제
      if (selectedItemForProblem) {
        setCreatingProblemsUrls(prev => ({...prev, [selectedItemForProblem.pageUrl]: false}));
      }
    }
  };
  
  return (
    <div className="max-w-3xl @container flex flex-col h-full overflow-y-auto mx-auto bg-level1 text-black p-5">
      <header className="flex justify-between items-center mb-5">
        <h1 className="text-3xl font-bold text-level6 m-0">Memozy</h1>
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
      </header>
      
      {/* 필터 컨트롤 */}
      {savedItems.length > 0 && (
        <div className="flex gap-2.5 mb-4 flex-wrap">
          <select
            className="py-2 px-3 border border-light-gray rounded bg-white text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ItemType | 'all')}
            aria-label="타입 필터"
          >
            <option value="all">모든 타입</option>
            <option value="text">텍스트</option>
            <option value="image">이미지</option>
          </select>
          
          <div className="flex-1 min-w-[200px]">
            <input
              className="w-full py-2 px-3 border border-light-gray rounded text-sm"
              type="text"
              placeholder="검색어를 입력하세요..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="검색"
            />
          </div>
        </div>
      )}
      
      {/* 로딩 상태 */}
      {loading && (
        <div className="flex justify-center py-10 text-gray">
          <div className="w-6 h-6 border-2 border-gray/20 rounded-full border-t-main animate-spin mx-auto"></div>
          <p>캡처 기록 로드 중...</p>
        </div>
      )}
      
      {/* 빈 상태 */}
      {!loading && savedItems.length === 0 && (
        <div className="flex flex-col h-full items-center justify-center py-16 text-gray">
          <h3 className="flex mb-2 text-level5 text-2xl font-semibold">캡처한 데이터가 없습니다</h3>
          <p className="flex mb-5 text-xl text-gray">텍스트를 드래그하거나 이미지를 클릭하여 캡처해보세요.</p>
        </div>
      )}
      
      {/* 검색 결과 없음 */}
      {!loading && savedItems.length > 0 && filteredItems.length === 0 && (
        <div className="text-center py-16 text-gray">
          <h3 className="mb-2 text-level6 font-semibold">검색 결과가 없습니다</h3>
          <p className="text-gray">다른 검색어나 필터를 사용해보세요.</p>
        </div>
      )}
      
      {/* 타이틀별로 그룹화된 아이템 목록 (use displayOrderUrls) */}
      {!loading && displayOrderUrls.map(url => {
        const { title: groupTitle, items } = groupedItemsForDisplay[url];
        // Filter might remove all items from a group, check if items exist
        if (!items || items.length === 0) return null;

        return (
          <div key={url} className="mb-4 bg-white rounded-lg shadow">
            <div 
              className="flex justify-between items-center p-3 bg-gray-100 border-b border-light-gray cursor-pointer"
            >
              <h3 onClick={() => toggleGroup(url)} className="w-full m-0 text-base font-semibold text-black flex items-center">
                <span className="cursor-pointer line-clamp-1">
                  {groupTitle}
                  <span className="ml-2 text-sm font-normal text-gray">({items.length})</span>
                </span>
              </h3>
              <div className="flex items-center gap-1">
                  {/* Buttons using items[0] for summary/problem/link/delete group */} 
                  {/* 요약 기능 버튼 */} 
                  <button 
                    className={`ml-2 text-xs w-11 h-15 py-1  rounded cursor-pointer transition-all ${
                      items[0].summaryId ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'hover:bg-gray-200'
                    }`}
                    onClick={(e) => { e.stopPropagation(); if (!summarizingUrls[url]) handleCreateSummary(items[0]); }}
                    disabled={summarizingUrls[url]}
                    title={items[0].summaryId ? "요약 보기" : "요약 요청"}
                  >
                    {summarizingUrls[url] ? <span className="text-gray-400 text-sm">요약 중...</span> : <span className="text-xl">📋 <span className="text-base">요약</span></span>}
                  </button>

                  {/* 문제 만들기 버튼 */} 
                  <button 
                    className={`text-xs py-1 w-11 h-15 rounded transition-all ${
                      items[0].problemId 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer' 
                        : (items[0].summaryId && !creatingProblemsUrls[url]) 
                          ? 'hover:bg-gray-200 cursor-pointer' 
                          : 'text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={(e) => { e.stopPropagation(); if (!creatingProblemsUrls[url]) handleCreateProblem(items[0]); }}
                    disabled={(!items[0]?.summaryId && !items[0]?.problemId) || creatingProblemsUrls[url]}
                    title={items[0].problemId ? "문제 보기" : (!items[0].summaryId ? "요약 후 문제 생성 가능" : "문제 만들기")}
                  >
                    {creatingProblemsUrls[url] 
                      ? <span className="text-gray-400 text-sm">생성 중...</span> 
                      : <span className="text-xl">📝 <span className="text-base">문제</span></span> }
                  </button>

                  {/* 원본 링크 버튼 */} 
                  <button 
                    className="text-xs py-1 w-11 h-15 rounded hover:bg-gray-200 cursor-pointer transition-all"
                    onClick={(e) => { e.stopPropagation(); window.open(items[0].pageUrl); }}
                    title="원본 페이지로 이동"
                  >
                    <span className="text-xl">🔗<br/><span className="text-base">링크</span></span>
                  </button>

                  {/* URL 그룹 삭제 버튼 */} 
                  <button 
                    className="text-xs py-1 w-11 h-15 rounded hover:bg-red-200 text-red-700 cursor-pointer transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDeleteUrlGroup(url); }}
                    title="이 URL의 모든 항목 삭제"
                  >
                    <span className="text-xl">🗑️<br/><span className="text-base">삭제</span></span>
                  </button>

                  {/* 접기/펼치기 버튼 */} 
                  <button 
                    className="bg-transparent w-11 h-15 py-1 border-0 text-gray text-base hover:bg-gray-200 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleGroup(url); }}
                  >
                    {expandedGroups === url ? '▼' : '◀'}
                  </button>
              </div>
            </div>
            
            {expandedGroups === url && (
              <div className="p-4">
                <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                  {items.map(item => ( // items are already sorted by DOM path
                    <CapturedItemCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      showUrl={false} // URL is shown in group header
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      
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
};