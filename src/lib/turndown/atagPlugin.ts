import TurndownService from "turndown";

export function atagPlugin(turndownService: TurndownService) {
  turndownService.addRule("handleLinksWithImages", {
    filter: "a",
    replacement: function (content, nodeEl) {
      const node = nodeEl as HTMLAnchorElement;
      const href = node.getAttribute("href");

      if (href && (href.startsWith("/") || href.startsWith("./") || href.startsWith("../"))) {
        return content; // 상대 경로는 내용만 남김
      }

      if (href && href.startsWith("#")) {
        return ""; // 내부 앵커 링크는 제거
      }

      if (href) {
        // content에 width/height 속성을 가진 HTML img 태그가 포함되어 있는지 확인
        const containsSizedHtmlImage =
          content.includes("<img") && (content.includes(" width=") || content.includes(" height="));

        if (containsSizedHtmlImage) {
          // HTML <a> 태그로 유지
          let attrs = "";
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            attrs += ` ${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`;
          }
          return `<a${attrs}>${content}</a>`;
        } else {
          // 일반 마크다운 링크로 변환, 링크 텍스트 내 개행문자 처리
          const linkText = content.replace(/\n+/g, " ").trim();
          return `[${linkText}](${href})`;
        }
      }

      return content; // href가 없는 경우 등, 기본적으로 내용 반환
    },
  });
}
