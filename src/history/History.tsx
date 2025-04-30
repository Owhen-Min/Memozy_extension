import { useState, useEffect } from 'react';
import { CapturedItem, ItemType } from '../types';
import CapturedItemCard from './components/CapturedItemCard';
import axios from 'axios';
import '../Global.css';
import { useNavigate } from 'react-router-dom';
import CreateProblemModal, { ProblemCreationData } from './components/CreateProblemModal';
import { useAuth } from '../hooks/useAuth';

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
  const { isAuthenticated, authLoading, login } = useAuth();
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
      if (loading || !isAuthenticated) return;

      setLoading(true);
      try {
        const result = await chrome.storage.local.get(['savedItems']);
        const items = (result.savedItems || []) as CapturedItem[];
        
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
    
    if (!authLoading && isAuthenticated) {
      loadItems();
    } else if (!authLoading && !isAuthenticated) {
        setLoading(false);
        setSavedItems([]);
    }

    // 스토리지 변경 감지
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.savedItems && isAuthenticated) {
        loadItems();
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [authLoading, isAuthenticated]);
  
  // 아이템 삭제 처리
  const handleDelete = async (itemId: number) => {
    try {
      const updatedItems = savedItems.filter(item => item.id !== itemId);
      await chrome.storage.local.set({ savedItems: updatedItems });
    } catch (error) {
      console.error('아이템 삭제 오류:', error);
    }
  };
  
  // 모든 아이템 삭제 처리
  const handleDeleteAll = async () => {
    if (window.confirm('모든 캡처 아이템을 삭제하시겠습니까?')) {
      try {
        await chrome.storage.local.set({ savedItems: [] });
      } catch (error) {
        console.error('모든 아이템 삭제 오류:', error);
      }
    }
  };
  
  // URL별 아이템 삭제 처리
  const handleDeleteUrlGroup = async (pageUrl: string) => {
    if (window.confirm(`'${groupedItemsForDisplay[pageUrl]?.title || pageUrl}' 그룹의 모든 내용을 삭제하시겠습니까?`)) {
      try {
        const idsToDelete = savedItems.filter(item => item.pageUrl === pageUrl).map(item => item.id);
        if (idsToDelete.length === 0) return;

        const currentItemsResult = await chrome.storage.local.get(['savedItems']);
        const itemsToKeep = (currentItemsResult.savedItems || []).filter((item: CapturedItem) => item.pageUrl !== pageUrl);

        await chrome.storage.local.set({ savedItems: itemsToKeep });
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
        alert(`다운로드 실패: ${response?.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('다운로드 요청 오류:', error);
      alert(`다운로드 요청 오류: ${error}`);
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
            const firstItem = savedItems.find(item => item.pageUrl === url);
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
          캡처 기록을 보려면<br/>먼저 로그인이 필요합니다.
        </p>
        <button
          className="bg-main text-white py-2.5 px-6 rounded text-base font-medium hover:bg-blue-700 transition-colors"
          onClick={login}
        >
          Google 계정으로 로그인
        </button>
        <p className='text-sm text-gray mt-4'>로그인 후 이 페이지가 자동으로 새로고침됩니다.</p>
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
    <div className="max-w-3xl @container flex flex-col h-screen overflow-y-auto mx-auto bg-level1 text-black p-5">
      <header className="flex justify-between items-center mb-5 sticky top-0 bg-level1 py-3 border-b border-light-gray z-10">
        <h1 className="text-3xl font-bold text-level6 m-0">캡처 기록</h1>
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
        <div className="flex gap-2.5 my-4 flex-wrap sticky top-[73px] bg-level1 py-3 z-10">
          <select
            className="py-2 px-3 border border-light-gray rounded bg-white text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ItemType | 'all')}
            aria-label="타입 필터"
          >
            <option value="all">모든 타입</option>
            <option value="text">텍스트</option>
            <option value="image">이미지</option>
            <option value="html">HTML</option>
          </select>
          
          <div className="flex-1 min-w-[200px]">
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
      
      {/* 빈 상태 */}
      {savedItems.length === 0 && (
        <div className="flex flex-col flex-grow items-center justify-center py-16 text-gray text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="mb-2 text-level5 text-xl font-semibold">캡처한 기록이 없습니다</h3>
          <p className="text-gray">팝업 메뉴에서 캡처 기능을 활성화하고<br/>웹 페이지의 텍스트나 이미지를 저장해보세요.</p>
        </div>
      )}
      
      {/* 검색 결과 없음 */}
      {savedItems.length > 0 && filteredItems.length === 0 && (
        <div className="flex flex-col flex-grow items-center justify-center py-16 text-gray text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <h3 className="mb-2 text-level6 font-semibold">검색 결과가 없습니다</h3>
          <p className="text-gray">다른 검색어나 필터를 사용해보세요.</p>
        </div>
      )}
      
      {/* 타이틀별로 그룹화된 아이템 목록 (use displayOrderUrls) */}
      <div className="flex-grow pb-5">
        {displayOrderUrls.map(url => {
          const group = groupedItemsForDisplay[url];
           if (!group || !group.items || group.items.length === 0) return null;
          const { title: groupTitle, items } = group;

          return (
            <div key={url} className="mb-4 bg-white rounded-lg shadow-sm border border-light-gray overflow-hidden">
              <div
                className="flex justify-between items-center p-3 bg-gray-50 border-b border-light-gray cursor-pointer hover:bg-gray-100 transition-colors"
                 onClick={() => toggleGroup(url)}
              >
                 <div className="flex-1 min-w-0 mr-2">
                    <h3 className="m-0 text-base font-semibold text-black truncate flex items-center" title={groupTitle}>
                        <span className="mr-1">
                         {expandedGroups === url ? '▼' : '▶'}
                        </span>
                        {groupTitle}
                        <span className="ml-2 text-sm font-normal text-gray flex-shrink-0">({items.length})</span>
                    </h3>
                 </div>
                 <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className={`text-xs w-[70px] h-[40px] py-1 px-1.5 rounded border transition-all ${
                        items[0].summaryId ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                      } ${summarizingUrls[url] ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                      onClick={(e) => { e.stopPropagation(); if (!summarizingUrls[url]) handleCreateSummary(items[0]); }}
                      disabled={summarizingUrls[url]}
                      title={items[0].summaryId ? "요약 보기" : "요약 생성 요청"}
                    >
                      {summarizingUrls[url] ? <span className="text-xs">요약중...</span> : <>📋<span className="ml-1 text-xs">요약</span></>}
                    </button>
                    <button
                       className={`text-xs w-[70px] h-[40px] py-1 px-1.5 rounded border transition-all ${
                        items[0].problemId
                          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer'
                          : items[0].summaryId && !creatingProblemsUrls[url]
                            ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer'
                            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      } ${creatingProblemsUrls[url] ? 'opacity-50 cursor-wait' : ''}`}
                      onClick={(e) => { e.stopPropagation(); if (!creatingProblemsUrls[url]) handleCreateProblem(items[0]); }}
                      disabled={!items[0]?.summaryId || creatingProblemsUrls[url]}
                      title={items[0].problemId ? "문제 보기" : (!items[0].summaryId ? "요약 후 문제 생성 가능" : "문제 만들기")}
                    >
                      {creatingProblemsUrls[url]
                        ? <span className="text-xs">생성중...</span>
                        : <>📝<span className="ml-1 text-xs">문제</span></>}
                    </button>
                    <button
                      className="text-xs w-[70px] h-[40px] py-1 px-1.5 rounded border bg-white border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer transition-all"
                      onClick={(e) => { e.stopPropagation(); window.open(items[0].pageUrl, '_blank'); }}
                      title="원본 페이지 새 탭으로 열기"
                    >
                      🔗<span className="ml-1 text-xs">링크</span>
                    </button>
                    <button
                       className="text-xs w-[70px] h-[40px] py-1 px-1.5 rounded border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer transition-all"
                      onClick={(e) => { e.stopPropagation(); handleDeleteUrlGroup(url); }}
                      title="이 그룹의 모든 항목 삭제"
                    >
                      🗑️<span className="ml-1 text-xs">삭제</span>
                    </button>
                </div>
              </div>

              {expandedGroups === url && (
                <div className="border-t border-light-gray">
                   <div className="p-3 space-y-3">
                    {items.map(item => (
                      <CapturedItemCard
                        key={item.id}
                        item={item}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
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
    </div>
  );
};