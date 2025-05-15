import { useState, useEffect } from "react";
import CustomReactMarkdown from "../../lib/react-markdown/CustomReactMarkdown";
import { useApiQuery, useApiMutation } from "../../hooks/useApi";
import { SummarySourceRequest, SummarySourceResponse } from "../../types/summary";

interface SummaryComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (summaryContent: string, summaryType: "markdown" | "ai", summaryId: string) => void;
  markdownContent: string;
  pageUrl: string;
  pageTitle: string;
}

export default function SummaryComparisonModal({
  isOpen,
  onClose,
  onSubmit,
  markdownContent,
  pageUrl,
  pageTitle,
}: SummaryComparisonModalProps) {
  const [aiSummary, setAiSummary] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"markdown" | "ai">("markdown");
  const [savedSourceId, setSavedSourceId] = useState<string>("");

  // API mutation 설정
  const { mutate: generateSummary, isPending: isLoading } = useApiMutation<
    SummarySourceResponse,
    SummarySourceRequest
  >("/quiz-source/summary", {
    onSuccess: (data) => {
      if (data.data) {
        setAiSummary(data.data);
      } else {
        window.alert("요약 생성 중 오류 발생:" + data.errorMsg);
      }
    },
    onError: (error) => {
      window.alert("요약 생성 중 오류 발생:" + error);
    },
  });

  // 기존 요약 가져오기
  const { refetch: fetchExistingSummary } = useApiQuery<SummarySourceResponse>(
    ["quiz-source", savedSourceId],
    `/quiz-source/summary/${savedSourceId}`,
    {
      enabled: false, // 자동 실행하지 않고 수동으로 제어
    }
  );

  // savedSourceId가 변경될 때 요약 가져오기
  useEffect(() => {
    if (savedSourceId) {
      fetchExistingSummary().then((result) => {
        if (result.data?.data) {
          onSubmit(result.data.data, "markdown", savedSourceId);
          window.alert("기존에 저장된 요약이 있습니다. 해당 요약을 불러옵니다.");
        }
      });
    }
  }, [savedSourceId, fetchExistingSummary]);

  // 저장 API mutation 설정
  const { mutate: saveSummary, isPending: isSaving } = useApiMutation<
    { success: boolean; data: string; errorMsg: string; errorCode: string },
    SummarySourceRequest
  >("/quiz-source", {
    onSuccess: (response) => {
      if (response.success && response.data) {
        onSubmit(
          selectedType === "markdown" ? markdownContent : aiSummary,
          selectedType,
          response.data
        );
      } else {
        if (response.errorCode === "QUIZ_SOURCE400") {
          if (response.errorMsg) {
            // sourceId 추출
            setSavedSourceId(response.errorMsg);
            // fetchExistingSummary는 useEffect에서 자동으로 호출됨
          } else {
            window.alert("저장된 요약의 ID를 찾을 수 없습니다.");
          }
        } else {
          window.alert(response.errorMsg);
        }
      }
    },
    onError: (error) => {
      window.alert("요약 저장 중 오류가 발생했습니다: " + error);
    },
  });

  // 컴포넌트가 마운트되면 자동으로 요약 생성 시작
  useEffect(() => {
    if (isOpen && markdownContent && !aiSummary && !isLoading) {
      generateSummary({
        type: 0,
        title: pageTitle,
        context: markdownContent,
        url: pageUrl,
      });
    }
  }, [isOpen, markdownContent, aiSummary, isLoading, generateSummary, pageTitle, pageUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    const content = selectedType === "markdown" ? markdownContent : aiSummary;
    saveSummary({
      type: 0,
      title: pageTitle,
      context: content,
      url: pageUrl,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-7xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">저장 방식 선택</h2>
        <p className="text-sm text-gray-600 mb-4">
          원하시는 저장 방식을 선택해주세요. 왼쪽은 원본, 오른쪽은 AI가 요약한 내용입니다.
        </p>

        <div className="flex gap-4 flex-grow min-h-0">
          {/* Markdown 변환본 */}
          <div className="w-1/2 flex flex-col" onClick={() => setSelectedType("markdown")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Markdown 변환</h3>
              <button
                className={`px-3 py-1 rounded ${
                  selectedType === "markdown"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                선택
              </button>
            </div>
            <div className="flex-1 border rounded p-4 overflow-y-auto overflow-x-auto bg-gray-50">
              <CustomReactMarkdown>{markdownContent}</CustomReactMarkdown>
            </div>
          </div>

          {/* AI 요약본 */}
          <div className="w-1/2 flex flex-col" onClick={() => setSelectedType("ai")}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">AI 요약</h3>
              <button
                className={`px-3 py-1 rounded ${
                  selectedType === "ai"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setSelectedType("ai")}
              >
                선택
              </button>
            </div>
            <div className="flex-1 border rounded p-4 overflow-y-auto overflow-x-auto bg-gray-50">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-gray-600">요약 생성 중...</span>
                  </div>
                </div>
              ) : (
                <CustomReactMarkdown>{aiSummary.replace(/\\n/g, "\n")}</CustomReactMarkdown>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading || isSaving || (selectedType === "ai" && !aiSummary)}
          >
            {isSaving ? "저장 중..." : "선택된 내용 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
