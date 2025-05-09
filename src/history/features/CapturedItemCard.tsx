import { CapturedItem, ImageContent } from "../../types";
import { useState, useEffect, useRef } from "react";
import customTurndown from "../../lib/turndown/customTurndown";
import CustomReactMarkdown from "../../lib/react-markdown/CustomReactMarkdown";

interface CapturedItemCardProps {
  item: CapturedItem;
  onDelete: (id: number) => void;
  onDownload: (item: CapturedItem) => void;
  onEdit: (item: CapturedItem, newContent: string) => void;
}

const CapturedItemCard: React.FC<CapturedItemCardProps> = ({
  item,
  onDelete,
  onDownload,
  onEdit,
}) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const groupContainerRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(() =>
    typeof item.content === "string" ? item.content : ""
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Instantiate TurndownService within the component or globally if preferred
  const turndownService = customTurndown();

  useEffect(() => {
    // 컴포넌트 마운트 시 부모 그룹 컨테이너 찾기
    if (cardRef.current) {
      groupContainerRef.current = cardRef.current.closest(".group-container");
    }

    const handleScroll = () => {
      if (groupContainerRef.current) {
        const scrollTop = groupContainerRef.current.scrollTop;
        setShowScrollButton(scrollTop > 800); // 800px 이상 스크롤 되었을 때 버튼 표시
      }
    };

    const container = groupContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editContent]);

  const scrollToTop = () => {
    if (groupContainerRef.current) {
      groupContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // 날짜 포맷팅
  const formatDate = (date: Date | string | any): string => {
    // 빈 객체인 경우 현재 시간 사용
    if (date && typeof date === "object" && Object.keys(date).length === 0) {
      return "날짜 정보 없음";
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return "날짜 정보 없음";
    }
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 내용 렌더링
  const renderContent = () => {
    switch (item.type) {
      case "text":
        let markdownContent = "";
        if (typeof item.content === "string") {
          try {
            // Convert HTML content to Markdown on the fly
            markdownContent = turndownService.turndown(item.content);
          } catch (error) {
            console.error("Error converting HTML to Markdown in Card:", error);
            // Fallback: Display raw HTML within a code block or similar
            // For simplicity, just show an error message or the raw HTML
            markdownContent = `\`\`\`html\n${item.content}\n\`\`\``; // Show raw HTML in code block as fallback
          }
        } else {
          markdownContent = "콘텐츠 형식이 올바르지 않습니다.";
        }

        return (
          <div className="card-content relative text-sm">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <CustomReactMarkdown>{markdownContent}</CustomReactMarkdown>
            </div>
          </div>
        );

      case "image":
        const imgContent = item.content as ImageContent;
        return (
          <div className="card-content type-image">
            <img src={imgContent.dataUrl} alt="캡처된 이미지" title={item.pageTitle} />
          </div>
        );

      default:
        return <div className="card-content">지원되지 않는 콘텐츠 타입입니다.</div>;
    }
  };

  const handleEditSubmit = () => {
    if (typeof item.content === "string") {
      onEdit(item, editContent);
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditContent(typeof item.content === "string" ? item.content : "");
    setIsEditing(false);
  };

  return (
    <div ref={cardRef} className="card flex flex-col gap-2 border-b border-light-gray pb-2">
      <div className="card-header flex h-18 justify-between items-center sticky top-18 bg-white z-10 py-2 border-b border-light-gray">
        <div className="flex gap-2">
          <span className="timestamp text-base">{formatDate(item.timestamp)}</span>
          <span className="item-type text-base">
            {item.type === "text" ? "텍스트" : item.type === "image" ? "이미지" : "알 수 없음"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDownload(item)}
            className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1"
            title="다운로드"
          >
            <span className="text-lg">📥</span>
            <span className="text-xs">저장</span>
          </button>

          <button
            onClick={() => {
              setIsEditing(true);
              setEditContent(typeof item.content === "string" ? item.content : "");
            }}
            className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
            title="수정"
          >
            <span className="text-lg">✏️</span>
            <span className="text-xs">수정</span>
          </button>

          <button
            onClick={() => onDelete(item.id)}
            className="flex flex-col text-xs w-[35px] h-[50px] px-1 rounded border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-1"
            title="삭제"
          >
            <span className="text-lg">🗑️</span>
            <span className="text-xs">삭제</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="edit-mode p-4 border-t border-light-gray">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md mb-3 text-sm resize-none block"
            rows={1}
            aria-label="콘텐츠 수정"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleEditCancel}
              className="flex flex-col text-xs w-[60px] h-[40px] px-1 rounded border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center gap-1"
            >
              취소
            </button>
            <button
              onClick={handleEditSubmit}
              className="flex flex-col text-xs w-[60px] h-[40px] px-1 rounded border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-1"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">{renderContent()}</div>
      )}
      {showScrollButton && (
        <div className="sticky bottom-4 z-20 flex justify-end px-4 pointer-events-none">
          <button
            onClick={scrollToTop}
            className="flex flex-col w-[40px] h-[40px] rounded-full border bg-main border-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center"
            title="위로 이동"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default CapturedItemCard;
