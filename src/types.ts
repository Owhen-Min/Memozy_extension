// 캡처된 아이템 타입
export type ItemType = 'text' | 'html' | 'image' | 'error';

// 알림 타입
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

// 이미지 콘텐츠 인터페이스
export interface ImageContent {
  dataUrl: string;
  type: string;
  name: string;
}

// 병합 전략 타입 정의
export type MergeAction = 'replace' | 'append' | 'prepend' | 'none';

// 메타데이터 인터페이스
export interface MetaData {
  format?: string;
  saveType?: 'full' | 'iframe' | 'full_with_iframes' | 'error';
  iframeIndex?: number;
  combinedContent?: boolean;
  merged?: boolean;
  lastMergeTimestamp?: string;
  originalType?: string;
  errorMessage?: string;
  extractedContent?: {
    content?: string;
  };
  domPath?: string;
  originalHtml?: string;
}

// 캡처된 아이템 인터페이스
export interface CapturedItem {
  id: number;
  type: ItemType;
  content: string | ImageContent;
  pageTitle: string;
  pageUrl: string;
  timestamp: Date | string;
  meta?: MetaData;
  summaryId?: string;
  problemId?: string;
}

// 알림 인터페이스
export interface Notification {
  type: NotificationType;
  message: string;
  duration?: number;
}

// 메시지 액션 타입
export type MessageAction = 
  | 'startCapture'
  | 'stopCapture'
  | 'savingComplete'
  | 'showNotification'
  | 'updateCapturingState'
  | 'saveFullHtml'
  | 'saveIframesHtml'
  | 'toggleCapturing'
  | 'toggleHtmlMode'
  | 'contentScriptReady'
  | 'contentScriptCheck'
  | 'contentCaptured'
  | 'openHistoryPage'
  | 'downloadItem'
  | 'extractContent'
  | 'fetchIframeContent'
  | 'generateAiSummary';

// 메시지 인터페이스
export interface Message {
  action: MessageAction;
  type?: ItemType;
  content?: string | ImageContent;
  meta?: MetaData;
  item?: CapturedItem | Notification;
  isCapturing?: boolean;
  isHtmlMode?: boolean;
  itemId?: number; // 콘텐츠 추출을 위한 아이템 ID
  url?: string; // iframe URL을 위한 속성
}

// 응답 인터페이스
export interface Response {
  success: boolean;
  error?: string;
  itemId?: number;
  downloadId?: number;
  extractedContent?: any;
  html?: string;
  status?: 'ok' | 'skipped_duplicate' | 'item_updated' | 'error';
  message?: string;
}

// 스토리지 상태 인터페이스
export interface StorageState {
  savedItems: CapturedItem[];
  isCapturing: boolean;
  isHtmlMode: boolean;
} 