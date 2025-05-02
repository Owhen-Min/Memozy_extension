import ReactMarkdown, { Options as ReactMarkdownOptions } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// CustomReactMarkdownProps 정의: ReactMarkdownOptions를 확장하고 children을 필수로 만듦
interface CustomReactMarkdownProps extends Omit<ReactMarkdownOptions, 'children'> {
  children: string;
}

const CustomReactMarkdown: React.FC<CustomReactMarkdownProps> = ({ children, ...rest }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // 코드 블록 커스텀 렌더링
        code({ node, className, children: codeChildren, ...props }) {
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
                {String(codeChildren).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code 
              className={`${className} text-red-500 bg-gray-200 px-1 rounded text-sm font-mono`} 
              {...props}
            >
              {codeChildren}
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
        },
        // 다른 커스텀 렌더러가 필요하면 여기에 추가
        ...(rest.components || {}) // 기존 컴포넌트 오버라이드 허용
      }}
      {...rest} // 나머지 props 전달
    >
      {children}
    </ReactMarkdown>
  );
};

export default CustomReactMarkdown; 