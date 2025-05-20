import { useState, useEffect } from "react";
import { CapturedItem, ImageContent } from "../../types";
import SummaryComparisonModal from "./SummaryComparisonModal";
import customTurndown from "../../lib/turndown/customTurndown";
import { useModal } from "../../context/ModalContext";

interface CreateSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    selectedItems: CapturedItem[],
    summaryContent: string,
    summaryType: "markdown" | "ai",
    summaryId: string
  ) => void;
  items: CapturedItem[]; // 해당 URL의 전체 아이템 목록
  pageUrl: string;
  pageTitle: string;
}

export default function CreateSummaryModal({
  isOpen,
  onClose,
  onSubmit,
  items,
  pageUrl,
  pageTitle,
}: CreateSummaryModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [markdownContent, setMarkdownContent] = useState("");
  const [selectedItems, setSelectedItems] = useState<CapturedItem[]>([]);
  const { openModal, closeModal } = useModal();

  // TurndownService 초기화
  const turndownService = customTurndown();

  // 모달이 열릴 때 모든 아이템을 기본으로 선택
  useEffect(() => {
    if (isOpen) {
      setSelectedItemIds(new Set(items.map((item) => item.id)));
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const handleCheckboxChange = (itemId: number) => {
    setSelectedItemIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItems = items.filter((item) => selectedItemIds.has(item.id));
    if (selectedItems.length === 0) {
      openModal(
        <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 relative">
          <h1 className="text-2xl font-bold text-center mb-4">정말로 삭제하시겠습니까?</h1>

          <button
            onClick={() => closeModal()}
            className="bg-gray-500 text-lg text-white px-4 py-2 rounded-md"
          >
            취소
          </button>
        </div>,
        { closeable: true }
      );
      return;
    }

    // 선택된 항목들을 Markdown으로 변환
    const markdownParts = selectedItems.map((item) => {
      if (item.type === "image") {
        return `![캡처된 이미지](${(item.content as ImageContent).dataUrl})\\n`;
      } else if (typeof item.content === "string") {
        return turndownService.turndown(item.content);
      }
      return "";
    });

    setMarkdownContent(markdownParts.join("\\n---\\n"));
    setSelectedItems(selectedItems);
    setIsComparisonModalOpen(true);
  };

  const handleSummarySelection = async (
    summaryContent: string,
    summaryType: "markdown" | "ai",
    summaryId: string
  ) => {
    setIsComparisonModalOpen(false);
    onSubmit(selectedItems, summaryContent, summaryType, summaryId);
    onClose();
  };

  // 간단한 콘텐츠 미리보기 함수
  const renderContentPreview = (item: CapturedItem) => {
    if (item.type === "image") {
      const imgContent = item.content as ImageContent;
      const imageUrl = imgContent.dataUrl;

      return (
        <div className="relative bg-gray-100 rounded">
          <img
            src={imageUrl}
            alt="캡처된 이미지"
            className="max-h-16 max-w-full object-contain my-1"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.nextElementSibling?.classList.remove("hidden");
            }}
          />
          <p className="text-sm text-gray-500 italic hidden text-center py-2">
            이미지 미리보기 불가
          </p>
        </div>
      );
    } else if (typeof item.content === "string") {
      // HTML 태그 제거 및 &nbsp;를 공백으로 치환
      const textContent = item.content.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ");
      return (
        <p className="text-sm text-gray-600 line-clamp-2 break-words">
          {textContent || "(내용 없음)"}
        </p>
      );
    }
    return <p className="text-sm text-gray-500 italic">(미리보기 불가)</p>;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold mb-4 flex-shrink-0">요약할 항목 선택</h2>
          <p className="text-sm text-gray-600 mb-4 flex-shrink-0">
            요약에 포함할 캡처 항목을 선택해주세요.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
            <div className="mb-4 flex-grow overflow-y-auto overflow-x-hidden space-y-3 pr-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start p-3 border rounded ${
                    selectedItemIds.has(item.id)
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={() => handleCheckboxChange(item.id)}
                    className="mr-3 mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    id={`item-${item.id}`}
                  />
                  <label htmlFor={`item-${item.id}`} className="flex-1 cursor-pointer">
                    <span
                      className={`font-medium ${
                        selectedItemIds.has(item.id) ? "text-blue-800" : "text-gray-800"
                      }`}
                    >
                      {item.type === "text" ? "텍스트" : item.type === "image" ? "이미지" : "기타"}
                    </span>
                    {renderContentPreview(item)}
                  </label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 flex-shrink-0 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-main text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={selectedItemIds.size === 0}
              >
                선택 완료 및 요약 생성 ({selectedItemIds.size})
              </button>
            </div>
          </form>
        </div>
      </div>

      <SummaryComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        onSubmit={handleSummarySelection}
        markdownContent={markdownContent}
        pageUrl={pageUrl}
        pageTitle={pageTitle}
      />
    </>
  );
}
