import { CapturedItem, Message, Response } from '../types';

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

// 콘텐츠 스크립트에서 메시지 받기
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // 메시지 로깅
  console.log('백그라운드 메시지 수신:', message.action, sender.tab?.id);
  
  // 컨텍스트가 무효화되면 모든 메시지 처리 중단
  if (!isContextValid) {
    console.warn('확장 프로그램 컨텍스트가 무효화되었습니다. 메시지 처리 중단.');
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
      // 현재 탭의 정보 가져오기
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length === 0) {
          console.error('활성 탭을 찾을 수 없음');
          sendResponse({success: false, error: '활성 탭을 찾을 수 없음'} as Response);
          return;
        }
        
        const currentTab = tabs[0];
        const pageTitle = currentTab.title || "제목 없음";
        const pageUrl = currentTab.url || "";
        
        console.log('캡처된 콘텐츠 타입:', message.type);
        
        try {
          // 저장할 항목 생성
          const newItem: CapturedItem = {
            id: Date.now(),
            type: message.type!,
            content: message.content!,
            pageTitle: pageTitle,
            pageUrl: pageUrl,
            timestamp: new Date().toISOString()
          };
          
          // 메타정보가 있으면 추가
          if (message.meta) {
            newItem.meta = message.meta;
          }
          
          // 저장된 항목 목록 가져오기
          chrome.storage.local.get(['savedItems'], function(result) {
            try {
              const savedItems = result.savedItems || [];
              
              // 알림 정보
              let notificationItem: any = {...newItem};
              
              // 페이지별 중복 확인 (동일 URL에 저장된 텍스트를 합치는 기능 - 텍스트만 해당)
              if (message.type === 'text') {
                // 같은 페이지의 마지막 텍스트 항목 찾기
                const samePageLastTextIndex = savedItems.findIndex((item: CapturedItem) => 
                  item.type === 'text' && 
                  item.pageUrl === pageUrl &&
                  !item.meta?.merged // 이미 병합된 항목은 제외
                );
                
                if (samePageLastTextIndex >= 0 && message.meta?.combinedContent) {
                  // 같은 페이지의 기존 텍스트 항목 제거 (새로운 항목으로 대체)
                  savedItems.splice(samePageLastTextIndex, 1);
                  newItem.meta = {...(newItem.meta || {}), merged: true};
                }
              }
              
              // 새 항목 추가
              savedItems.push(newItem);
              
              // 업데이트된 목록 저장
              chrome.storage.local.set({savedItems: savedItems}, function() {
                console.log('항목이 저장되었습니다:', newItem.type);
                
                // 저장 성공 알림 표시
                if (currentTab && currentTab.id) {
                  try {
                    chrome.tabs.sendMessage(currentTab.id, {
                      action: "savingComplete",
                      item: notificationItem
                    });
                  } catch (error) {
                    console.error('알림 메시지 전송 실패:', error);
                  }
                }
                
                // 저장된 항목 수를 뱃지로 표시
                chrome.action.setBadgeText({
                  text: savedItems.length.toString()
                });
                chrome.action.setBadgeBackgroundColor({
                  color: '#4285f4'
                });
                
                // 성공 응답 전송
                sendResponse({success: true, itemId: newItem.id} as Response);
              });
            } catch (error: any) {
              console.error('저장 처리 중 오류:', error);
              sendResponse({success: false, error: error.message} as Response);
            }
          });
        } catch (error: any) {
          console.error('항목 생성 중 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        }
      });
      
      return true; // 비동기 응답 처리
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
      
      if (item.type === 'text') {
        try {
          // Blob 객체 생성 및 다운로드 URL 생성
          const blob = new Blob([item.content as string], {type: 'text/plain'});
          // createObjectURL 직접 호출 대신 간접 방법 사용
          const fileReader = new FileReader();
          fileReader.onloadend = function() {
            const dataUrl = fileReader.result as string;
            
            // 다운로드 파일명에 페이지 제목 포함
            const safeTitle = item.pageTitle
              .replace(/[^a-zA-Z0-9가-힣\s]/g, '_') // 안전하지 않은 문자 대체
              .substring(0, 30); // 길이 제한
            
            chrome.downloads.download({
              url: dataUrl,
              filename: `${safeTitle}-${item.id}.txt`
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('다운로드 오류:', chrome.runtime.lastError);
                sendResponse({success: false, error: chrome.runtime.lastError.message} as Response);
              } else {
                sendResponse({success: true, downloadId: downloadId} as Response);
              }
            });
          };
          
          fileReader.onerror = function() {
            console.error('파일 읽기 오류');
            sendResponse({success: false, error: 'FileReader 오류'} as Response);
          };
          
          fileReader.readAsDataURL(blob);
        } catch (error: any) {
          console.error('텍스트 다운로드 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        }
      } else if (item.type === 'image') {
        try {
          const imgContent = item.content as any; // 타입 캐스팅
          chrome.downloads.download({
            url: imgContent.dataUrl,
            filename: imgContent.name || `image-${item.id}.${imgContent.type.split('/')[1]}`
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('다운로드 오류:', chrome.runtime.lastError);
              sendResponse({success: false, error: chrome.runtime.lastError.message} as Response);
            } else {
              sendResponse({success: true, downloadId: downloadId} as Response);
            }
          });
        } catch (error: any) {
          console.error('이미지 다운로드 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        }
      } else if (item.type === 'html') {
        try {
          // Blob 객체 생성 및 다운로드 URL 생성 (FileReader 사용)
          const blob = new Blob([item.content as string], {type: 'text/html'});
          // createObjectURL 직접 호출 대신 간접 방법 사용
          const fileReader = new FileReader();
          fileReader.onloadend = function() {
            const dataUrl = fileReader.result as string;
            
            // 다운로드 파일명에 페이지 제목 포함
            const safeTitle = item.pageTitle
              .replace(/[^a-zA-Z0-9가-힣\s]/g, '_') // 안전하지 않은 문자 대체
              .substring(0, 30); // 길이 제한
            
            chrome.downloads.download({
              url: dataUrl,
              filename: `${safeTitle}-${item.id}.html`
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('다운로드 오류:', chrome.runtime.lastError);
                sendResponse({success: false, error: chrome.runtime.lastError.message} as Response);
              } else {
                sendResponse({success: true, downloadId: downloadId} as Response);
              }
            });
          };
          
          fileReader.onerror = function() {
            console.error('파일 읽기 오류');
            sendResponse({success: false, error: 'FileReader 오류'} as Response);
          };
          
          fileReader.readAsDataURL(blob);
        } catch (error: any) {
          console.error('HTML 다운로드 오류:', error);
          sendResponse({success: false, error: error.message} as Response);
        }
      } else {
        sendResponse({success: false, error: '지원되지 않는 파일 유형'} as Response);
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