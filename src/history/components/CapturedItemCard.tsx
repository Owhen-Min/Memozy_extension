import { CapturedItem, ImageContent } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, useEffect, useRef } from 'react';

interface CapturedItemCardProps {
  item: CapturedItem;
  onDelete: (id: number) => void;
  onDownload: (item: CapturedItem) => void;
  showUrl?: boolean; // URL 표시 여부 (옵션)
}

const CapturedItemCard: React.FC<CapturedItemCardProps> = ({ 
  item, 
  onDelete, 
  onDownload,
  showUrl = true // 기본값은 true
}) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (cardRef.current) {
        const container = cardRef.current.closest('.overflow-y-auto');
        if (container) {
          const { top } = cardRef.current.getBoundingClientRect();
          const containerTop = container.getBoundingClientRect().top;
          setShowScrollButton(top - containerTop < -100);
        }
      }
    };

    const container = cardRef.current?.closest('.overflow-y-auto');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    if (cardRef.current) {
      const container = cardRef.current.closest('.overflow-y-auto');
      if (container) {
        container.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
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
  
  
  // 추출된 콘텐츠 렌더링
  const renderExtractedContent = () => {
    if (!item.meta?.extractedContent) return null;
    
    const { content } = item.meta.extractedContent;
    
    if (!content) return null;
    
    return (
      <div className="extracted-content">
        <h4>추출된 콘텐츠</h4>
        <div className="content-section">
          <div className="content-text">{content}</div>
        </div>
      </div>
    );
  };
  
  // 내용 렌더링
  const renderContent = () => {
    switch (item.type) {
      case 'text':
        return (
          <div className="card-content text-sm">
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
                {item.content as string}
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
  
  return (
    <div ref={cardRef} className="card flex flex-col gap-2 my-2 border-b border-light-gray pb-2 relative">
      {showScrollButton && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-10 right-10 bg-main text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
          title="위로 이동"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
      <div className="card-header">
          {showUrl && (
            <div className="card-meta text-base">
              {item.pageUrl}
            </div>
          )}
      </div>
      
      {renderContent()}
      
      <div className="card-footer flex justify-between items-center">
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
            onClick={() => onDelete(item.id)}
            className="bg-error text-white border-0 py-2 px-4 rounded hover:bg-red-700 transition-colors font-medium text-sm"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default CapturedItemCard; 