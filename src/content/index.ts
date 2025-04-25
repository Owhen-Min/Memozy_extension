import { Message, CapturedItem } from '../types';
import { extractContent } from '@wrtnlabs/web-content-extractor';
import TurndownService from 'turndown';

console.log('드래그 & 저장 콘텐츠 스크립트 로드됨');

// 페이지에 스크립트가 로드되었음을 알림
document.addEventListener('DOMContentLoaded', () => {
  // 초기 로드 시 5회 시도
  let retryCount = 0;
  const maxRetries = 5;
  const retryInterval = 1000; // 1초

  const sendReadyMessage = () => {
    chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('초기 메시지 전송 오류:', chrome.runtime.lastError);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`콘텐츠 스크립트 준비 메시지 재시도 (${retryCount}/${maxRetries})...`);
          setTimeout(sendReadyMessage, retryInterval);
        }
      } else {
        console.log('콘텐츠 스크립트 준비 상태 전송됨');
      }
    });
  };

  // 첫 번째 시도
  sendReadyMessage();
});

// 안전한 메시지 전송 함수
const sendMessageToBackground = (message: Message): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('메시지 전송 오류:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else if (response && !response.success) {
          console.error('메시지 응답 실패:', response.error);
          reject(new Error(response.error || '알 수 없는 오류'));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error('메시지 전송 중 예외 발생:', error);
      reject(error);
    }
  });
};

// 상태 관리
let isCapturing = false;
let isHtmlMode = true; // 항상 HTML 모드 활성화
let lastCapturedContent: string | null = null;

// 확장 설정 상태 초기화
chrome.storage.local.get(['isCapturing'], (result) => {
  isCapturing = result.isCapturing || false;
  console.log(`초기 캡처 상태: ${isCapturing ? '활성화' : '비활성화'}`);
  console.log(`HTML 모드: 항상 활성화`);
});

// 스토리지 변경 감지
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isCapturing) {
    isCapturing = changes.isCapturing.newValue;
    console.log(`캡처 상태 변경: ${isCapturing ? '활성화' : '비활성화'}`);
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('메시지 수신됨:', message.action);

  // 캡처 상태 변경 메시지
  if (message.action === 'toggleCapturing' || message.action === 'startCapture' || message.action === 'stopCapture') {
    isCapturing = message.isCapturing !== undefined ? message.isCapturing : !isCapturing;
    console.log(`캡처 모드: ${isCapturing ? '활성화' : '비활성화'}`);
    sendResponse({ success: true, received: true });
    return true;
  }
  
  // HTML 모드 변경 메시지 - 항상 HTML 모드 유지
  if (message.action === 'toggleHtmlMode' || message.action === 'updateCapturingState') {
    if (message.isCapturing !== undefined) {
      isCapturing = message.isCapturing;
    }
    console.log(`HTML 모드: 항상 활성화`);
    console.log(`캡처 모드: ${isCapturing ? '활성화' : '비활성화'}`);
    sendResponse({ success: true, received: true });
    return true;
  }
  
  // 전체 HTML 저장 메시지
  if (message.action === 'saveFullHtml') {
    try {
      console.log('전체 HTML 저장 요청됨');
      // 현재 페이지 HTML만 저장
      savePageHtml()
        .then((result) => {
          // 결과 상태와 에러 메시지 그대로 전달
          sendResponse({ 
            success: result.success, 
            error: result.error 
          });
        })
        .catch(error => {
          console.error('페이지 HTML 저장 오류:', error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true; // 비동기 응답을 위해 true 반환
    } catch (error: any) {
      console.error('HTML 저장 처리 중 오류:', error);
      sendResponse({ success: false, error: error.message });
      return true; // 비동기 응답을 위해 true 반환
    }
  }
  
  // 저장 완료 메시지 (알림용)
  if (message.action === 'savingComplete') {
    try {
      showNotification(message.item as CapturedItem);
      sendResponse({ success: true });
    } catch (error: any) {
      console.error('알림 표시 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 콘텐츠 스크립트 준비 확인
  if (message.action === 'contentScriptCheck') {
    sendResponse({ 
      success: true, 
      ready: true, 
      isCapturing: isCapturing,
      isHtmlMode: isHtmlMode
    });
    return true; // 비동기 응답을 위해 true 반환
  }

  // 기본 응답
  sendResponse({ success: false, error: '처리되지 않은 메시지 형식' });
  return true; // 비동기 응답을 위해 true 반환
});

// 드래그 이벤트 처리 수정
document.addEventListener('mouseup', async (e) => {
  if (!isCapturing) return;
  
  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const selectedText = selection.toString().trim();
    if (!selectedText) return;
    
    console.log('텍스트 선택됨:', selectedText.length, '자');
    
    // 이미 저장된 동일한 텍스트가 있는지 확인
    if (lastCapturedContent === selectedText) {
      console.log('동일한 텍스트 중복 방지');
      return;
    }
    
    lastCapturedContent = selectedText;
    
    // 선택된 범위의 HTML 가져오기
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const htmlContent = tempDiv.innerHTML;
    
    // HTML에서 텍스트 추출
    const extractedText = await extractContent(htmlContent);
    
    // HTML과 추출된 텍스트 모두 저장
    try {
      await sendMessageToBackground({
        action: 'contentCaptured',
        type: 'text',
        content: extractedText,
        meta: {
          format: 'plain',
          originalType: 'html'
        }
      });
      console.log('HTML 텍스트 추출 및 저장 성공');
    } catch (error) {
      console.error('텍스트 저장 실패:', error);
    }
  } catch (error) {
    console.error('텍스트 처리 오류:', error);
  }
});

// 이미지 드래그 처리
document.addEventListener('dragstart', async (e) => {
  if (!isCapturing) return;
  
  try {
    const target = e.target as HTMLElement;
    
    // 이미지 드래그 감지
    if (target.tagName === 'IMG') {
      const imgElement = target as HTMLImageElement;
      if (!imgElement.src) return;
      
      console.log('이미지 드래그 감지:', imgElement.src);
      
      // 이미지를 Data URL로 변환
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('캔버스 컨텍스트를 가져올 수 없음');
        return;
      }
      
      // 이미지 그리기 및 데이터 URL 가져오기
      context.drawImage(imgElement, 0, 0);
      let dataUrl: string;
      
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (error) {
        console.error('이미지 데이터 URL 변환 오류:', error);
        // 오류 발생 시 원본 이미지 URL 사용
        dataUrl = imgElement.src;
      }
      
      // 이미지 파일 이름 추출
      const imgNameMatch = imgElement.src.match(/([^/]+)\.(?:jpe?g|png|gif|bmp|webp)(?:\?.*)?$/i);
      const imgName = imgNameMatch ? imgNameMatch[1] : `image-${Date.now()}`;
      
      // 안전한 메시지 전송 함수 사용
      try {
        await sendMessageToBackground({
          action: 'contentCaptured',
          type: 'image',
          content: {
            dataUrl: dataUrl,
            type: 'image/png',
            name: `${imgName}.png`
          },
          meta: {
            format: 'png'
          }
        });
        console.log('이미지 저장 성공');
      } catch (error) {
        console.error('이미지 저장 실패:', error);
      }
    }
  } catch (error) {
    console.error('이미지 처리 오류:', error);
  }
});

// 알림 표시 함수
function showNotification(item: CapturedItem) {
  try {
    // 이미 알림 컨테이너가 있는지 확인
    let container = document.getElementById('drag-save-notification-container');
    
    // 없으면 생성
    if (!container) {
      container = document.createElement('div');
      container.id = 'drag-save-notification-container';
      
      // 스타일 적용
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
        maxWidth: '300px'
      });
      
      document.body.appendChild(container);
    }
    
    // 알림 요소 생성
    const notification = document.createElement('div');
    
    // 아이템 타입별 알림 내용 설정
    let message = '';
    let bgColor = '';
    
    switch (item.type) {
      case 'text':
        message = '텍스트가 저장되었습니다.';
        bgColor = 'linear-gradient(135deg, #4CAF50, #388E3C)';
        break;
      case 'image':
        message = '이미지가 저장되었습니다.';
        bgColor = 'linear-gradient(135deg, #2196F3, #1976D2)';
        break;
      case 'error':
        message = item.meta?.errorMessage || '새로고침 후 시도해주세요.';
        bgColor = 'linear-gradient(135deg, #FF9800, #F57C00)';
        break;
      default:
        message = '콘텐츠가 저장되었습니다.';
        bgColor = 'linear-gradient(135deg, #9C27B0, #7B1FA2)';
    }
    
    // 알림 스타일 적용
    Object.assign(notification.style, {
      padding: '12px 16px',
      background: bgColor,
      color: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      marginBottom: '10px',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
      opacity: '0',
      transform: 'translateX(20px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      position: 'relative',
      maxWidth: '100%'
    });
    
    // 알림 내용 설정
    notification.textContent = message;
    
    // 컨테이너에 추가
    container.appendChild(notification);
    
    // 애니메이션 효과 (브라우저 렌더링 사이클을 고려해 약간의 딜레이 적용)
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // 3초 후 알림 제거
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(20px)';
      
      // 제거 애니메이션 완료 후 DOM에서 실제 제거
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  } catch (error) {
    console.error('알림 생성 오류:', error);
  }
}

// 현재 페이지의 HTML 저장 후 텍스트 추출
async function savePageHtml(): Promise<{ success: boolean; error?: string }> {
  try {
    let html: string | null = null;
    const hostname = window.location.hostname;
    const errorMessages: { [key: string]: string } = {
      'blog.naver.com': '네이버 블로그 글 안에서 캡처 버튼을 눌러주세요.',
      'velog.io': '벨로그 글 안에서 캡처 버튼을 눌러주세요.',
      'tistory': '티스토리 글에서 캡처 버튼을 눌러주세요.'
    };
    
    // 사이트별 HTML 컨텐츠 추출 로직
    if (hostname === 'blog.naver.com') {
      const iframe = document.body.querySelector('iframe');
      if (iframe && iframe.src) {
        const iframeSrc = iframe.src;
        console.log('네이버 블로그 페이지 저장 시작:', iframeSrc);
        
        try {
          const response = await sendMessageToBackground({
            action: 'fetchIframeContent',
            url: iframeSrc
          });
          
          if (response && response.html) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(response.html, 'text/html');
              const wholeBodyDiv = doc.getElementById('postListBody');
              
              if (wholeBodyDiv) {
                console.log('whole-body div를 찾았습니다.');
                html = wholeBodyDiv.outerHTML;
              }
            } catch (parseError) {
              console.error('HTML 파싱 오류:', parseError);
            }
          }
        } catch (error) {
          console.error('네이버 블로그 iframe 처리 오류:', error);
        }
      }
    } else if (hostname === 'velog.io') {
      const content = document.querySelector('.atom-one');
      if (content) {
        console.log('velog 컨텐츠 저장 시작');
        html = content.outerHTML;
      }
    } else if (hostname.endsWith('.tistory.com')) {
      console.log('티스토리 블로그 페이지 저장 시작');
      const content = document.querySelector('.entry-content');
      if (content) {
        html = content.outerHTML;
      }
    } else {
      // 일반 페이지는 전체 HTML 저장
      const doctype = document.doctype ? 
        new XMLSerializer().serializeToString(document.doctype) : '';
      html = doctype + document.documentElement.outerHTML;
    }
    
    // HTML 추출 실패 시 에러 반환
    if (!html) {
      let errorMsg = '콘텐츠를 찾을 수 없습니다.';
      
      // 해당 사이트에 맞는 에러 메시지 찾기
      for (const key in errorMessages) {
        if (hostname === key || hostname.endsWith(`.${key}`)) {
          errorMsg = errorMessages[key];
          break;
        }
      }
      
      showNotification({
        id: 0,
        type: 'error',
        pageTitle: '',
        pageUrl: '',
        timestamp: new Date(),
        content: '',
        meta: { errorMessage: errorMsg }
      });
      
      return { success: false, error: errorMsg };
    }
    
    const turndownService = new TurndownService();
    const extractedText = turndownService.turndown(html);
    
    await sendMessageToBackground({
      action: 'contentCaptured',
      type: 'text',
      content: extractedText,
      meta: {
        format: 'plain',
        originalType: 'html',
        saveType: 'full'
      }
    });
    
    console.log('HTML 텍스트 추출 및 저장 성공');
    return { success: true };
    
  } catch (error: any) {
    console.error('HTML 저장 중 오류:', error);
    return { success: false, error: error.message || 'HTML 저장 중 오류가 발생했습니다' };
  }
}
 