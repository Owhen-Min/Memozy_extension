// 캡처된 아이템 타입
export type ItemType = 'text' | 'html' | 'image';

// 알림 타입
export type NotificationType = 'success' | 'info' | 'warning' | 'error';

// 메타 데이터 타입
export interface MetaData {
  format?: string;
  combinedContent?: boolean;
  itemCount?: number;
  saveType?: 'full' | 'iframe' | 'full_with_iframes';
  iframeIndex?: number;
  merged?: boolean;
  originalType?: string;
}

// 이미지 콘텐츠 타입
export interface ImageContent {
  dataUrl: string;
  type: string;
  name?: string;
}

// 캡처된 아이템 인터페이스
export interface CapturedItem {
  id: number;
  type: ItemType;
  content: string | ImageContent;
  pageTitle: string;
  pageUrl: string;
  timestamp: Date;
  meta?: MetaData;
}

// 알림 인터페이스
export interface Notification {
  type: NotificationType;
  content: string;
}

// 메시지 액션 타입
export type MessageAction = 
  | 'contentCaptured'
  | 'startCapture'
  | 'stopCapture'
  | 'savingComplete'
  | 'showNotification'
  | 'updateCapturingState'
  | 'saveFullHtml'
  | 'saveIframesHtml'
  | 'downloadItem'
  | 'openHistoryPage'
  | 'toggleCapturing'
  | 'toggleHtmlMode'
  | 'contentScriptReady'
  | 'contentScriptCheck';

// 메시지 인터페이스
export interface Message {
  action: MessageAction;
  type?: ItemType;
  content?: string | ImageContent;
  meta?: MetaData;
  item?: CapturedItem | Notification;
  isCapturing?: boolean;
  isHtmlMode?: boolean;
  capturingState?: boolean;
  htmlMode?: boolean;
}

// 스토리지 상태 인터페이스
export interface StorageState {
  savedItems: CapturedItem[];
  isCapturing: boolean;
  isHtmlMode: boolean;
}

// 응답 인터페이스
export interface Response {
  success: boolean;
  error?: string;
  itemId?: number;
  downloadId?: number;
} 