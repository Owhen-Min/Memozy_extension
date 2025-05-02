import TurndownService from 'turndown';
import { extractContent } from '@wrtnlabs/web-content-extractor';

export function codeBlockPlugin(turndownService: TurndownService) {
  turndownService.addRule('codeblock', {
    filter: function(node) {
      // pre 태그 체크
      if (node.nodeName === 'PRE') {
        return true;
      }
      
      return false;
    },
    replacement: function(content, node) {
      try {
        // 언어 추출 - 다양한 방법 시도
        let language = 'plaintext';
        
        // 1. data-language 속성 확인
        const preElement = node as HTMLElement;
        const codeElement = preElement.querySelector('code');
        if (codeElement) {
          const dataLanguage = codeElement.getAttribute('data-language');
          if (dataLanguage) {
            language = dataLanguage.toLowerCase();
          }
        }
        
        // 2. div에 있는 언어 정보 확인
        const languageDiv = preElement.querySelector('div');
        if (languageDiv && languageDiv.textContent && language === 'plaintext') {
          const langText = languageDiv.textContent.trim().toLowerCase();
          if (langText.match(/^(python|javascript|java|cpp|c\+\+|c#|ruby|go|swift|kotlin|rust|c)$/)) {
            language = langText;
            // 특수 케이스 처리
            if (language === 'c++') language = 'cpp';
            if (language === 'c#') language = 'csharp';
          }
        }
        
        // 3. 클래스에서 언어 정보 추출
        if (codeElement && language === 'plaintext') {
          const className = codeElement.getAttribute('class') || '';
          
          // language- 패턴 확인
          const languageMatch = className.match(/language-(\w+)/);
          if (languageMatch) language = languageMatch[1];
          
          // hljs 패턴 확인
          const hljsMatch = className.match(/hljs\s+(\w+)/);
          if (hljsMatch) language = hljsMatch[1];
          
          // 다른 언어 패턴 확인
          if (language === 'plaintext') {
            if (className.includes('python')) language = 'python';
            else if (className.includes('javascript') || className.includes('js')) language = 'javascript';
            else if (className.includes('cpp') || className.includes('c++')) language = 'cpp';
            else if (className.includes('csharp') || className.includes('c#')) language = 'csharp';
            else if (className.includes('java') && !className.includes('javascript')) language = 'java';
          }
        }
        
        // 코드 내용 추출
        let codeText = '';
        
        // code 요소 직접 찾기
        const innerCode = preElement.querySelector('code');
        if (innerCode) {
          // div 기반 줄바꿈 처리
          const lineDivs = innerCode.querySelectorAll('div');
          // table 기반 줄바꿈 처리 (hljs-ln)
          const tableRows = innerCode.querySelectorAll('table.hljs-ln > tbody > tr');

          if (lineDivs.length > 0) {
            // 각 div의 텍스트 내용을 추출하여 줄바꿈으로 연결
            codeText = Array.from(lineDivs)
              .map(div => {
                // span 태그들의 텍스트를 순서대로 합침
                const spans = div.querySelectorAll('span');
                return Array.from(spans)
                  .map(span => span.textContent || '')
                  .join('');
              })
              .join('\\n');
          } else if (tableRows.length > 0) {
            // 각 tr에서 hljs-ln-code 클래스를 가진 td의 내용을 추출
            codeText = Array.from(tableRows)
              .map(tr => {
                const codeCell = tr.querySelector('td.hljs-ln-code');
                // td 요소의 textContent를 직접 사용
                return codeCell ? (codeCell.textContent || '') : '';
              })
              .join('\n'); // 줄바꿈 문자로 합침
          } else {
            // 기존 방식으로 처리 (div나 table 구조가 없을 때)
            const originalText = innerCode.textContent || '';
            const lines = originalText.split('\n')
              .filter(line => line.length > 0 || line.includes('\n'));
            codeText = lines.join('\n');
          }
        } else {
          // pre에 직접 텍스트가 있는 경우
          codeText = preElement.textContent || '';
        }
        
        // HTML 엔티티 디코딩
        codeText = codeText
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/\\#/g, '#')  // 이스케이프된 # 문자 처리
          .replace(/\\\[/g, '[')  // 이스케이프된 [ 문자 처리
          .replace(/\\\]/g, ']'); // 이스케이프된 ] 문자 처리
        
        // 줄바꿈 정규화
        codeText = codeText.replace(/\r\n/g, '\n');
        
        // 결과 반환
        return '\n\n```' + language + '\n' + codeText.trim() + '\n```\n\n';
      } catch (error) {
        console.error('코드 블록 처리 오류:', error);
        // 오류 발생 시 원본 컨텐츠 반환
        return '\n```\n' + content + '\n```\n';
      }
    }
  });
} 