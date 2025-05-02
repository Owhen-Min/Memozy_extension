import { DiffDOM } from 'diff-dom';
import * as htmlparser from 'htmlparser2';
import { CapturedItem, MergeAction, Message, Response, ImageContent } from '../types';
import { Node as HtmlParserNode, DataNode, Element as HtmlParserElement } from 'domhandler';

// diff-dom 타입 직접 정의 (간소화 버전)
interface VNode {
  nodeName: string;
  attributes: { [key: string]: string };
  childNodes: (VNode | VText)[];
  key?: string | number; // diffDOM은 키를 사용할 수 있음
}

interface VText {
  nodeName: '#text';
  nodeValue: string;
}

// diffDOM 인스턴스 생성
const dd = new DiffDOM({});

// htmlparser2의 노드를 diffDOM의 VNode로 변환하는 헬퍼 함수
function convertNodeToVNode(node: HtmlParserNode): VNode | VText | null {
  if (node.type === 'text') {
    // 텍스트 노드 처리
    return { nodeName: '#text', nodeValue: (node as DataNode).data } as VText;
  }

  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    // 요소 노드 처리
    const element = node as HtmlParserElement;
    const vnode: VNode = {
      nodeName: element.name.toUpperCase(), // diffDOM은 대문자 노드 이름 사용
      attributes: element.attribs || {},
      childNodes: []
    };

    // 자식 노드 재귀적으로 변환
    if (element.children) {
      vnode.childNodes = element.children
        .map(child => convertNodeToVNode(child))
        .filter(child => child !== null) as (VNode | VText)[];
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
    if (htmlElement && htmlElement.type === 'tag' && htmlElement.name === 'html') {
        const bodyElement = htmlElement.children.find(child => child.type === 'tag' && (child as HtmlParserElement).name === 'body') as HtmlParserElement | undefined;
        if (bodyElement && bodyElement.children.length > 0) {
             const wrapperDiv = bodyElement.firstChild as HtmlParserElement | null;
             if (wrapperDiv && wrapperDiv.type === 'tag' && wrapperDiv.name === 'div') {
                 targetChildren = wrapperDiv.children;
             }
        }
    }

    // 대상 자식 노드들을 VNode로 변환
    if (targetChildren.length > 0) {
        return targetChildren
            .map(child => convertNodeToVNode(child))
            .filter(child => child !== null) as (VNode | VText)[];
    }
    
    return []; // 파싱 실패 또는 빈 HTML
  } catch (error) {
    console.error("HTML 파싱 오류:", error);
    return [];
  }
}

console.log('드래그 & 저장 백그라운드 스크립트 로드됨');

// 서비스 워커 활성 상태 유지
console.log('서비스 워커 활성화');

// 30초마다 ping 실행하여 활성 상태 유지
const keepAlive = () => {
  setInterval(() => {
    console.log('Background service worker ping: ' + new Date().toLocaleTimeString());
    // 10분마다 모든 탭에 서비스 워커 활성 상태 확인 메시지 전송
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
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

type DomPathRelationship = 'same' | 'parent' | 'child' | 'sibling' | 'unrelated';

// getDomPathRelationship 함수 정의
function getDomPathRelationship(path1: string | undefined, path2: string | undefined): DomPathRelationship {
    if (!path1 || !path2 || path1 === path2) {
        return 'same';
    }
    const parts1 = path1.split(' > ');
    const parts2 = path2.split(' > ');
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
        return 'same';
    } else if (commonPrefixLength === len1 && len1 < len2) {
        return 'parent'; // path1이 path2의 부모
    } else if (commonPrefixLength === len2 && len2 < len1) {
        return 'child'; // path1이 path2의 자식
    } else if (commonPrefixLength === len1 - 1 && commonPrefixLength === len2 - 1) {
        return 'sibling'; // 부모 경로까지 동일
    } else {
        return 'unrelated';
    }
}


// DOM 경로의 모든 선택자에서 nth-of-type 값을 추출하는 함수
function extractAllNthOfTypeValues(path: string | undefined): number[] {
    if (!path) return [];
    const parts = path.split(' > ');
    
    return parts.map(part => {
        const match = part.match(/:nth-of-type\((\d+)\)$/);
        return match && match[1] ? parseInt(match[1], 10) : 1;  // nth-of-type이 없으면 1로 간주
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
            return values1[i] - values2[i];  // 양수면 path1이 더 뒤에, 음수면 path2가 더 뒤에 있음
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
    case 'same':
      return diff.length > 0 ? 'replace' : 'none';
    case 'parent':
      return newContentLength > existingContentLength ? 'replace' : 'none';
    case 'sibling':
      const comparison = compareNthOfTypeValues(newPath, existingPath);
      if (comparison > 0) return 'append';
      if (comparison < 0) return 'prepend';
      return 'append';  // 동일한 위치면 기본적으로 append
    case 'unrelated':
      return (newContentLength > existingContentLength && diff.length > 0) ? 'replace' : 'none';
    default:
      return 'none';
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
    case 'replace':
      mergedItem.content = newItem.content;
      mergedItem.meta = {
        ...mergedItem.meta,
        domPath: newItem.meta?.domPath,
        merged: true,
        lastMergeTimestamp: new Date().toISOString()
      };
      break;

    case 'append':
    case 'prepend':
      if (typeof mergedItem.content === 'string' && typeof newItem.content === 'string') {
        mergedItem.content = action === 'append'
          ? `${mergedItem.content}\n${newItem.content}`
          : `${newItem.content}\n${mergedItem.content}`;
        
        mergedItem.meta = {
          ...mergedItem.meta,
          merged: true,
          lastMergeTimestamp: new Date().toISOString()
        };
      }
      break;
  }

  return mergedItem;
}

// 콘텐츠 스크립트에서 메시지 받기
chrome.runtime.onMessage.addListener((message: Message & { markdownContent?: string }, sender, sendResponse) => {
  console.log(`[Background] Received message: Action=${message?.action}, Sender=${sender?.tab?.id || 'N/A'}`);

  // 메시지 로깅
  console.log('백그라운드 메시지 수신:', message.action, sender.tab?.id);
  
  // 컨텍스트가 무효화되면 모든 메시지 처리 중단
  if (!isContextValid) {
    console.warn('[Background] Extension context invalidated. Stopping message processing.');
    sendResponse({success: false, error: 'Extension context invalidated'});
    return false;
  }
  
  try {
    if (message.action === "contentScriptReady") {
      console.log('콘텐츠 스크립트 준비 완료:', sender.tab?.id);
      sendResponse({success: true});
      return true;
    }
    else if (message.action === "contentScriptCheck") {
      console.log('콘텐츠 스크립트 상태 확인:', sender.tab?.id);
      sendResponse({success: true});
      return true;
    }
    else if (message.action === "contentCaptured") {
      const currentTab = sender.tab;
      if (!currentTab) {
          console.error("Cannot get sender tab information.");
          sendResponse({success: false, error: "Missing tab information"});
          return false; // Return false for sync response
      }
      const pageTitle = currentTab.title || "제목 없음";
      const pageUrl = currentTab.url || "";

      try { // <<< Outer try block >>>
        // Create newItem without displayContent
        const newItem: Omit<CapturedItem, 'displayContent'> = {
            id: Date.now(),
            type: message.type!,
            content: typeof message.content === 'string' ? message.content :
                     (typeof message.content === 'object' && message.content !== null && 'dataUrl' in message.content) ? message.content : '',
            pageTitle: pageTitle,
            pageUrl: pageUrl,
            timestamp: new Date().toISOString(),
            meta: message.meta ? { ...message.meta, format: message.type === 'image' ? 'png' : 'html' } : { format: message.type === 'image' ? 'png' : 'html' }
        };

        let isValidForProcessing = false;

        // Simplified validation
        if (newItem.type === 'text' && typeof newItem.content === 'string') {
            if (newItem.content.trim() !== '') {
                console.log(`Processing text capture (HTML only). HTML Length: ${newItem.content.length}`);
                isValidForProcessing = true;
            } else {
                 console.warn("Received text capture with empty content string.");
            }
        } else if (newItem.type === 'image') {
            newItem.content = typeof message.content === 'object' && message.content !== null && 'dataUrl' in message.content ? message.content : { dataUrl: '', type:'', name:'' };
             if (typeof newItem.content === 'object' && newItem.content.dataUrl) {
                 isValidForProcessing = true;
                 console.log("Processing image capture.");
             } else {
                  console.warn("Received image capture with invalid content.");
             }
        } else {
            console.warn(`Unsupported capture type or invalid content: type=${newItem.type}, content_type=${typeof message.content}`);
        }

        if (!isValidForProcessing) {
            console.error("Item is not valid for processing. Aborting save.");
            sendResponse({success: false, error: "Invalid item data for saving."});
            return true; // Indicate async response handled
        }

        console.log("Prepared newItem (HTML only):", { // Log prepared item
            id: newItem.id,
            type: newItem.type,
            contentLength: typeof newItem.content === 'string' ? newItem.content.length : 'N/A',
            meta: newItem.meta
        });

        // --- Storage Operations ---
        chrome.storage.local.get(['savedItems'], function(result) {
            try { // Inner try
                // Type assertion needed because storage might still contain old items
                const savedItems = (result.savedItems || []) as CapturedItem[]; 
                let isDuplicate = false;
                let itemUpdated = false;
                let updatedItemId: number | null = null;
                let shouldSaveNew = true;

                // --- Merge/Update Logic (operates on newItem.content = HTML) ---
                if (newItem.type === 'text' && typeof newItem.content === 'string') {
                    const existingItems = savedItems.filter(item =>
                        item.type === 'text' &&
                        item.pageUrl === newItem.pageUrl &&
                        typeof item.content === 'string' 
                    );
                    const newVNodes = parseHtmlToVNodes(newItem.content);
                    const newContentLength = newItem.content.length;
                    const newPath = newItem.meta?.domPath;

                     if (newVNodes.length > 0) {
                        for (let i = 0; i < existingItems.length; i++) {
                            const existingItem = existingItems[i];
                            if (typeof existingItem.content !== 'string') continue;
                            try {
                                const existingVNodes = parseHtmlToVNodes(existingItem.content);
                                const existingContentLength = existingItem.content.length;
                                const existingPath = existingItem.meta?.domPath;

                                if (existingVNodes.length > 0) {
                                    const virtualNewRoot: VNode = { nodeName: 'DIV', attributes: {}, childNodes: newVNodes };
                                    const virtualExistingRoot: VNode = { nodeName: 'DIV', attributes: {}, childNodes: existingVNodes };
                                    const diff = dd.diff(virtualExistingRoot, virtualNewRoot);
                                    const MAX_DIFF_LENGTH = 5;

                                    if (diff.length <= MAX_DIFF_LENGTH) {
                                        isDuplicate = true;
                                        shouldSaveNew = false;

                                        const mergeAction = determineMergeStrategy(
                                          newPath,
                                          existingPath,
                                          newContentLength,
                                          existingContentLength,
                                          diff
                                        );

                                        if (mergeAction !== 'none') {
                                            const originalItemIndex = savedItems.findIndex(item => item.id === existingItem.id);
                                            if (originalItemIndex !== -1) {
                                                const mergedItem = mergeContent(newItem, savedItems[originalItemIndex], mergeAction);
                                                savedItems[originalItemIndex] = mergedItem;
                                                itemUpdated = true;
                                                updatedItemId = existingItem.id;
                                                console.log(`Item ${updatedItemId} action: ${mergeAction}`);
                                            }
                                        }
                                        break; 
                                    } // end if diff
                                } // end if existingVNodes
                            } catch (compareError) { console.error(`Compare error for ${existingItem.id}:`, compareError); }
                        } // end for loop
                     } // end if newVNodes > 0
                    // --- End Merge/Update Logic ---
                } else {
                    // Non-text items, no merge needed
                    shouldSaveNew = true;
                }

                // --- Final Save Decision ---
                if (itemUpdated) {
                    console.log("[DEBUG] Action: Updating existing item (HTML only)...");
                    chrome.storage.local.set({ savedItems: savedItems as any }, function() { // Use type assertion for storage set
                        if (chrome.runtime.lastError) { 
                            console.error("[DEBUG] Storage set error (update):", chrome.runtime.lastError);
                            sendResponse({ success: false, error: chrome.runtime.lastError.message }); 
                            return; 
                        }
                        console.log(`[DEBUG] Item (ID: ${updatedItemId}) update saved successfully.`);
                        console.log(`Item (ID: ${updatedItemId}) updated/merged successfully.`);
                        if (currentTab && currentTab.id) { try { let ni = savedItems.find(it => it.id === updatedItemId) || newItem; chrome.tabs.sendMessage(currentTab.id, { action: "savingComplete", item: ni }); } catch (e) { console.error('Send msg error:', e); } }
                        chrome.action.setBadgeText({ text: savedItems.length.toString() });
                        chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
                        // 상태와 메시지 포함하여 응답
                        sendResponse({
                            success: true,
                            status: 'item_updated', // 업데이트 상태
                            itemId: updatedItemId,
                            message: "항목이 업데이트되었습니다." // 사용자 메시지
                        });
                     });
                } else if (isDuplicate) {
                    console.log("[DEBUG] Action: Skipping duplicate item (HTML only)...");
                    // 상태와 메시지 포함하여 응답 (실패로 처리)
                    sendResponse({
                        success: false, // 중복 저장은 실패로 간주
                        status: 'skipped_duplicate', // 건너뛰기 상태
                        error: "유사한 항목이 이미 존재하여 저장하지 않았습니다.", // 에러 메시지
                        message: "유사한 항목이 이미 존재하여 저장하지 않았습니다." // 사용자 메시지 (선택적)
                    });
                } else { // shouldSaveNew is true
                    console.log("[DEBUG] Action: Saving new item (HTML only)...");
                    // Push the newItem (which is Omit<CapturedItem, 'displayContent'>)
                    // Need to cast savedItems for storage set
                    savedItems.push(newItem as CapturedItem); 
                    chrome.storage.local.set({ savedItems: savedItems as any }, function() { 
                        if (chrome.runtime.lastError) { 
                            console.error("[DEBUG] Storage set error (new):", chrome.runtime.lastError);
                            sendResponse({ success: false, error: chrome.runtime.lastError.message }); 
                            return; 
                        }
                        console.log('[DEBUG] New item saved successfully.');
                        console.log('New item saved:', newItem.type);
                        if (currentTab && currentTab.id) { try { chrome.tabs.sendMessage(currentTab.id, { action: "savingComplete", item: newItem }); } catch (e) { console.error('Send msg error:', e); } }
                        chrome.action.setBadgeText({ text: savedItems.length.toString() });
                        chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });
                        // 상태 포함하여 응답 (message는 필요시 추가)
                        sendResponse({
                            success: true,
                            status: 'ok', // 정상 저장 상태
                            itemId: newItem.id
                        });
                     });
                }
            } catch (storageError: any) { // <<< Inner catch block >>>
                console.error('Error during storage operation:', storageError);
                sendResponse({success: false, error: storageError.message});
            }
        }); // end storage.local.get

      } catch (outerError: any) { // <<< Outer catch block >>>
          console.error('Error processing captured content:', outerError);
          sendResponse({success: false, error: outerError.message});
      }
      return true; // Indicate async response is intended
    }
    else if (message.action === "openHistoryPage") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("history.html")
      });
      sendResponse({success: true} as Response);
      return false;
    }
    else if (message.action === "downloadItem") {
      const item = message.item as CapturedItem;
      const markdownContent = message.markdownContent; // Get pre-converted Markdown

      if ((item.type === 'text' || item.type === 'html') && typeof markdownContent === 'string') { // Check for markdownContent
        try {
          // Use the pre-converted markdownContent directly
          const blob = new Blob([markdownContent], { type: 'text/markdown' }); // Use markdown MIME type
          const fileReader = new FileReader();
          fileReader.onloadend = function() {
            const dataUrl = fileReader.result as string;
            const safeTitle = (item.pageTitle || 'untitled').replace(/[^a-zA-Z0-9가-힣\s]/g, '_').substring(0, 30);
            const extension = 'md'; // Set extension to md
            chrome.downloads.download({
              url: dataUrl,
              filename: `${safeTitle}-${item.id}.${extension}` // Use .md extension
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('Markdown 다운로드 오류:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message } as Response);
              } else {
                sendResponse({ success: true, downloadId: downloadId } as Response);
              }
            });
          };

          fileReader.onerror = function() {
            console.error('파일 읽기 오류');
            sendResponse({ success: false, error: 'FileReader 오류' } as Response);
          };

          fileReader.readAsDataURL(blob);
        } catch (error: any) {
          console.error('Markdown 다운로드 오류:', error);
          sendResponse({ success: false, error: error.message } as Response);
        }
      } else if (item.type === 'image') {
        // Image download logic remains the same
        try {
          const imgContent = item.content as ImageContent;
          const extension = imgContent.type ? imgContent.type.split('/')[1] : 'png';
          const safeTitle = (item.pageTitle || 'image').replace(/[^a-zA-Z0-9가-힣\s]/g, '_').substring(0, 30);
          const filename = imgContent.name ? `${safeTitle}-${imgContent.name}` : `${safeTitle}-${item.id}.${extension}`;

          chrome.downloads.download({
            url: imgContent.dataUrl,
            filename: filename
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('이미지 다운로드 오류:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message } as Response);
            } else {
              sendResponse({ success: true, downloadId: downloadId } as Response);
            }
          });
        } catch (error: any) {
          console.error('이미지 다운로드 오류:', error);
          sendResponse({ success: false, error: error.message } as Response);
        }
      } else {
          // Handle cases where markdownContent is missing for text/html types
          console.error('다운로드할 Markdown 콘텐츠가 없거나 타입이 잘못되었습니다.', item.type);
          sendResponse({success: false, error: 'Markdown 콘텐츠 누락 또는 잘못된 타입'} as Response)
      }


      return true; // 비동기 응답
    }
    else if (message.action === "extractContent") {
      const itemId = message.itemId as number;
      if (!itemId) {
        console.error('항목 ID가 필요합니다.');
        sendResponse({success: false, error: '항목 ID가 필요합니다.'} as Response);
        return true;
      }
      
      extractContentFromSavedHtml(itemId)
        .then(extractedContent => {
          sendResponse({success: true, extractedContent} as Response);
        })
        .catch(error => {
          console.error('콘텐츠 추출 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        });
      
      return true; // 비동기 응답
    }
    else if (message.action === "fetchIframeContent") {
      const url = message.url as string;
      if (!url) {
        console.error('URL이 필요합니다.');
        sendResponse({success: false, error: 'URL이 필요합니다.'} as Response);
        return true;
      }
      
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP 오류: ${response.status}`);
          }
          return response.text();
        })
        .then(html => {
          sendResponse({success: true, html} as Response);
        })
        .catch(error => {
          console.error('iframe 컨텐츠 가져오기 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        });
      
      return true; // 비동기 응답
    }
  } catch (error: any) {
    console.error('메시지 처리 중 오류:', error);
    sendResponse({success: false, error: error.message} as Response);
    return false;
  }
  
  return false;
});

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener((details) => {
  // 저장된 항목 수를 뱃지로 표시
  chrome.storage.local.get(['savedItems'], function(result) {
    const savedItems = result.savedItems || [];
    if (savedItems.length > 0) {
      chrome.action.setBadgeText({
        text: savedItems.length.toString()
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#4285f4'
      });
    }
  });
  
  // 캡처 상태 초기화
  chrome.storage.local.set({isCapturing: false, isHtmlMode: false});
  
  // 컨텍스트 유효 상태로 설정
  isContextValid = true;
});

// 확장 프로그램 컨텍스트 무효화 감지
chrome.runtime.onSuspend.addListener(() => {
  isContextValid = false;
  console.log('확장 프로그램 컨텍스트가 중단되었습니다.');
});

// 확장 프로그램 아이콘 클릭시 뱃지 초기화
chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({ text: '' });
});

function toggleCapturing(isCapturing?: boolean) {
  getCurrentState().then(state => {
    const newState = isCapturing !== undefined ? isCapturing : !state.isCapturing;
    
    // 상태 저장
    chrome.storage.local.set({ isCapturing: newState });
    
    // 콘텐츠 스크립트에 상태 전달
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleCapturing',
          isCapturing: newState
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
    chrome.storage.local.get(['isCapturing', 'isHtmlMode'], (result) => {
      resolve({
        isCapturing: result.isCapturing || false,
        isHtmlMode: result.isHtmlMode || false
      });
    });
  });
}

// 아이콘 업데이트
function updateIcon(isCapturing: boolean) {
  // 활성화/비활성화 상태에 따라 아이콘 변경
  const iconPath = isCapturing 
    ? '/icons/icon-active-48.png' 
    : '/icons/icon-default-48.png';
  
  chrome.action.setIcon({
    path: iconPath
  });
}

// HTML에서 주요 콘텐츠 추출 함수
async function extractContentFromSavedHtml(itemId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['savedItems'], (result) => {
      try {
        const savedItems = result.savedItems || [];
        const itemIndex = savedItems.findIndex((i: CapturedItem) => i.id === itemId);
        
        if (itemIndex === -1 || savedItems[itemIndex].type !== 'html') {
          return reject(new Error('HTML 항목을 찾을 수 없음'));
        }
        
        const item = savedItems[itemIndex];
        
        // 이미 추출된 콘텐츠가 있는지 확인
        if (item.meta?.extractedContent) {
          console.log('이미 추출된 콘텐츠가 있습니다.');
          return resolve(item.meta.extractedContent);
        }
        
        // 외부 라이브러리 동적 로드
        import('@wrtnlabs/web-content-extractor').then(({ extractContent }) => {
          try {
            const htmlContent = item.content as string;
            // 라이브러리가 직접 본문 내용 문자열을 반환
            const extractedText = extractContent(htmlContent);
            console.log('추출된 콘텐츠:', extractedText);
            // 추출된 콘텐츠를 항목 메타데이터에 저장
            const extractedContent = {
              content: extractedText, // 추출된 본문 내용 저장
            };
            
            // 항목 업데이트
            savedItems[itemIndex].meta = {
              ...(item.meta || {}),
              extractedContent
            };
            
            // 업데이트된 목록 저장
            chrome.storage.local.set({ savedItems }, () => {
              console.log('추출된 콘텐츠가 저장되었습니다.');
              resolve(extractedContent);
            });
          } catch (error) {
            console.error('콘텐츠 추출 처리 오류:', error);
            reject(error);
          }
        }).catch(error => {
          console.error('web-content-extractor 로드 오류:', error);
          reject(new Error('콘텐츠 추출 라이브러리 로드 실패'));
        });
      } catch (error) {
        console.error('HTML 콘텐츠 추출 오류:', error);
        reject(error);
      }
    });
  });
} 