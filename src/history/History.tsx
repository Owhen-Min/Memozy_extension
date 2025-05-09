import "../Global.css";
import ArrowDown from "../svgs/arrow-down.svg";
import ArrowRight from "../svgs/arrow-right.svg";
import NoContent from "../svgs/no-content.svg";
import CapturedItemCard from "./features/CapturedItemCard";
import CreateSummaryModal from "./features/CreateSummaryModal";
import CreateProblemModal from "./features/CreateProblemModal";
import { ItemType } from "../types";
import { useAuth } from "../hooks/useAuth";

import {
  useUrlGroups,
  useHistoryItems,
  useHistoryUI,
  useSummary,
  useProblemCreation,
} from "../hooks/history";

export default function History() {
  const { isAuthenticated, authLoading, login } = useAuth();

  // URL 그룹 관련 훅
  const {
    urlGroups,
    setUrlGroups,
    loading,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    getFilteredItemsInGroup,
    filteredGroups,
  } = useUrlGroups();

  // UI 상태 관리 훅
  const {
    expandedGroups,
    toggleGroup,
    summarizingUrls,
    setSummarizingUrls,
    creatingProblemsUrls,
    setCreatingProblemsUrls,
    isProblemModalOpen,
    isSummaryModalOpen,
    selectedGroupInfo,
    selectedItemGroupForSummary,
    selectedItemForProblem,
    closeSummaryModal,
    closeProblemModal,
    openSummaryModal,
    openProblemModal,
  } = useHistoryUI();

  // 아이템 CRUD 관련 훅
  const { handleDeleteAll, handleDeleteUrlGroup, handleDelete, handleDownload, handleEdit } =
    useHistoryItems(urlGroups);

  // 요약 관련 훅
  const { handleSummaryModalSubmit } = useSummary(setUrlGroups, setSummarizingUrls);

  // 문제 생성 관련 훅
  const { handleProblemModalSubmit } = useProblemCreation(setUrlGroups, setCreatingProblemsUrls);

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
      <header
        className={`flex flex-col sticky top-0 justify-between items-center bg-level1 pt-8 pb-3 border-b border-light-gray z-30 ${
          urlGroups.length === 0 ? "h-[40px]" : "h-[160px]"
        }`}
      >
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <img src="/icon128.png" alt="Memozy" className="w-9 h-9" />
            <h1 className="flex text-3xl font-bold text-level6 m-0">Memozy</h1>
          </div>
          <div className="flex gap-2.5">
            {urlGroups.length > 0 && (
              <>
                <button
                  className="flex flex-col text-xs w-14 h-13 px-1 rounded border bg-main/70 border-blue-600 text-white hover:bg-blue-700/70 transition-all flex items-center justify-center"
                  onClick={() => window.open("https://memozy.site/collection")}
                  title="웹으로 이동"
                >
                  <span className="text-lg">🌐</span>
                  <span className="text-sm">웹으로</span>
                </button>
                <button
                  className="flex flex-col w-15 h-13 px-1 rounded border bg-warning/70 border-warning text-black hover:text-white hover:bg-warning-dark/70 hover:border-warning-dark transition-all flex items-center justify-center"
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
                      if (!summarizingUrls[group.url])
                        openSummaryModal(group, getFilteredItemsInGroup);
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
                      if (!creatingProblemsUrls[group.url]) openProblemModal(group);
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
          onClose={closeSummaryModal}
          onSubmit={(selectedItems, summaryContent, summaryType, summaryId) =>
            handleSummaryModalSubmit(
              selectedItems,
              summaryContent,
              summaryType,
              Number(summaryId),
              selectedGroupInfo
            )
          }
          items={selectedItemGroupForSummary}
          pageUrl={selectedGroupInfo.url}
          pageTitle={selectedGroupInfo.title}
        />
      )}

      {selectedItemForProblem && (
        <CreateProblemModal
          isOpen={isProblemModalOpen}
          onClose={closeProblemModal}
          onSubmit={(data) =>
            handleProblemModalSubmit(data, selectedItemForProblem, selectedGroupInfo)
          }
          item={selectedItemForProblem}
        />
      )}

      {urlGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full">
          <NoContent className="w-[calc(min(30vw,230px))] aspect-square max-h-[calc(100vh-200px)] mb-10" />
          <p className="text-lg text-gray mb-8 text-center">
            캡처 기록이 없습니다.
            <br />
            익스텐션을 활용해 메모지를 추가해보세요.
          </p>
        </div>
      )}
    </div>
  );
}
