import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { CapturedItem, UrlGroup } from "../../types";
import CustomReactMarkdown from "../../lib/react-markdown/CustomReactMarkdown";
import { useModal } from "../../context/ModalContext";

export default function SummaryView() {
  const { summaryId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<UrlGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const { openModal } = useModal();

  useEffect(() => {
    const loadSummary = async () => {
      try {
        if (summaryId) {
          const numericSummaryId = parseInt(summaryId, 10);
          if (!isNaN(numericSummaryId)) {
            // URL 그룹에서 요약 정보 찾기
            const result = await chrome.storage.local.get(["urlGroups"]);
            const urlGroups = result.urlGroups || [];

            const foundSummaryGroup = urlGroups.find(
              (group: UrlGroup) => group.summaryId === numericSummaryId
            );

            if (foundSummaryGroup) {
              setSummary(foundSummaryGroup);
            } else {
              // 요약을 찾을 수 없는 경우
              openModal(
                <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
                  <h1 className="text-2xl font-bold text-center mb-4">요약을 찾을 수 없습니다.</h1>
                </div>,
                { closeable: true }
              );
              navigate("/");
            }
          } else {
            // 유효하지 않은 summaryId (숫자로 변환 불가)
            openModal(
              <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
                <h1 className="text-2xl font-bold text-center mb-4">
                  유효하지 않은 요약 ID입니다.
                </h1>
              </div>,
              { closeable: true }
            );
            navigate("/");
          }
        } else {
          // summaryId가 URL에 없는 경우
          openModal(
            <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
              <h1 className="text-2xl font-bold text-center mb-4">요약 ID가 없습니다.</h1>
            </div>,
            { closeable: true }
          );
          navigate("/");
        }
      } catch (error) {
        console.error("요약 로드 오류:", error);
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">
              요약을 불러오는 중 오류가 발생했습니다.
            </h1>
          </div>,
          { closeable: true }
        );
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [summaryId, navigate]);

  const handleDownloadSummary = async () => {
    if (!summary) {
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-bold text-center mb-4">다운로드할 요약 내용이 없습니다.</h1>
        </div>,
        { closeable: true }
      );
      return;
    }

    try {
      // 요약 콘텐츠를 담은 가상 아이템 생성
      const virtualItem: CapturedItem = {
        id: Date.now(),
        type: "text",
        content: summary.summaryContent || "",
        markdownContent: summary.summaryContent || "",
        pageTitle: summary.title,
        pageUrl: summary.url,
        timestamp: summary.timestamp,
        meta: { favicon: summary.favicon },
      };

      const messagePayload = {
        action: "downloadItem",
        item: virtualItem,
        markdownContent: summary.summaryContent, // summaryContent는 이미 마크다운
      };

      const response = await chrome.runtime.sendMessage(messagePayload);

      if (!response || !response.success) {
        console.error("다운로드 실패:", response?.error || "알 수 없는 오류");
        const errorMessage = response?.error || "알 수 없는 오류";
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">다운로드 실패: {errorMessage}</h1>
          </div>,
          { closeable: true }
        );
      }
    } catch (error: any) {
      console.error("다운로드 요청 오류:", error);
      if (error.message?.includes("Extension context invalidated")) {
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">
              다운로드 실패: 확장 프로그램 컨텍스트 오류. 페이지를 새로고침하거나 확장 프로그램을
              다시 로드해보세요.
            </h1>
          </div>,
          { closeable: true }
        );
      } else {
        openModal(
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
            <h1 className="text-2xl font-bold text-center mb-4">
              다운로드 요청 오류: {error.message || error}
            </h1>
          </div>,
          { closeable: true }
        );
      }
    }
  };

  // summary가 아직 로드되지 않았고, 로딩 중도 아니라면 (오류 등으로 navigate되기 전 잠시) null 반환
  // 또는 summaryId가 처음부터 없는 경우도 고려 (useEffect에서 처리하지만 방어적으로)
  if (!loading && !summary && summaryId) {
    // 이 경우는 보통 useEffect에서 navigate('/')가 실행되므로 거의 보이지 않음
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto p-5 bg-level1 h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center py-3 border-b border-light-gray mb-5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/icon128.png" alt="Memozy" className="w-9 h-9" />
          <h1 className="text-3xl font-extrabold text-level6 m-0">요약 보기</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="flex flex-col w-14 h-15 px-1 rounded border bg-warning/70 border-warning text-black hover:text-white hover:bg-warning-dark/70 transition-all flex items-center justify-center"
            onClick={handleDownloadSummary}
            disabled={loading || !summary}
          >
            <span className="text-lg">📥</span>
            <span className="text-base">저장</span>
          </button>
          <button
            className="flex flex-col w-14 h-15 px-1 rounded border bg-main/70 border-blue-600 text-white hover:bg-blue-700/70 transition-all flex items-center justify-center"
            onClick={() => navigate("/")}
          >
            <span className="text-lg">🏠</span>
            <span className="text-base">목록</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-9 h-9 border-2 border-gray/20 rounded-full border-t-main animate-spin"></div>
          </div>
        ) : summary ? (
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              {summary.favicon && (
                <img
                  src={summary.favicon}
                  alt={summary.title}
                  className="w-12 h-12 object-cover rounded-lg mb-3"
                />
              )}
              <h2 className="text-3xl font-semibold mb-3">{summary.title}</h2>
            </div>
            <div className="text-gray-600 mb-4">
              <a
                href={summary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                원본 페이지 보기
              </a>
            </div>
            <div className="prose max-w-none text-base">
              <CustomReactMarkdown>{summary?.summaryContent || ""}</CustomReactMarkdown>
            </div>
          </div>
        ) : (
          // summary가 없고 로딩도 아닌 경우 (예: 요약 ID는 있으나 해당 요약이 없는 경우, useEffect에서 처리되지만 만약을 위함)
          <div className="flex justify-center items-center h-full">
            <p>요약 정보를 불러올 수 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
