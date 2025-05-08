import { DiffDOM } from "diff-dom";
import * as htmlparser from "htmlparser2";
import { CapturedItem, MergeAction, Message, Response, ImageContent, UrlGroup } from "../types";
import { Node as HtmlParserNode, DataNode, Element as HtmlParserElement } from "domhandler";

// diff-dom 타입 직접 정의 (간소화 버전)
interface VNode {
  nodeName: string;
  attributes: { [key: string]: string };
  childNodes: (VNode | VText)[];
  key?: string | number; // diffDOM은 키를 사용할 수 있음
}

interface VText {
  nodeName: "#text";
  nodeValue: string;
}

// diffDOM 인스턴스 생성
const dd = new DiffDOM({});

// htmlparser2의 노드를 diffDOM의 VNode로 변환하는 헬퍼 함수
function convertNodeToVNode(node: HtmlParserNode): VNode | VText | null {
  if (node.type === "text") {
    // 텍스트 노드 처리
    return { nodeName: "#text", nodeValue: (node as DataNode).data } as VText;
  }

  if (node.type === "tag" || node.type === "script" || node.type === "style") {
    // 요소 노드 처리
    const element = node as HtmlParserElement;
    const vnode: VNode = {
      nodeName: element.name.toUpperCase(), // diffDOM은 대문자 노드 이름 사용
      attributes: element.attribs || {},
      childNodes: [],
    };

    // 자식 노드 재귀적으로 변환
    if (element.children) {
      vnode.childNodes = element.children
        .map((child) => convertNodeToVNode(child))
        .filter((child) => child !== null) as (VNode | VText)[];
    }
    return vnode;
  }

  // 주석 등 다른 타입은 무시
  return null;
}

// HTML 문자열을 파싱하여 diffDOM VNode 배열로 변환하는 함수
function parseHtmlToVNodes(htmlString: string): (VNode | VText)[] {
  try {
    // 루트 요소로 감싸서 파싱해야 일관된 구조 얻기 용이
    const wrappedHtml = `<div>${htmlString}</div>`;
    // parseDOM 대신 parseDocument 사용
    // parseDocument는 Document 노드를 반환
    const document = htmlparser.parseDocument(wrappedHtml, { recognizeSelfClosing: true });

    // Document -> html -> body -> wrapper div -> target children
    let targetChildren: HtmlParserNode[] = [];
    const htmlElement = document.firstChild as HtmlParserElement | null;
    if (htmlElement && htmlElement.type === "tag" && htmlElement.name === "html") {
      const bodyElement = htmlElement.children.find(
        (child) => child.type === "tag" && (child as HtmlParserElement).name === "body"
      ) as HtmlParserElement | undefined;
      if (bodyElement && bodyElement.children.length > 0) {
        const wrapperDiv = bodyElement.firstChild as HtmlParserElement | null;
        if (wrapperDiv && wrapperDiv.type === "tag" && wrapperDiv.name === "div") {
          targetChildren = wrapperDiv.children;
        }
      }
    }

    // 대상 자식 노드들을 VNode로 변환
    if (targetChildren.length > 0) {
      return targetChildren
        .map((child) => convertNodeToVNode(child))
        .filter((child) => child !== null) as (VNode | VText)[];
    }

    return []; // 파싱 실패 또는 빈 HTML
  } catch (error) {
    console.error("HTML 파싱 오류:", error);
    return [];
  }
}

console.log("드래그 & 저장 백그라운드 스크립트 로드됨");

// 서비스 워커 활성 상태 유지
console.log("서비스 워커 활성화");

// 30초마다 ping 실행하여 활성 상태 유지
const keepAlive = () => {
  setInterval(() => {
    console.log("Background service worker ping: " + new Date().toLocaleTimeString());
    // 10분마다 모든 탭에 서비스 워커 활성 상태 확인 메시지 전송
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          try {
            chrome.tabs.sendMessage(tab.id, { action: "contentScriptCheck" }, (response) => {
              // 응답이 없어도 무시 (일부 탭은 콘텐츠 스크립트가 로드되지 않을 수 있음)
              if (chrome.runtime.lastError) {
                // 오류 무시
              }
            });
          } catch (error) {
            // 메시지 전송 실패 무시
          }
        }
      });
    });
  }, 20000);
};

// 서비스 워커 시작 즉시 실행
keepAlive();

// 확장 프로그램 컨텍스트 무효화 감지 변수
let isContextValid = true;

type DomPathRelationship = "same" | "parent" | "child" | "sibling" | "unrelated";

// getDomPathRelationship 함수 정의
function getDomPathRelationship(
  path1: string | undefined,
  path2: string | undefined
): DomPathRelationship {
  if (!path1 || !path2 || path1 === path2) {
    return "same";
  }
  const parts1 = path1.split(" > ");
  const parts2 = path2.split(" > ");
  const len1 = parts1.length;
  const len2 = parts2.length;
  const commonLen = Math.min(len1, len2);
  let commonPrefixLength = 0;
  for (let i = 0; i < commonLen; i++) {
    if (parts1[i] === parts2[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }
  if (commonPrefixLength === len1 && commonPrefixLength === len2) {
    return "same";
  } else if (commonPrefixLength === len1 && len1 < len2) {
    return "parent"; // path1이 path2의 부모
  } else if (commonPrefixLength === len2 && len2 < len1) {
    return "child"; // path1이 path2의 자식
  } else if (commonPrefixLength === len1 - 1 && commonPrefixLength === len2 - 1) {
    return "sibling"; // 부모 경로까지 동일
  } else {
    return "unrelated";
  }
}

// DOM 경로의 모든 선택자에서 nth-of-type 값을 추출하는 함수
function extractAllNthOfTypeValues(path: string | undefined): number[] {
  if (!path) return [];
  const parts = path.split(" > ");

  return parts.map((part) => {
    const match = part.match(/:nth-of-type\((\d+)\)$/);
    return match && match[1] ? parseInt(match[1], 10) : 1; // nth-of-type이 없으면 1로 간주
  });
}

// 두 경로의 nth-of-type 값들을 비교하는 함수
function compareNthOfTypeValues(path1: string | undefined, path2: string | undefined): number {
  const values1 = extractAllNthOfTypeValues(path1);
  const values2 = extractAllNthOfTypeValues(path2);

  // 더 짧은 배열의 길이만큼 비교
  const minLength = Math.min(values1.length, values2.length);

  for (let i = 0; i < minLength; i++) {
    if (values1[i] !== values2[i]) {
      return values1[i] - values2[i]; // 양수면 path1이 더 뒤에, 음수면 path2가 더 뒤에 있음
    }
  }

  // 모든 값이 같다면 길이가 더 긴 쪽이 더 구체적인 경로
  return values1.length - values2.length;
}

// 병합 전략 결정 함수
function determineMergeStrategy(
  newPath: string | undefined,
  existingPath: string | undefined,
  newContentLength: number,
  existingContentLength: number,
  diff: any[]
): MergeAction {
  const relationship = getDomPathRelationship(newPath, existingPath);

  switch (relationship) {
    case "same":
      return diff.length > 0 ? "replace" : "none";
    case "parent":
      return newContentLength > existingContentLength ? "replace" : "none";
    case "sibling":
      const comparison = compareNthOfTypeValues(newPath, existingPath);
      if (comparison > 0) return "append";
      if (comparison < 0) return "prepend";
      return "append"; // 동일한 위치면 기본적으로 append
    case "unrelated":
      return newContentLength > existingContentLength && diff.length > 0 ? "replace" : "none";
    default:
      return "none";
  }
}

// 병합 실행 함수
function mergeContent(
  newItem: CapturedItem,
  existingItem: CapturedItem,
  action: MergeAction
): CapturedItem {
  const mergedItem = { ...existingItem };

  switch (action) {
    case "replace":
      mergedItem.content = newItem.content;
      mergedItem.meta = {
        ...mergedItem.meta,
        domPath: newItem.meta?.domPath,
      };
      break;

    case "append":
    case "prepend":
      if (typeof mergedItem.content === "string" && typeof newItem.content === "string") {
        mergedItem.content =
          action === "append"
            ? `${mergedItem.content}\n${newItem.content}`
            : `${newItem.content}\n${mergedItem.content}`;
      }
      break;
  }

  return mergedItem;
}

// 아이템을 URL 그룹에 업데이트하는 함수
function updateUrlGroups(newItem: CapturedItem): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // 현재 저장된 데이터 가져오기
      const result = await chrome.storage.local.get(["urlGroups"]);
      const currentGroups = (result.urlGroups || []) as UrlGroup[];

      // 해당 URL의 그룹 찾기
      const groupIndex = currentGroups.findIndex((group) => group.url === newItem.pageUrl);

      if (groupIndex >= 0) {
        // 기존 그룹이 있는 경우 업데이트
        const updatedGroups = [...currentGroups];
        const group = updatedGroups[groupIndex];

        // 아이템 추가 또는 업데이트
        const itemIndex = group.items.findIndex((item) => item.id === newItem.id);
        if (itemIndex >= 0) {
          // 기존 아이템 업데이트
          group.items[itemIndex] = newItem;
        } else {
          // 새 아이템 추가
          group.items.push(newItem);
        }

        // 그룹 타임스탬프 업데이트 (최신 날짜로)
        const itemTime = new Date(newItem.timestamp).getTime();
        const groupTime = new Date(group.timestamp).getTime();
        if (itemTime > groupTime) {
          group.timestamp = newItem.timestamp;
        }

        // favicon 업데이트 (없는 경우에만)
        if (!group.favicon && newItem.meta?.favicon) {
          group.favicon = newItem.meta.favicon;
        }

        // 업데이트된 그룹 저장
        updatedGroups[groupIndex] = group;
        await chrome.storage.local.set({ urlGroups: updatedGroups });
      } else {
        // 새 그룹 생성
        const newGroup: UrlGroup = {
          url: newItem.pageUrl,
          title: newItem.pageTitle,
          favicon: newItem.meta?.favicon,
          timestamp: newItem.timestamp,
          items: [newItem],
          // 요약 및 문제 정보는 기본값으로
          summaryId: undefined,
          summaryContent: undefined,
          summaryType: undefined,
          problemId: undefined,
        };

        await chrome.storage.local.set({ urlGroups: [...currentGroups, newGroup] });
      }

      resolve();
    } catch (error) {
      console.error("URL 그룹 업데이트 오류:", error);
      reject(error);
    }
  });
}

// 콘텐츠 스크립트에서 메시지 받기
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (!isContextValid) {
    console.error("확장 프로그램 컨텍스트가 더 이상 유효하지 않습니다.");
    sendResponse({ success: false, error: "Extension context invalidated" });
    return false;
  }

  (async () => {
    try {
      // 콘텐츠 캡처 메시지 처리
      if (message.action === "contentCaptured") {
        console.log("콘텐츠 캡처됨:", message.type);

        const state = await getCurrentState();
        if (!state.isCapturing) {
          sendResponse({
            success: false,
            status: "disabled",
            error: "캡처가 비활성화되어 있습니다.",
          });
          return;
        }

        const pageUrl = sender.tab?.url || "";
        const pageTitle = sender.tab?.title || "";

        if (!pageUrl) {
          sendResponse({
            success: false,
            error: "탭 URL을 확인할 수 없습니다.",
          });
          return;
        }

        const result = await chrome.storage.local.get(["savedItems"]);
        const savedItems = (result.savedItems || []) as CapturedItem[];

        // 새 아이템 생성
        const newItem: CapturedItem = {
          id: Date.now(),
          type: message.type || "text", // 기본값 제공
          content: message.content || "", // 기본값 제공
          pageUrl,
          pageTitle,
          timestamp: new Date().toISOString(),
          meta: message.meta || {},
        };

        // DOM 경로 비교를 통한 중복 확인 및 병합
        if (message.type === "text" && typeof message.content === "string") {
          const existingItems = savedItems.filter(
            (item) => item.pageUrl === pageUrl && item.type === "text"
          );

          if (existingItems.length > 0) {
            // 내용이 완전히 동일한 아이템 확인
            const exactDuplicate = existingItems.find(
              (item) => typeof item.content === "string" && item.content === message.content
            );

            if (exactDuplicate) {
              console.log("정확히 동일한 콘텐츠 발견, 중복 저장 방지");
              sendResponse({
                success: true,
                status: "skipped_duplicate",
                message: "이미 저장된 동일한 콘텐츠입니다.",
              });
              return;
            }

            // DOM 경로 기반 병합 가능한 아이템 확인
            const itemsWithDomPath = existingItems.filter(
              (item) => item.meta?.domPath && typeof item.content === "string"
            );

            if (itemsWithDomPath.length > 0 && message.meta?.domPath) {
              for (const existingItem of itemsWithDomPath) {
                if (existingItem.meta?.domPath) {
                  // html 콘텐츠 비교 (diff 계산)
                  const existingVNodes = parseHtmlToVNodes(existingItem.content as string);
                  const newVNodes = parseHtmlToVNodes(message.content as string);
                  const diff = dd.diff(existingVNodes as any, newVNodes as any);

                  // 병합 전략 결정
                  const mergeAction = determineMergeStrategy(
                    message.meta.domPath,
                    existingItem.meta.domPath,
                    message.content.length,
                    (existingItem.content as string).length,
                    diff
                  );

                  if (mergeAction !== "none") {
                    console.log(
                      `병합 전략 결정: ${mergeAction}, ID: ${existingItem.id}`,
                      `기존 경로: ${existingItem.meta.domPath}`,
                      `새 경로: ${message.meta.domPath}`
                    );

                    // 아이템 병합
                    const mergedItem = mergeContent(newItem, existingItem, mergeAction);

                    // 저장된 아이템 업데이트
                    const updatedItems = savedItems.map((item) =>
                      item.id === existingItem.id ? mergedItem : item
                    );

                    await chrome.storage.local.set({ savedItems: updatedItems });

                    // URL 그룹 업데이트
                    await updateUrlGroups(mergedItem);

                    // 탭에 알림 전송
                    try {
                      if (sender.tab?.id) {
                        chrome.tabs.sendMessage(sender.tab.id, {
                          action: "savingComplete",
                          item: mergedItem,
                        });
                      }
                    } catch (notificationError) {
                      console.error("알림 전송 오류:", notificationError);
                    }

                    sendResponse({
                      success: true,
                      status: "item_updated",
                      message: "기존 항목에 내용이 병합되었습니다.",
                    });
                    return;
                  }
                }
              }
            }
          }
        }

        // 새 아이템 저장
        await chrome.storage.local.set({
          savedItems: [...savedItems, newItem],
        });

        // URL 그룹 업데이트
        await updateUrlGroups(newItem);

        // 탭에 알림 전송 (캡처 완료)
        try {
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: "savingComplete",
              item: newItem,
            });
          }
        } catch (notificationError) {
          console.error("알림 전송 오류:", notificationError);
        }

        sendResponse({ success: true, status: "ok" });
        return;
      }

      // 콘텐츠 스크립트 준비 상태 메시지
      if (message.action === "contentScriptReady") {
        console.log("콘텐츠 스크립트 준비됨");
        sendResponse({ success: true, received: true });
        return;
      }
    } catch (error: any) {
      console.error("오류:", error.message || error);
      sendResponse({
        success: false,
        error: error.message || "알 수 없는 오류가 발생했습니다.",
      });
    }
  })();

  return true; // 비동기 응답을 위해 true 반환
});

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener((details) => {
  // 저장된 항목 수를 뱃지로 표시
  chrome.storage.local.get(["savedItems"], function (result) {
    const savedItems = result.savedItems || [];
    if (savedItems.length > 0) {
      chrome.action.setBadgeText({
        text: savedItems.length.toString(),
      });
      chrome.action.setBadgeBackgroundColor({
        color: "#4285f4",
      });
    }
  });

  // 캡처 상태 초기화
  chrome.storage.local.set({ isCapturing: false, isHtmlMode: false });

  // 컨텍스트 유효 상태로 설정
  isContextValid = true;
});

// 확장 프로그램 컨텍스트 무효화 감지
chrome.runtime.onSuspend.addListener(() => {
  isContextValid = false;
  console.log("확장 프로그램 컨텍스트가 중단되었습니다.");
});

// 확장 프로그램 아이콘 클릭시 뱃지 초기화
chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({ text: "" });
});

function toggleCapturing(isCapturing?: boolean) {
  getCurrentState().then((state) => {
    const newState = isCapturing !== undefined ? isCapturing : !state.isCapturing;

    // 상태 저장
    chrome.storage.local.set({ isCapturing: newState });

    // 콘텐츠 스크립트에 상태 전달
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleCapturing",
          isCapturing: newState,
        });
      }
    });

    // 아이콘 업데이트
    updateIcon(newState);
  });
}

// 현재 상태 가져오기
async function getCurrentState(): Promise<{ isCapturing: boolean; isHtmlMode: boolean }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["isCapturing", "isHtmlMode"], (result) => {
      resolve({
        isCapturing: result.isCapturing || false,
        isHtmlMode: result.isHtmlMode || false,
      });
    });
  });
}

// 아이콘 업데이트
function updateIcon(isCapturing: boolean) {
  // 활성화/비활성화 상태에 따라 아이콘 변경
  const iconPath = isCapturing ? "/icons/icon-active-48.png" : "/icons/icon-default-48.png";

  chrome.action.setIcon({
    path: iconPath,
  });
}

// HTML에서 주요 콘텐츠 추출 함수
async function extractContentFromSavedHtml(itemId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["savedItems"], (result) => {
      try {
        const savedItems = result.savedItems || [];
        const itemIndex = savedItems.findIndex((i: CapturedItem) => i.id === itemId);

        if (itemIndex === -1 || savedItems[itemIndex].type !== "html") {
          return reject(new Error("HTML 항목을 찾을 수 없음"));
        }

        const item = savedItems[itemIndex];

        // 이미 추출된 콘텐츠가 있는지 확인
        if (item.meta?.extractedContent) {
          console.log("이미 추출된 콘텐츠가 있습니다.");
          return resolve(item.meta.extractedContent);
        }

        // 외부 라이브러리 동적 로드
        import("@wrtnlabs/web-content-extractor")
          .then(({ extractContent }) => {
            try {
              const htmlContent = item.content as string;
              // 라이브러리가 직접 본문 내용 문자열을 반환
              const extractedText = extractContent(htmlContent);
              console.log("추출된 콘텐츠:", extractedText);
              // 추출된 콘텐츠를 항목 메타데이터에 저장
              const extractedContent = {
                content: extractedText, // 추출된 본문 내용 저장
              };

              // 항목 업데이트
              savedItems[itemIndex].meta = {
                ...(item.meta || {}),
                extractedContent,
              };

              // 업데이트된 목록 저장
              chrome.storage.local.set({ savedItems }, () => {
                console.log("추출된 콘텐츠가 저장되었습니다.");
                resolve(extractedContent);
              });
            } catch (error) {
              console.error("콘텐츠 추출 처리 오류:", error);
              reject(error);
            }
          })
          .catch((error) => {
            console.error("web-content-extractor 로드 오류:", error);
            reject(new Error("콘텐츠 추출 라이브러리 로드 실패"));
          });
      } catch (error) {
        console.error("HTML 콘텐츠 추출 오류:", error);
        reject(error);
      }
    });
  });
}
