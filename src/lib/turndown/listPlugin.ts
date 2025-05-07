import TurndownService from "turndown";
import { extractContent } from "@wrtnlabs/web-content-extractor";

export function listPlugin(turndownService: TurndownService) {
  // 리스트 내부의 블록 요소(div)를 텍스트로 처리하기 위한 특수 규칙
  turndownService.addRule("divInList", {
    filter: function (node) {
      // li 내부의 div만 처리
      if (node.nodeName !== "DIV") return false;
      const parent = node.parentNode;
      return !!parent && parent.nodeName === "LI";
    },
    replacement: function (content, node, options) {
      // div 내용을 그대로 반환하여 리스트 구조에 영향을 주지 않음
      return content;
    },
  });

  // ul 태그 처리
  turndownService.addRule("unorderedList", {
    filter: "ul",
    replacement: function (content, node) {
      // 중첩 리스트 들여쓰기 처리
      let prefix = "* ";
      let parent = node.parentNode;
      while (parent && parent.nodeName !== "BODY") {
        if (parent.nodeName === "LI") {
          prefix = "  " + prefix; // 부모가 LI면 들여쓰기 추가
        }
        parent = parent.parentNode;
      }

      // ul 요소의 직접적인 li 자식들만 가져오기
      const listItems = Array.from(node.children).filter((child) => child.nodeName === "LI");

      // 각 li 항목을 수동으로 처리
      const markdownItems = listItems.map((li) => {
        // 내용 추출 (extractContent 함수 사용)
        const htmlContent = li.innerHTML;
        const extracted = extractContent(htmlContent);

        // 추출된 콘텐츠를 마크다운으로 변환
        // extractContent는 객체를 반환하므로 결과의 content 속성 또는 원본 HTML 사용
        const contentToConvert =
          extracted && typeof extracted === "object" && "content" in extracted
            ? extracted.content
            : htmlContent;

        const itemContent = turndownService.turndown(contentToConvert);

        // 접두사 추가 후 반환
        return prefix + itemContent.trim();
      });

      return "\n" + markdownItems.join("\n") + "\n";
    },
  });

  // ol 태그 처리
  turndownService.addRule("orderedList", {
    filter: "ol",
    replacement: function (content, node) {
      let prefix = "1. ";
      let parent = node.parentNode;
      let start = (node as HTMLElement).getAttribute("start") || "1";
      let counter = parseInt(start, 10);

      while (parent && parent.nodeName !== "BODY") {
        if (parent.nodeName === "LI") {
          prefix = "   " + prefix; // 부모가 LI면 들여쓰기 추가 (정렬된 리스트 숫자 고려)
        }
        parent = parent.parentNode;
      }

      // ol 요소의 직접적인 li 자식들만 가져오기
      const listItems = Array.from(node.children).filter((child) => child.nodeName === "LI");

      // 각 li 항목을 수동으로 처리
      const markdownItems = listItems.map((li) => {
        // 현재 접두사 계산
        const currentPrefix = prefix.replace(/^\s*/, "").startsWith("1.") ? `${counter}. ` : prefix;
        const indentedPrefix = prefix.replace(/\d+\.\s*$/, currentPrefix);
        counter++;

        // 내용 추출 (extractContent 함수 사용)
        const htmlContent = li.innerHTML;
        const extracted = extractContent(htmlContent);

        // 추출된 콘텐츠를 마크다운으로 변환
        // extractContent는 객체를 반환하므로 결과의 content 속성 또는 원본 HTML 사용
        const contentToConvert =
          extracted && typeof extracted === "object" && "content" in extracted
            ? extracted.content
            : htmlContent;

        const itemContent = turndownService.turndown(contentToConvert);

        // 접두사 추가 후 반환
        return indentedPrefix + itemContent.trim();
      });

      return "\n" + markdownItems.join("\n") + "\n";
    },
  });

  // 중첩 리스트 내부의 li 항목을 처리하기 위한 규칙은 여전히 필요할 수 있음
  turndownService.addRule("listItem", {
    filter: "li",
    replacement: function (content, node) {
      // 이 규칙은 ul/ol 규칙에서 직접 처리되지 않는 경우에만 사용됨
      // 대부분의 경우 상위 규칙에서 처리되므로 여기서는 간단하게 처리

      // 부모가 ul/ol이 아닌 경우 (예: 특수 목록)에만 실행
      const parent = node.parentNode;
      if (!parent || (parent.nodeName !== "UL" && parent.nodeName !== "OL")) {
        // 내용 추출 (extractContent 함수 사용)
        const htmlContent = (node as HTMLElement).innerHTML;
        const extracted = extractContent(htmlContent);

        // 추출된 콘텐츠를 마크다운으로 변환
        // extractContent는 객체를 반환하므로 결과의 content 속성 또는 원본 HTML 사용
        const contentToConvert =
          extracted && typeof extracted === "object" && "content" in extracted
            ? extracted.content
            : htmlContent;

        return turndownService.turndown(contentToConvert);
      }

      // 표준 리스트의 경우 기본적으로 content를 반환 (상위 규칙에서 처리됨)
      return content;
    },
  });
}
