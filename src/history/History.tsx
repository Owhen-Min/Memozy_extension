import { useState, useEffect } from 'react';
import { CapturedItem, ItemType } from '../types';
import CapturedItemCard from './components/CapturedItemCard';
import axios from 'axios';
import '../Global.css';
import { useNavigate } from 'react-router-dom';
import CreateProblemModal, { ProblemCreationData } from './components/CreateProblemModal';

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
        const items = result.savedItems || [];
        
        // 날짜순 정렬 (최신순)
        const sortedItems = items.sort((a: CapturedItem, b: CapturedItem) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          
          // 유효하지 않은 날짜는 가장 앞으로
          if (isNaN(dateA) && isNaN(dateB)) return 0;
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          
          return dateB - dateA;
        });
        setSavedItems(sortedItems);
      } catch (error) {
        console.error('아이템 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadItems();
    
    // 스토리지 변경 감지
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.savedItems) {
        const newItems = changes.savedItems.newValue || [];
        setSavedItems(newItems);
        
        // 새 아이템이 있지만 확장된 그룹이 없으면 첫 번째 그룹 확장
        if (expandedGroups === '' && newItems.length > 0) {
          const firstTitle = newItems[0]?.pageTitle || '제목 없음';
          setExpandedGroups(firstTitle);
        }
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
  
  // 필터링된 아이템
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
  
  // url별로 아이템 그룹화
  const groupedItems: {[url: string]: {title: string, items: CapturedItem[]}} = {};
  filteredItems.forEach(item => {
    const url = item.pageUrl;
    if (!groupedItems[url]) {
      groupedItems[url] = {
        title: item.pageTitle || url,
        items: []
      };
    }
    groupedItems[url].items.push(item);
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
            <option value="html">HTML</option>
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
      
      {/* 타이틀별로 그룹화된 아이템 목록 */}
      {!loading && Object.entries(groupedItems).map(([title, {title: groupTitle, items}]) => (
        <div key={title} className="mb-4 bg-white rounded-lg shadow">
          <div 
            className="flex justify-between items-center p-3 bg-gray-100 border-b border-light-gray cursor-pointer"
          >
            <h3 onClick={() => toggleGroup(title)} className="w-full m-0 text-base font-semibold text-black flex items-center">
              <span className="cursor-pointer line-clamp-1">
                {groupTitle}
                <span className="ml-2 text-sm font-normal text-gray">({items.length})</span>
              </span>
            </h3>
            <div className="flex items-center gap-1">
              {/* 요약 기능 버튼 */}
              <button 
                className={`ml-2 text-xs w-[88px] py-1 px-2 rounded cursor-pointer transition-all ${
                  items[0].summaryId ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'hover:bg-gray-200'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!summarizingUrls[title]) {
                    handleCreateSummary(items[0]);
                  }
                }}
                disabled={summarizingUrls[title]}
                title={items[0].summaryId ? "요약 보기" : "요약 요청"}
              >
                {summarizingUrls[title] ? '요약 중...' : (items[0].summaryId ? '📋 요약 보기' : '📋 요약 요청')}
              </button>

              {/* 문제 만들기 버튼 */}
              <button 
                className={`text-xs py-1 px-2 w-[88px] rounded transition-all ${
                  items[0].problemId 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer' 
                    : (items[0].summaryId && !creatingProblemsUrls[title]) 
                      ? 'hover:bg-gray-200 cursor-pointer' 
                      : 'text-gray-400 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!creatingProblemsUrls[title]) {
                    handleCreateProblem(items[0]);
                  }
                }}
                disabled={(!items[0].summaryId && !items[0].problemId) || creatingProblemsUrls[title]}
                title={items[0].problemId ? "문제 보기" : (!items[0].summaryId ? "요약 후 문제 생성 가능" : "문제 만들기")}
              >
                {creatingProblemsUrls[title] 
                  ? '생성 중...' 
                  : (items[0].problemId 
                    ? '📝 문제 보기' 
                    : '📝 문제 요청')}
              </button>

              {/* 원본 링크 버튼 */}
              <button 
                className="text-xs py-1 px-2 w-[60px] rounded hover:bg-gray-200 cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(items[0].pageUrl);
                }}
                title="원본 페이지로 이동"
              >
                🔗 링크
              </button>

              {/* 접기/펼치기 버튼 */}
              <button 
                className="bg-transparent w-[30px] py-1 px-2 border-0 text-gray text-base hover:bg-gray-200 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(title);
                }}
              >
                {expandedGroups === title ? '▼' : '◀'}
              </button>
            </div>
          </div>
          
          {expandedGroups === title && (
            <div className="p-4 overflow-y-auto">
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
          )}
        </div>
      ))}
      
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