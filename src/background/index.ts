import { DiffDOM } from "diff-dom";
import * as htmlparser from "htmlparser2";
import { CapturedItem, MergeAction, Message, Response, ImageContent, UrlGroup } from "../types";
import { Node as HtmlParserNode, DataNode, Element as HtmlParserElement } from "domhandler";
import api from "../hooks/useApi"; // API 호출을 위해 추가 (경로 및 사용 가능성 확인 필요)

// 이메일과 토큰을 저장하는 키 상수 (useAuth.ts와 동일하게)
const AUTH_TOKEN_KEY = "google_auth_token";
const USER_EMAIL_KEY = "user_email";

// JWT 토큰 디코딩 함수
function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
}

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
function updateUrlGroups(newItem: CapturedItem, userEmail: string | null): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // 현재 저장된 데이터 가져오기
      const result = await chrome.storage.local.get(["urlGroups"]);
      let currentGroups = (result.urlGroups || []) as UrlGroup[];

      // 현재 사용자의 그룹만 필터링 (또는 모든 그룹을 다루되, newItem.userEmail을 기준으로 작업)
      // 여기서는 모든 그룹을 다루고, newItem.userEmail과 일치하는 그룹을 찾거나 새로 만듭니다.

      const groupIndex = currentGroups.findIndex(
        (group) => group.url === newItem.pageUrl && group.userEmail === userEmail
      );

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
        // userEmail은 이미 그룹 생성/필터링 시점에 일치해야 함
        group.userEmail = userEmail || undefined;

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
          userEmail: userEmail || undefined, // 새 그룹에 userEmail 추가
          // 요약 및 문제 정보는 기본값으로
          summaryId: undefined,
          summaryContent: undefined,
          summaryType: undefined,
          problemId: undefined,
        };
        // 다른 사용자의 그룹은 그대로 두고 새 그룹 추가
        currentGroups.push(newGroup);
        await chrome.storage.local.set({ urlGroups: currentGroups });
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

        // 사용자 이메일 가져오기 (로컬 스토리지에서)
        let userEmail: string | null = null;
        try {
          const result = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
          userEmail = result[USER_EMAIL_KEY] || null;

          // 이메일이 없고 토큰이 있는 경우, 토큰에서 이메일 추출 시도
          if (!userEmail && result[AUTH_TOKEN_KEY]) {
            const token = result[AUTH_TOKEN_KEY];
            const decodedToken = parseJwt(token);
            if (decodedToken && decodedToken.email) {
              userEmail = decodedToken.email;
              console.log("토큰에서 이메일 추출 (백그라운드):", userEmail);

              // 추출한 이메일을 스토리지에 저장 (향후 사용을 위해)
              await chrome.storage.local.set({ [USER_EMAIL_KEY]: userEmail });
            }
          }

          if (userEmail) {
            console.log("현재 사용자 이메일 (백그라운드):", userEmail);
          } else {
            console.warn("로그인된 사용자 이메일을 찾을 수 없습니다. 익명으로 저장됩니다.");
          }
        } catch (error) {
          console.error("사용자 정보 가져오기 중 예외 발생 (백그라운드):", error);
          // 필요시 오류 처리, 여기서는 null로 계속 진행
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
          userEmail: userEmail || undefined, // userEmail 추가
        };

        console.log("새 아이템 생성 (userEmail 포함):", {
          id: newItem.id,
          type: newItem.type,
          userEmail: newItem.userEmail,
        });

        // DOM 경로 비교를 통한 중복 확인 및 병합
        if (message.type === "text" && typeof message.content === "string") {
          // 현재 사용자의 아이템만 필터링하여 중복 검사
          const userSpecificItems = savedItems.filter(
            (item) =>
              item.pageUrl === pageUrl && item.type === "text" && item.userEmail === userEmail
          );

          if (userSpecificItems.length > 0) {
            const exactDuplicate = userSpecificItems.find(
              (item) => typeof item.content === "string" && item.content === message.content
            );

            if (exactDuplicate) {
              console.log("정확히 동일한 콘텐츠 발견 (현재 사용자), 중복 저장 방지");
              sendResponse({
                success: true,
                status: "skipped_duplicate",
                message: "이미 저장된 동일한 콘텐츠입니다.",
              });
              return;
            }

            const itemsWithDomPath = userSpecificItems.filter(
              (item) => item.meta?.domPath && typeof item.content === "string"
            );

            if (itemsWithDomPath.length > 0 && message.meta?.domPath) {
              for (const existingItem of itemsWithDomPath) {
                if (existingItem.meta?.domPath) {
                  const existingVNodes = parseHtmlToVNodes(existingItem.content as string);
                  const newVNodes = parseHtmlToVNodes(message.content as string);
                  const diff = dd.diff(existingVNodes as any, newVNodes as any);
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
                      `새 경로: ${message.meta.domPath}`,
                      `사용자: ${userEmail}`
                    );
                    const mergedItem = mergeContent(newItem, existingItem, mergeAction);
                    mergedItem.userEmail = userEmail || undefined; // 병합된 아이템에도 userEmail 보장

                    const updatedItems = savedItems.map((item) =>
                      item.id === existingItem.id && item.userEmail === userEmail
                        ? mergedItem
                        : item
                    );
                    await chrome.storage.local.set({ savedItems: updatedItems });
                    await updateUrlGroups(mergedItem, userEmail); // userEmail 전달

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

        // 새 아이템 저장 (다른 사용자 아이템은 건드리지 않음)
        // savedItems에는 모든 사용자의 아이템이 있을 수 있으므로, 현재 사용자의 아이템만 필터링 후 추가하거나
        // 또는 newItem에 userEmail이 있으므로 그냥 추가해도 useUrlGroups에서 필터링됨.
        // 여기서는 그냥 추가하고, 불러올 때 필터링하는 방식 유지.
        await chrome.storage.local.set({
          savedItems: [...savedItems, newItem],
        });

        // URL 그룹 업데이트
        await updateUrlGroups(newItem, userEmail); // userEmail 전달

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
      }
      // 아이템 다운로드 요청 처리
      if (message.action === "downloadItem") {
        const item = message.item as CapturedItem;
        const markdownContent = message.markdownContent as string | undefined;

        try {
          if (item.type === "text" && typeof markdownContent === "string") {
            const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
            const fileReader = new FileReader();

            fileReader.onloadend = function () {
              const dataUrl = fileReader.result as string;
              const pageTitle = item.pageTitle || "untitled";
              const sanitizedTitle =
                pageTitle.replace(/[<>:"/\\|?*]+/g, "_").substring(0, 50) || "download";
              const filename = `${sanitizedTitle}.md`;

              chrome.downloads.download(
                {
                  url: dataUrl,
                  filename: filename,
                },
                (downloadId) => {
                  if (chrome.runtime.lastError) {
                    console.error("Markdown 다운로드 오류:", chrome.runtime.lastError.message);
                    sendResponse({
                      success: false,
                      error: `다운로드 실패: ${chrome.runtime.lastError.message}`,
                    } as Response);
                  } else if (downloadId === undefined) {
                    console.error("Markdown 다운로드 ID를 받지 못했습니다.");
                    sendResponse({
                      success: false,
                      error: "다운로드가 시작되지 않았습니다. 브라우저 설정을 확인하세요.",
                    } as Response);
                  } else {
                    sendResponse({ success: true, downloadId: downloadId } as Response);
                  }
                }
              );
            };

            fileReader.onerror = function () {
              console.error("FileReader 오류 발생");
              sendResponse({
                success: false,
                error: "파일을 읽는 중 오류가 발생했습니다.",
              } as Response);
            };

            fileReader.readAsDataURL(blob);
          } else if (item.type === "image") {
            // 사용자 제공 이미지 다운로드 로직으로 교체
            try {
              const imgContent = item.content as ImageContent;
              if (!imgContent || !imgContent.dataUrl) {
                // ImageContent 또는 dataUrl 유효성 검사
                console.error("이미지 콘텐츠 또는 dataUrl이 유효하지 않습니다.", item);
                sendResponse({
                  success: false,
                  error: "이미지 데이터가 올바르지 않습니다.",
                } as Response);
                return true;
              }

              const extension = imgContent.type ? imgContent.type.split("/")[1] || "png" : "png"; // 기본값 png 추가
              const pageTitle = item.pageTitle || "image";
              const sanitizedTitle =
                pageTitle.replace(/[^a-zA-Z0-9가-힣\s_.-]/g, "_").substring(0, 30) || "image"; // 공백, 밑줄, 하이픈, 마침표 허용

              let filename = imgContent.name
                ? `${sanitizedTitle}-${imgContent.name}`
                : `${sanitizedTitle}-${item.id}.${extension}`;
              // 파일명에 확장자가 중복으로 들어가지 않도록 처리
              if (
                imgContent.name &&
                !imgContent.name.toLowerCase().endsWith("." + extension.toLowerCase())
              ) {
                filename = `${sanitizedTitle}-${imgContent.name}.${extension}`;
              } else if (!imgContent.name) {
                filename = `${sanitizedTitle}-${item.id}.${extension}`;
              } else {
                filename = `${sanitizedTitle}-${imgContent.name}`;
              }

              chrome.downloads.download(
                {
                  url: imgContent.dataUrl,
                  filename: filename,
                },
                (downloadId) => {
                  if (chrome.runtime.lastError) {
                    console.error("이미지 다운로드 오류:", chrome.runtime.lastError.message);
                    sendResponse({
                      success: false,
                      error: `이미지 다운로드 실패: ${chrome.runtime.lastError.message}`,
                    } as Response);
                  } else if (downloadId === undefined) {
                    console.error("이미지 다운로드 ID를 받지 못했습니다.");
                    sendResponse({
                      success: false,
                      error: "이미지 다운로드가 시작되지 않았습니다. 브라우저 설정을 확인하세요.",
                    } as Response);
                  } else {
                    sendResponse({ success: true, downloadId: downloadId } as Response);
                  }
                }
              );
            } catch (error: any) {
              console.error("이미지 다운로드 처리 중 예외:", error);
              sendResponse({
                success: false,
                error: error.message || "이미지 다운로드 중 알 수 없는 오류 발생",
              } as Response);
            }
          } else {
            console.warn("다운로드 지원하지 않는 타입 또는 markdownContent 누락:", item);
            sendResponse({
              success: false,
              error:
                "다운로드할 수 없는 콘텐츠입니다. Markdown 내용이 없거나 지원되지 않는 파일 형식입니다.",
            });
          }
        } catch (e: any) {
          console.error("downloadItem 처리 중 예외:", e);
          sendResponse({ success: false, error: e.message || "다운로드 중 알 수 없는 오류 발생" });
        }
        return true; // 비동기 sendResponse를 위해 true 반환
      }

      if (message.action === "createProblemRequest") {
        console.log("문제 생성 요청 수신 (백그라운드):", message);
        const {
          summaryId,
          quizCount,
          quizTypes,
          userEmail,
          authToken,
          pageUrl: requestPageUrl,
        } = message;

        if (!summaryId || !quizCount || !quizTypes || !userEmail || !authToken || !requestPageUrl) {
          sendResponse({ success: false, error: "문제 생성 요청에 필요한 정보 부족" });
          return;
        }

        try {
          // API 호출 (api 객체가 백그라운드에서 사용 가능해야 함)
          // 백그라운드에서는 useAuth() 훅을 직접 사용할 수 없으므로 authToken을 메시지로 받아야 함.
          // useApi.ts의 setAuthToken을 백그라운드에서 직접 호출하거나, API 요청 시 헤더에 토큰을 직접 설정해야 함.
          // 여기서는 직접 헤더에 설정하는 방식을 가정합니다.
          const apiConfig = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {};

          console.log(`API 요청: /quiz/${summaryId}`, { quizCount, quizTypes }, apiConfig);

          const { data: result } = await api.post(
            `/quiz/${summaryId}`,
            {
              quizCount: quizCount,
              quizTypes: quizTypes,
            },
            apiConfig
          );

          console.log("문제 생성 API 응답:", result);

          if (result.success) {
            const problemId = summaryId; // 현재 로직에서는 summaryId가 problemId로 사용됨

            const storageResult = await chrome.storage.local.get(["urlGroups"]);
            const currentGroups = (storageResult.urlGroups || []) as UrlGroup[];

            let updatedGroup: UrlGroup | undefined = undefined;
            const updatedGroups = currentGroups.map((group) => {
              if (
                group.url === requestPageUrl &&
                group.userEmail === userEmail &&
                group.summaryId === summaryId
              ) {
                updatedGroup = { ...group, problemId: problemId };
                return updatedGroup;
              }
              return group;
            });

            if (updatedGroup) {
              await chrome.storage.local.set({ urlGroups: updatedGroups });
              console.log(
                "ProblemId 업데이트 및 저장 완료:",
                problemId,
                "for group:",
                requestPageUrl
              );
              sendResponse({
                success: true,
                status: "problem_created",
                problemId: problemId,
                updatedGroup: updatedGroup,
              });
            } else {
              console.error("ProblemId를 업데이트할 해당 그룹을 찾지 못함");
              sendResponse({
                success: false,
                error: "ProblemId를 업데이트할 그룹을 찾지 못했습니다.",
              });
            }
          } else {
            sendResponse({
              success: false,
              error: result.errorMsg || "API에서 문제 생성 실패",
              errorCode: result.errorCode,
            });
          }
        } catch (error: any) {
          console.error("문제 생성 API 호출 또는 스토리지 업데이트 오류:", error);
          sendResponse({
            success: false,
            error: error.message || "문제 생성 중 백그라운드 오류 발생",
          });
        }
        return; // 비동기 처리가 완료되었으므로 여기서 반환
      }
    } catch (error: any) {
      console.error("백그라운드 메시지 핸들러 오류:", error.message || error);
      // 이미 sendResponse가 호출되었을 수 있으므로, 안전하게 처리
      // 이 catch는 최상위 async 함수의 오류를 잡기 위함
      if (!sender.tab) {
        // 팝업 등에서의 요청일 수 있으므로 체크
        try {
          sendResponse({ success: false, error: error.message || "알 수 없는 백그라운드 오류" });
        } catch (e) {}
      }
    }
  })();

  return true; // 비동기 sendResponse를 위해 항상 true 반환
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
