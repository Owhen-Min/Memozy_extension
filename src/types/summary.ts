export interface SummarySourceRequest {
  type: number;
  title: string;
  context: string;
  url: string;
}

export interface SummarySourceResponse {
  data?: {
    collectionId: number;
    sourceId: number;
    summary: string;
  };
  errorMsg?: string;
  errorCode?: string;
}
