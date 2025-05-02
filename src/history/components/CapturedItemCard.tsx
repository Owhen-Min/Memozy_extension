import { CapturedItem, ImageContent } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useEffect, useRef } from 'react';
import TurndownService from 'turndown';
import { tablePlugin } from '../../utils/tablePlugin';
import { codeBlockPlugin } from '../../utils/codeBlockPlugin';
import { listPlugin } from '../../utils/listPlugin';

interface CapturedItemCardProps {
  item: CapturedItem;
  onDelete: (id: number) => void;
  onDownload: (item: CapturedItem) => void;
  onEdit: (item: CapturedItem, newContent: string) => void;
  showUrl?: boolean;
}

const CapturedItemCard: React.FC<CapturedItemCardProps> = ({ 
  item, 
  onDelete, 
  onDownload,
  onEdit,
  showUrl = true // 기본값은 true
}) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const groupContainerRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(() => typeof item.content === 'string' ? item.content : '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Instantiate TurndownService within the component or globally if preferred
  const turndownService = new TurndownService({
    headingStyle: 'atx', // Optional: Use '#' for headings
    hr: '---',           // Optional: Use '---' for horizontal rules
    bulletListMarker: '*', // Optional: Use '*' for unordered lists
    codeBlockStyle: 'fenced', // Optional: Use ``` for code blocks
    emDelimiter: '*',    // Optional: Use '*' for emphasis
    strongDelimiter: '**', // Optional: Use '**' for strong emphasis
    linkStyle: 'inlined' // Optional: Use inline links
  });
  turndownService.use(tablePlugin);
  turndownService.use(codeBlockPlugin);
  turndownService.use(listPlugin);

  useEffect(() => {
    // 컴포넌트 마운트 시 부모 그룹 컨테이너 찾기
    if (cardRef.current) {
      groupContainerRef.current = cardRef.current.closest('.group-container');
    }

    const handleScroll = () => {
      if (groupContainerRef.current) {
        const scrollTop = groupContainerRef.current.scrollTop;
        setShowScrollButton(scrollTop > 200); // 200px 이상 스크롤 되었을 때 버튼 표시
      }
    };

    const container = groupContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editContent]);

  const scrollToTop = () => {
    if (groupContainerRef.current) {
      groupContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // 날짜 포맷팅
  const formatDate = (date: Date | string | any): string => {
    // 빈 객체인 경우 현재 시간 사용
    if (date && typeof date === 'object' && Object.keys(date).length === 0) {
      return '날짜 정보 없음';
    }
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '날짜 정보 없음';
    }
    return d.toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  
   
  // 내용 렌더링
  const renderContent = () => {
    switch (item.type) {
      case 'text':
      case 'html': // Also handle 'html' type if it exists
        let markdownContent = '';
        if (typeof item.content === 'string') {
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
            <div className="prose prose-slate dark:prose-invert max-w-none overflow-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 코드 블록 커스텀 렌더링
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec((className || '').trim());
                    // Don't pass DOM element props to SyntaxHighlighter component
                    const { ref, ...syntaxProps } = props as any;
                    
                    return match ? (
                      <div className="rounded-md overflow-hidden my-4">
                        <SyntaxHighlighter
                          style={oneLight}
                          language={match[1]}
                          showLineNumbers={true}
                          PreTag="div"
                          {...syntaxProps}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code 
                        className={`${className} text-red-500 bg-gray-200 px-1 rounded text-sm font-mono`} 
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  // 테이블 커스텀 렌더링
                  table({ node, ...props }) {
                    return (
                      <div className="overflow-x-auto my-8 rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200" {...props} />
                      </div>
                    );
                  },
                  // 테이블 헤더 커스텀 렌더링
                  thead({ node, ...props }) {
                    return (
                      <thead className="bg-gray-50" {...props} />
                    );
                  },
                  // 테이블 헤더 셀 커스텀 렌더링
                  th({ node, ...props }) {
                    return (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider" 
                        {...props} 
                      />
                    );
                  },
                  // 테이블 바디 셀 커스텀 렌더링
                  td({ node, ...props }) {
                    return (
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm text-black" 
                        {...props} 
                      />
                    );
                  },
                  // 인용 블록 커스텀 렌더링
                  blockquote({ node, ...props }) {
                    return (
                      <blockquote 
                        className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic my-6 text-gray-600 dark:text-gray-400" 
                        {...props} 
                      />
                    );
                  }
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          </div>
        );
        
      case 'image':
        const imgContent = item.content as ImageContent;
        return (
          <div className="card-content type-image">
            <img 
              src={imgContent.dataUrl} 
              alt="캡처된 이미지" 
              title={item.pageTitle} 
            />
          </div>
        );
        
      default:
        return (
          <div className="card-content">
            지원되지 않는 콘텐츠 타입입니다.
          </div>
        );
    }
  };
  
  const handleEditSubmit = () => {
    if (typeof item.content === 'string') {
        onEdit(item, editContent);
        setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditContent(typeof item.content === 'string' ? item.content : '');
    setIsEditing(false);
  };

  return (
    <div ref={cardRef} className="card flex flex-col gap-2 border-b border-light-gray pb-2">
      <div className="card-header flex h-18 justify-between items-center sticky top-18 bg-white z-10 py-2 border-b border-light-gray">
        <div className="flex gap-2">
          <span className="timestamp text-base">
            {formatDate(item.timestamp)}
          </span>
          <span className="item-type text-base">
            {item.type === 'text' ? '텍스트' : 
            item.type === 'image' ? '이미지' : '알 수 없음'}
          </span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onDownload(item)}
            className="bg-main text-white border-0 py-2 px-4 rounded hover:bg-blue-700 transition-colors font-medium text-sm"
            title="다운로드"
          >
            다운로드
          </button>

          <button 
            onClick={() => {
              setIsEditing(true);
              setEditContent(typeof item.content === 'string' ? item.content : '');
            }}
            className="bg-blue-500 text-white border-0 py-2 px-4 rounded hover:bg-blue-600 transition-colors font-medium text-sm"
            title="수정"
          >
            수정
          </button>
          
          <button 
            onClick={() => onDelete(item.id)}
            className="bg-error text-white border-0 py-2 px-4 rounded hover:bg-red-700 transition-colors font-medium text-sm"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="edit-mode p-4 border-t border-light-gray">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full max-h-[80vh] p-3 border border-gray-300 rounded-md mb-3 text-sm overflow-y-auto resize-none block"
            rows={1}
            aria-label="콘텐츠 수정"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleEditCancel}
              className="bg-gray-200 text-gray-700 border-0 py-2 px-4 rounded hover:bg-gray-300 transition-colors font-medium text-sm"
            >
              취소
            </button>
            <button
              onClick={handleEditSubmit}
              className="bg-blue-500 text-white border-0 py-2 px-4 rounded hover:bg-blue-600 transition-colors font-medium text-sm"
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {renderContent()}

          {showScrollButton && (
            <div className="sticky bottom-4 z-20 flex justify-end px-4 pointer-events-none">
              <button
                onClick={scrollToTop}
                className="bg-main text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors pointer-events-auto"
                title="위로 이동"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CapturedItemCard; 