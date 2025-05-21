import { Message, CapturedItem, Response as ExtensionResponse } from "../types";
import { extractContent } from "@wrtnlabs/web-content-extractor";
import { Readability } from "@mozilla/readability";
import customTurndown from "../lib/turndown/customTurndown";

// NotificationMessage 타입 정의 추가
type NotificationMessage = {
  type: "info" | "warning" | "error";
  message: string;
};

// DOM 이벤트 방식으로 변경 (CSP 우회)
const customEvent = new CustomEvent("memozyExtensionInstalled", { detail: { installed: true } });
document.dispatchEvent(customEvent);

// 또는 MutationObserver로 표시하기
const marker = document.createElement("div");
marker.id = "__memozy_extension_installed";
marker.style.display = "none";
(document.head || document.documentElement).appendChild(marker);

// 페이지에 스크립트가 로드되었음을 알림
document.addEventListener("DOMContentLoaded", () => {
  // 초기 로드 시 5회 시도
  let retryCount = 0;
  const maxRetries = 5;
  const retryInterval = 1000; // 1초

  const sendReadyMessage = () => {
    chrome.runtime.sendMessage({ action: "contentScriptReady" }, (response) => {
      if (chrome.runtime.lastError) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(sendReadyMessage, retryInterval);
        }
      }
    });
  };

  // 첫 번째 시도
  sendReadyMessage();
});

// 안전한 메시지 전송 함수
const sendMessageToBackground = (message: Message): Promise<ExtensionResponse> => {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response: ExtensionResponse | undefined) => {
        if (chrome.runtime.lastError) {
          console.error("[Content Script] 메시지 전송 오류:", chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else if (response === undefined) {
          console.error("[Content Script] 백그라운드 응답 없음 (undefined)");
          reject(new Error("백그라운드 응답 없음"));
        } else if (!response.success) {
          console.error("[Content Script] 메시지 응답 실패:", response.error);
          reject(new Error(response.error || "알 수 없는 오류"));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error("[Content Script] 메시지 전송 중 예외 발생:", error);
      reject(error);
    }
  });
};

// 상태 관리
let isCapturing = false;
let isHtmlMode = true; // 항상 HTML 모드 활성화
let lastCapturedContent: string | null = null;
// Turndown 서비스 인스턴스 생성
const turndownService = customTurndown();

// 확장 설정 상태 초기화
chrome.storage.local.get(["isCapturing"], (result) => {
  isCapturing = result.isCapturing || false;
});

// 스토리지 변경 감지
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isCapturing) {
    isCapturing = changes.isCapturing.newValue;
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // 캡처 상태 변경 메시지
  if (
    message.action === "toggleCapturing" ||
    message.action === "startCapture" ||
    message.action === "stopCapture"
  ) {
    isCapturing = message.isCapturing !== undefined ? message.isCapturing : !isCapturing;
    sendResponse({ success: true, received: true });
    return true;
  }

  // HTML 모드 변경 메시지 - 항상 HTML 모드 유지
  if (message.action === "toggleHtmlMode" || message.action === "updateCapturingState") {
    if (message.isCapturing !== undefined) {
      isCapturing = message.isCapturing;
    }
    sendResponse({ success: true, received: true });
    return true;
  }

  // 전체 HTML 저장 메시지
  if (message.action === "saveFullHtml") {
    try {
      // 현재 페이지 HTML만 저장
      savePageHtml()
        .then((result) => {
          // 결과 상태와 에러 메시지 그대로 전달
          sendResponse({
            success: result.success,
            error: result.error,
          });
        })
        .catch((error) => {
          console.error("페이지 HTML 저장 오류:", error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // 비동기 응답을 위해 true 반환
    } catch (error: any) {
      console.error("HTML 저장 처리 중 오류:", error);
      sendResponse({ success: false, error: error.message });
      return true; // 비동기 응답을 위해 true 반환
    }
  }

  // 저장 완료 메시지 (알림용)
  if (message.action === "savingComplete") {
    try {
      showNotification(message.item as CapturedItem);
      sendResponse({ success: true });
    } catch (error: any) {
      console.error("알림 표시 오류:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 비동기 응답을 위해 true 반환
  }

  // 콘텐츠 스크립트 준비 확인
  if (message.action === "contentScriptCheck") {
    sendResponse({
      success: true,
      ready: true,
      isCapturing: isCapturing,
      isHtmlMode: isHtmlMode,
    });
    return true; // 비동기 응답을 위해 true 반환
  }

  // 기본 응답
  sendResponse({ success: false, error: "처리되지 않은 메시지 형식" });
  return true; // 비동기 응답을 위해 true 반환
});

// 요소의 고유한 CSS 선택자 경로 생성 함수
function getDomPath(node: Node): string {
  let element: Element | null = null;

  // 노드가 Element 타입이면 바로 사용, 아니면 부모 Element를 찾음
  if (node.nodeType === Node.ELEMENT_NODE) {
    element = node as Element;
  } else if (node.parentElement) {
    element = node.parentElement;
  }

  // 유효한 Element를 찾지 못하면 빈 문자열 반환
  if (!element) return "";

  const path: string[] = [];
  let currentElement: Element | null = element;

  while (currentElement && currentElement.nodeType === Node.ELEMENT_NODE) {
    let selector = currentElement.nodeName.toLowerCase();
    if (currentElement.id) {
      // ID가 있으면 #id 사용하고 경로 생성 종료
      selector += `#${CSS.escape(currentElement.id)}`; // CSS.escape로 특수 문자 처리
      path.unshift(selector);
      break;
    } else {
      // ID가 없으면 형제 요소 중 순서 계산 (nth-of-type)
      let sibling = currentElement;
      let nth = 1;
      // previousElementSibling으로 같은 타입의 형제만 카운트
      while ((sibling = sibling.previousElementSibling!) != null) {
        if (sibling.nodeName.toLowerCase() === selector) nth++;
      }
      // 첫 번째 요소가 아니면 :nth-of-type 추가
      if (nth != 1) {
        selector += `:nth-of-type(${nth})`;
      }
    }
    path.unshift(selector);
    // 부모 요소로 이동
    currentElement = currentElement.parentElement;
  }
  // 배열을 ' > '로 연결하여 최종 경로 반환
  return path.join(" > ");
}

// 드래그 이벤트 처리 수정
document.addEventListener("mouseup", async (e) => {
  if (!isCapturing) return;

  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // 이미 저장된 동일한 텍스트가 있는지 확인
    if (lastCapturedContent === selectedText) {
      // 백그라운드에서 중복 응답을 받은 것처럼 직접 처리
      showNotification({ type: "info", message: "이미 저장된 콘텐츠입니다." });
      return;
    }

    lastCapturedContent = selectedText;

    // 선택된 범위의 HTML 가져오기
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement("div");
    tempDiv.appendChild(fragment);
    const htmlContent = tempDiv.innerHTML;

    // HTML을 마크다운으로 변환
    let markdownContent: string;
    try {
      markdownContent = turndownService.turndown(htmlContent);
    } catch (error) {
      console.error("HTML 마크다운 변환 오류:", error);
      markdownContent = selectedText; // 변환 실패 시 원본 텍스트 사용
    }

    // 선택된 범위의 시작점(commonAncestorContainer)을 기준으로 DOM 경로 생성
    const commonAncestor = range.commonAncestorContainer;
    const domPath = getDomPath(commonAncestor);

    // 현재 사이트의 favicon URL 가져오기
    const faviconUrl = getFaviconUrl();

    // Send HTML and Markdown to background
    try {
      await sendMessageToBackground({
        action: "contentCaptured",
        type: "text",
        content: htmlContent, // Original HTML
        markdownContent: markdownContent, // Added markdown content
        meta: {
          originalType: "html",
          domPath: domPath,
          favicon: faviconUrl,
        },
      });
    } catch (error) {
      console.error("텍스트 저장 요청 실패:", error);
    }
  } catch (error) {
    console.error("텍스트 처리 오류:", error);
  }
});

// 이미지 드래그 처리
document.addEventListener("dragstart", async (e) => {
  if (!isCapturing) return;

  try {
    const target = e.target as HTMLElement;

    // 이미지 드래그 감지
    if (target.tagName === "IMG") {
      const imgElement = target as HTMLImageElement;
      if (!imgElement.src) return;

      // 이미지를 Data URL로 변환
      const canvas = document.createElement("canvas");
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        console.error("캔버스 컨텍스트를 가져올 수 없음");
        return;
      }

      // 이미지 그리기 및 데이터 URL 가져오기
      context.drawImage(imgElement, 0, 0);
      let dataUrl: string;

      try {
        dataUrl = canvas.toDataURL("image/png");
      } catch (error) {
        console.error("이미지 데이터 URL 변환 오류:", error);
        // 오류 발생 시 원본 이미지 URL 사용
        dataUrl = imgElement.src;
      }

      // 이미지 파일 이름 추출
      const imgNameMatch = imgElement.src.match(/([^/]+)\.(?:jpe?g|png|gif|bmp|webp)(?:\?.*)?$/i);
      const imgName = imgNameMatch ? imgNameMatch[1] : `image-${Date.now()}`;

      // 현재 사이트의 favicon URL 가져오기
      const faviconUrl = getFaviconUrl();

      // 안전한 메시지 전송 함수 사용
      try {
        await sendMessageToBackground({
          action: "contentCaptured",
          type: "image",
          content: {
            dataUrl: dataUrl,
            type: "image/png",
            name: `${imgName}.png`,
          },
          meta: {
            format: "png",
            favicon: faviconUrl,
          },
        });
      } catch (error) {
        console.error("이미지 저장 실패:", error);
      }
    }
  } catch (error) {
    console.error("이미지 처리 오류:", error);
  }
});

// 알림 표시 함수
// showNotification 함수 수정 (메시지 타입 처리 추가)
function showNotification(itemOrMessage: CapturedItem | NotificationMessage) {
  let container = document.getElementById("drag-save-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "drag-save-notification-container";
    Object.assign(container.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "99999",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "10px",
      maxWidth: "300px",
    });
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  let message = "";
  let bgColor = "";
  let isError = false;

  if ("message" in itemOrMessage) {
    // NotificationMessage 타입
    message = itemOrMessage.message;
    switch (itemOrMessage.type) {
      case "info":
        bgColor = "linear-gradient(135deg, #607D8B, #455A64)";
        break;
      case "warning":
        bgColor = "linear-gradient(135deg, #FFC107, #FFA000)";
        break;
      case "error":
        bgColor = "linear-gradient(135deg, #F44336, #D32F2F)";
        isError = true;
        break;
      default:
        bgColor = "linear-gradient(135deg, #607D8B, #455A64)";
    }
  } else {
    // CapturedItem 타입
    switch (itemOrMessage.type) {
      case "text":
        message = "콘텐츠가 저장되었습니다.";
        bgColor = "linear-gradient(135deg, #4CAF50, #388E3C)";
        break;
      case "image":
        message = "이미지가 저장되었습니다.";
        bgColor = "linear-gradient(135deg, #2196F3, #1976D2)";
        break;
      case "error":
        message = itemOrMessage.meta?.errorMessage || "알 수 없는 오류로 저장되었습니다.";
        bgColor = "linear-gradient(135deg, #F44336, #D32F2F)";
        isError = true;
        break;
      default:
        message = "콘텐츠가 저장되었습니다.";
        bgColor = "linear-gradient(135deg, #9C27B0, #7B1FA2)";
    }
  }

  Object.assign(notification.style, {
    padding: "12px 16px",
    background: bgColor,
    color: "white",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    marginBottom: "10px",
    fontSize: "14px",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: "500",
    opacity: "0",
    transform: "translateX(20px)",
    transition: "opacity 0.3s ease, transform 0.3s ease",
    position: "relative",
    maxWidth: "100%",
  });
  notification.textContent = message;
  container.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";
  }, 10);
  setTimeout(
    () => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(20px)";
      setTimeout(() => {
        notification.remove();
      }, 300);
    },
    isError ? 5000 : 3000
  ); // 에러는 5초, 나머지는 3초
}
const getFaviconUrl = () => {
  // 우선 link[rel="icon"] 또는 link[rel*="icon"]을 찾음
  const iconLink = document.querySelector('link[rel="icon"], link[rel*="icon"]') as HTMLLinkElement;
  if (iconLink && iconLink.href) return iconLink.href;
  // 없으면 기본 favicon 경로 시도
  return `${location.origin}/favicon.ico`;
};

// 현재 페이지의 HTML 저장 후 텍스트 추출
async function savePageHtml(): Promise<{ success: boolean; error?: string }> {
  try {
    let html: string | null = null;
    const hostname = window.location.hostname;

    // 사이트별 HTML 컨텐츠 추출 로직
    if (hostname.endsWith("blog.naver.com")) {
      const iframe = document.body.querySelector("iframe");
      if (iframe && iframe.src) {
        const iframeSrc = iframe.src;
        try {
          const response = await sendMessageToBackground({
            action: "fetchIframeContent",
            url: iframeSrc,
          });

          if (response && response.html) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(response.html, "text/html");
              const wholeBodyDiv = doc.getElementById("postListBody");

              if (wholeBodyDiv) {
                html = wholeBodyDiv.outerHTML;
              }
            } catch (parseError) {
              console.error("HTML 파싱 오류:", parseError);
            }
          }
        } catch (error) {
          console.error("네이버 블로그 iframe 처리 오류:", error);
        }
      }
    } else if (hostname.endsWith("velog.io")) {
      const content = document.querySelector(".atom-one");
      if (content) {
        html = content.outerHTML;
      } else {
        return { success: false, error: "벨로그 글 안에서 저장 버튼을 눌러주세요." };
      }
    } else if (hostname.endsWith(".tistory.com")) {
      const content = document.querySelector(".tt_article_useless_p_margin");
      if (content) {
        html = content.outerHTML;
      }
    } else if (hostname.endsWith("brunch.co.kr")) {
      const content = document.querySelector(".wrap_view_article");
      if (content) {
        html = content.outerHTML;
      } else {
        return { success: false, error: "브런치 글 안에서 저장 버튼을 눌러주세요." };
      }
    } else if (hostname.endsWith("chatgpt.com")) {
      const contents = document.querySelectorAll(".prose");
      if (contents) {
        html = Array.from(contents)
          .map((content) => content.outerHTML)
          .join("\n\n");
      } else {
        return {
          success: false,
          error: "ChatGPT 콘텐츠를 특정하지 못했습니다. 드래그로 선택해주세요.",
        };
      }
    } else if (hostname.endsWith("perplexity.ai")) {
      const contents = document.querySelectorAll("div.prose p");
      if (contents) {
        html = Array.from(contents)
          .map((content) => content.outerHTML)
          .join("\n\n");
      } else {
        return {
          success: false,
          error: "Perplexity.ai의 답변 콘텐츠를 특정하지 못했습니다. 드래그로 선택해주세요.",
        };
      }
    } else if (hostname == "namu.wiki") {
      const rootContents = document.querySelectorAll("div[data-v-d16cf66c]");
      if (rootContents && rootContents.length > 0) {
        // 가장 안쪽의 콘텐츠만 수집하는 함수
        const getInnermostContents = (element: Element): Element[] => {
          // tbody[data-v-d16cf66c] 요소는 무시
          if (element.tagName === "TBODY" && element.hasAttribute("data-v-d16cf66c")) {
            return [];
          }

          // 현재 요소의 직계 자식들 가져오기
          const directChildren = Array.from(element.children);

          // tbody[data-v-d16cf66c] 요소 필터링
          const filteredChildren = directChildren.filter(
            (child) => !(child.tagName === "TBODY" && child.hasAttribute("data-v-d16cf66c"))
          );

          // 직계 자식들이 모두 data-v-d16cf66c를 가진 div인지 확인
          const hasOnlyDataVDivs = filteredChildren.some(
            (child) => child.tagName === "DIV" && child.hasAttribute("data-v-d16cf66c")
          );

          return hasOnlyDataVDivs ? [] : [element];
        };

        // 모든 루트 요소들에 대해 가장 안쪽 콘텐츠 수집
        const contents = Array.from(rootContents)
          .flatMap((root) => getInnermostContents(root))
          .map((content) => content.outerHTML);

        html = contents.join("\n\n");
      }
    } else if (hostname.startsWith("notion.so") || hostname.startsWith("euid.notion.site")) {
      const content = document.querySelectorAll(".layout-content");
      if (content) {
        html = Array.from(content)
          .map((content) => content.outerHTML)
          .join("\n\n");
      }
    }

    if (!html) {
      try {
        const doctype = document.doctype
          ? new XMLSerializer().serializeToString(document.doctype)
          : "";
        const article = new Readability(
          new DOMParser().parseFromString(doctype + document.documentElement.outerHTML, "text/html")
        ).parse();
        if (article?.content) {
          html = article.content;
        } else {
          const contentHtmls = extractContent(
            doctype + document.documentElement.outerHTML
          ).contentHtmls;
          html = contentHtmls.join("\n");
        }
      } catch (extractError) {
        console.error("HTML 추출 중 오류:", extractError);
        html = document.documentElement.outerHTML;
        if (!html) {
          showNotification({
            id: 0,
            type: "error",
            pageTitle: "",
            pageUrl: "",
            timestamp: new Date(),
            content: "",
            markdownContent: "",
            meta: { errorMessage: "HTML 콘텐츠를 추출할 수 없습니다." },
          });
          return { success: false, error: "HTML 콘텐츠를 추출할 수 없습니다." };
        }
      }
    }

    if (!html) {
      let errorMsg = "콘텐츠를 찾을 수 없습니다.";
      showNotification({
        id: 0,
        type: "error",
        pageTitle: "",
        pageUrl: "",
        timestamp: new Date(),
        content: "",
        markdownContent: "",
        meta: { errorMessage: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    // HTML을 마크다운으로 변환
    let markdownContent: string;
    try {
      markdownContent = turndownService.turndown(html);
    } catch (error) {
      console.error("전체 페이지 HTML 마크다운 변환 오류:", error);
      markdownContent = ""; // 변환 실패 시 빈 문자열
    }

    const faviconUrl = getFaviconUrl();
    const response: ExtensionResponse = await sendMessageToBackground({
      action: "contentCaptured",
      type: "text",
      content: html,
      markdownContent: markdownContent, // 추가: 마크다운 콘텐츠
      meta: { originalType: "html", saveType: "full", favicon: faviconUrl },
    });

    // 응답 처리 및 알림 표시 (옵셔널 체이닝 사용)
    if (response && response.success) {
      // response 존재 및 success 확인
      if (response.status === "skipped_duplicate" && response.message) {
        // 중복 건너뛰기 알림 (정보)
        showNotification({ type: "info", message: response.message });
      } else if (response.status === "item_updated" && response.message) {
        // 업데이트 완료 알림 (경고/주황색 스타일)
        showNotification({ type: "warning", message: response.message });
      } else if (response.status === "ok") {
      }
      // savingComplete 메시지는 background에서 별도로 보내므로 여기서 성공 알림을 직접 띄우지 않음
      return { success: true }; // 작업 요청 자체는 성공
    } else {
      // 실패 응답 처리 (옵셔널 체이닝 사용)
      const errorMsg = response?.error || "알 수 없는 오류로 저장에 실패했습니다.";
      showNotification({ type: "error", message: errorMsg });
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    // sendMessageToBackground 자체에서 reject된 경우
    console.error("HTML 저장 중 오류:", error);
    showNotification({ type: "error", message: error.message || "HTML 저장 중 오류 발생" });
    return { success: false, error: error.message || "HTML 저장 중 오류가 발생했습니다" };
  }
}
