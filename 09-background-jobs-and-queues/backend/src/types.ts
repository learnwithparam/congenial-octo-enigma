export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export interface ReportJobData {
  reportType: "daily" | "weekly" | "monthly";
  userId?: string;
}

export interface JobStatusResponse {
  id: string;
  name: string;
  state: string;
  progress: string | boolean | number | object;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
  timestamp: number;
}
