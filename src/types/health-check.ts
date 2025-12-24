/**
 * 網站健康檢查相關類型定義
 */

// Job 狀態
export type HealthCheckJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

// 設備類型
export type DeviceType = "mobile" | "desktop";

// 建立健康檢查 Job 的請求
export interface CreateHealthCheckJobRequest {
  url?: string; // 如果未提供，使用網站配置的 URL
  deviceType?: DeviceType;
  includeAiRecommendations?: boolean;
}

// 健康檢查 Job（資料庫記錄）
export interface HealthCheckJob {
  id: string;
  website_id: string;
  company_id: string;
  status: HealthCheckJobStatus;
  url_to_check: string;
  device_type: DeviceType;
  include_ai_recommendations: boolean;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_id: string | null;
  created_at: string;
  updated_at: string;
}

// Core Web Vitals 數據
export interface CoreWebVitals {
  lcp_ms: number | null; // Largest Contentful Paint
  inp_ms: number | null; // Interaction to Next Paint
  cls: number | null; // Cumulative Layout Shift
  fcp_ms: number | null; // First Contentful Paint
  ttfb_ms: number | null; // Time to First Byte
}

// Lighthouse 分數
export interface LighthouseScores {
  performance_score: number | null;
  accessibility_score: number | null;
  seo_score: number | null;
  best_practices_score: number | null;
}

// Meta 標籤分析結果
export interface MetaAnalysis {
  title?: {
    content: string | null;
    length: number;
    issues: string[];
  };
  description?: {
    content: string | null;
    length: number;
    issues: string[];
  };
  canonical?: {
    url: string | null;
    issues: string[];
  };
  ogTags?: {
    title: string | null;
    description: string | null;
    image: string | null;
    issues: string[];
  };
}

// AI 建議
export interface AiRecommendation {
  category: "performance" | "seo" | "accessibility" | "best-practices";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  estimatedImpact?: string;
}

// 健康檢查結果（資料庫記錄）
export interface HealthCheckResult extends CoreWebVitals, LighthouseScores {
  id: string;
  job_id: string;
  website_id: string;
  company_id: string;
  url_checked: string;
  device_type: DeviceType;
  meta_analysis: MetaAnalysis;
  ai_recommendations: AiRecommendation[];
  robots_txt_exists: boolean | null;
  sitemap_exists: boolean | null;
  sitemap_url: string | null;
  created_at: string;
}

// API 回應格式
export interface HealthCheckJobResponse {
  success: boolean;
  job?: HealthCheckJob;
  result?: HealthCheckResult;
  error?: string;
}

export interface HealthCheckHistoryResponse {
  success: boolean;
  jobs?: HealthCheckJob[];
  results?: HealthCheckResult[];
  error?: string;
}
