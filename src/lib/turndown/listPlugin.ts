import TurndownService from "turndown";

export function listPlugin(turndownService: TurndownService) {
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

      // 각 li 항목 앞에 prefix 추가
      const items = content.split("\n").filter((item) => item.trim() !== "");
      const markdownItems = items.map((item) => prefix + item.trim());

      return "\n\n" + markdownItems.join("\n") + "\n\n";
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

      const items = content.split("\n").filter((item) => item.trim() !== "");
      const markdownItems = items.map((item) => {
        const currentPrefix = prefix.replace(/^\s*/, "").startsWith("1.") ? `${counter}. ` : prefix;
        const indentedPrefix = prefix.replace(/\d+\.\s*$/, currentPrefix); // 들여쓰기 유지
        counter++;
        return indentedPrefix + item.trim();
      });

      return "\n\n" + markdownItems.join("\n") + "\n\n";
    },
  });

  // li 태그 처리
  turndownService.addRule("listItem", {
    filter: "li",
    replacement: function (content, node) {
      // 자식 노드의 텍스트만 가져오도록 처리
      let textContent = "";
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          textContent += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // 중첩 리스트가 아닌 다른 요소(예: <p>) 처리
          if (child.nodeName !== "UL" && child.nodeName !== "OL") {
            textContent += (child as HTMLElement).innerText;
          }
        }
      });

      return textContent.trim(); // 앞뒤 공백 제거 후 반환
    },
  });
}
