// 캡처된 아이템 타입
export type ItemType = "text" | "html" | "image";

// 알림 타입
export type NotificationType = "success" | "info" | "warning" | "error";

// 메타 데이터 타입
export interface MetaData {
  format?: string;
  combinedContent?: boolean;
  itemCount?: number;
  saveType?: "full" | "iframe" | "full_with_iframes" | "error";
  iframeIndex?: number;
  merged?: boolean;
  originalType?: string;
  domPath?: string;
  favicon?: string;
  errorMessage?: string;
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
  markdownContent?: string;
  pageTitle: string;
  pageUrl: string;
  timestamp: Date | string;
  meta?: MetaData;
  userEmail?: string;
}

// 알림 인터페이스
export interface Notification {
  type: NotificationType;
  content: string;
}

// 메시지 액션 타입
export type MessageAction =
  | "contentCaptured"
  | "startCapture"
  | "stopCapture"
  | "savingComplete"
  | "showNotification"
  | "updateCapturingState"
  | "saveFullHtml"
  | "saveIframesHtml"
  | "downloadItem"
  | "openHistoryPage"
  | "toggleCapturing"
  | "contentScriptReady"
  | "contentScriptCheck"
  | "generateAiSummary"
  | "fetchIframeContent"
  | "createProblemRequest";

// 병합 액션 타입
export type MergeAction = "append" | "prepend" | "replace" | "none";

// 메시지 인터페이스
export interface Message {
  action: MessageAction;
  type?: ItemType;
  content?: string | ImageContent;
  markdownContent?: string;
  meta?: MetaData;
  item?: CapturedItem | Notification;
  isCapturing?: boolean;
  isHtmlMode?: boolean;
  capturingState?: boolean;
  htmlMode?: boolean;
  url?: string;
  summaryId?: string;
  quizCount?: number;
  quizTypes?: string[];
  userEmail?: string;
  authToken?: string;
  pageUrl?: string;
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
  status?: string;
  message?: string;
  ready?: boolean;
  isCapturing?: boolean;
  isHtmlMode?: boolean;
  html?: string;
  problemId?: string;
  updatedGroup?: UrlGroup;
}

// URL 그룹 인터페이스
export interface UrlGroup {
  url: string;
  title: string;
  favicon?: string;
  timestamp: Date | string;
  items: CapturedItem[];
  userEmail?: string;
  summaryId?: string;
  summaryContent?: string;
  summaryType?: string;
  problemId?: string;
}
