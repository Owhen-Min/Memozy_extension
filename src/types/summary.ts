export interface SummarySourceRequest {
  type: number;
  title: string;
  context: string;
  url: string;
}

export interface SummarySourceResponse {
  data?: string;
  errorMsg?: string;
  errorCode?: string;
}