// 캡처된 아이템 타입
export type ItemType = "text" | "image" | "error";

// 알림 타입
export type NotificationType = "success" | "error" | "info" | "warning";

// 이미지 콘텐츠 인터페이스
export interface ImageContent {
  dataUrl: string;
  type: string;
  name: string;
}

// 병합 전략 타입 정의
export type MergeAction = "replace" | "append" | "prepend" | "none";

// 메타데이터 인터페이스
export interface MetaData {
  format?: string;
  saveType?: "full" | "iframe" | "full_with_iframes" | "error";
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
  favicon?: string;
}

// 캡처된 아이템 인터페이스
export interface CapturedItem {
  id: number;
  type: ItemType;
  content: string | ImageContent;
  pageTitle: string;
  pageUrl: string;
  timestamp: Date | string;
  userEmail?: string;
  meta?: {
    originalType?: string;
    saveType?: string;
    domPath?: string;
    errorMessage?: string;
    favicon?: string;
    format?: string;
  };
}

export interface UrlGroup {
  url: string;
  title: string;
  favicon?: string;
  timestamp: Date | string; // 가장 최근 아이템의 timestamp
  summaryId?: number;
  summaryContent?: string;
  summaryType?: "markdown" | "ai";
  problemId?: number;
  items: CapturedItem[];
  isSubmitted?: boolean;
  userEmail?: string;
}

// 알림 인터페이스
export interface Notification {
  type: NotificationType;
  message: string;
  duration?: number;
}

// 메시지 액션 타입
export type MessageAction =
  | "startCapture"
  | "stopCapture"
  | "savingComplete"
  | "showNotification"
  | "updateCapturingState"
  | "saveFullHtml"
  | "saveIframesHtml"
  | "toggleCapturing"
  | "toggleHtmlMode"
  | "contentScriptReady"
  | "contentScriptCheck"
  | "contentCaptured"
  | "openHistoryPage"
  | "downloadItem"
  | "extractContent"
  | "fetchIframeContent"
  | "generateAiSummary"
  | "createProblemRequest";

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
  url?: string; // iframe URL을 위한 속성 (pageUrl과 용도 구분 필요 시 이름 변경 고려)
  favicon?: string;
  markdownContent?: string; // 아이템 다운로드 시 마크다운 콘텐츠
  summaryId?: number;
  quizCount?: number;
  quizTypes?: string[];
  userEmail?: string;
  authToken?: string;
  pageUrl?: string; // 문제 생성 요청 시, 어떤 페이지의 그룹에 대한 요청인지 식별하기 위함
}

// 응답 인터페이스
export interface Response {
  success: boolean;
  error?: string;
  errorCode?: string; // API 에러 코드 등을 전달하기 위함
  itemId?: number;
  downloadId?: number;
  extractedContent?: any;
  html?: string;
  status?: "ok" | "skipped_duplicate" | "item_updated" | "error" | "problem_created";
  message?: string;
  problemId?: number;
  updatedGroup?: UrlGroup;
}

// 스토리지 상태 인터페이스
export interface StorageState {
  savedItems: CapturedItem[];
  isCapturing: boolean;
  isHtmlMode: boolean;
}
