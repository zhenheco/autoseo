/**
 * 網站健康檢查相關型別定義
 * 用於 SEO 健檢功能，包含 Core Web Vitals、Lighthouse 分數、Meta 分析等
 */

// ============================================================
// 基礎型別
// ============================================================

/** 健檢狀態 */
export type HealthCheckStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 檢查裝置類型 */
export type DeviceType = "mobile" | "desktop";

/** Core Web Vitals 評級 */
export type VitalRating = "good" | "needs-improvement" | "poor";

/** 建議優先級 */
export type RecommendationPriority = "high" | "medium" | "low";

/** 建議分類 */
export type RecommendationCategory =
  | "performance"
  | "seo"
  | "accessibility"
  | "best-practices";

/** 影響/努力程度 */
export type ImpactLevel = "高" | "中" | "低";

// ============================================================
// Core Web Vitals
// ============================================================

/** 單項 Core Web Vital 指標 */
export interface VitalMetric {
  /** 原始數值 */
  value: number;
  /** 評級 */
  rating: VitalRating;
  /** 顯示文字（如 "2.5 秒"） */
  displayValue?: string;
}

/** Core Web Vitals 完整結構 */
export interface CoreWebVitals {
  /** Largest Contentful Paint (毫秒) */
  lcp: VitalMetric;
  /** Interaction to Next Paint (毫秒) */
  inp: VitalMetric;
  /** Cumulative Layout Shift */
  cls: VitalMetric;
  /** First Contentful Paint (毫秒) */
  fcp: VitalMetric;
  /** Time to First Byte (毫秒) */
  ttfb: VitalMetric;
}

/** Core Web Vitals 閾值 */
export const VITAL_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // 毫秒
  inp: { good: 200, poor: 500 }, // 毫秒
  cls: { good: 0.1, poor: 0.25 },
  fcp: { good: 1800, poor: 3000 }, // 毫秒
  ttfb: { good: 800, poor: 1800 }, // 毫秒
} as const;

// ============================================================
// Lighthouse 分數
// ============================================================

/** Lighthouse 綜合分數 */
export interface LighthouseScores {
  /** 效能分數 (0-100) */
  performance: number;
  /** 無障礙分數 (0-100) */
  accessibility: number;
  /** SEO 分數 (0-100) */
  seo: number;
  /** 最佳實踐分數 (0-100) */
  bestPractices: number;
}

// ============================================================
// Meta 標籤分析
// ============================================================

/** 單個 Meta 標籤分析結果 */
export interface MetaTagAnalysis {
  /** 是否存在 */
  exists: boolean;
  /** 內容 */
  content?: string;
  /** 長度 */
  length?: number;
  /** URL（用於 canonical、og:image 等） */
  url?: string;
  /** 問題列表 */
  issues: string[];
}

/** 完整 Meta 標籤分析結果 */
export interface MetaAnalysisResult {
  /** 頁面標題 */
  title: MetaTagAnalysis;
  /** Meta Description */
  description: MetaTagAnalysis;
  /** Open Graph Title */
  ogTitle: MetaTagAnalysis;
  /** Open Graph Description */
  ogDescription: MetaTagAnalysis;
  /** Open Graph Image */
  ogImage: MetaTagAnalysis;
  /** Canonical URL */
  canonical: MetaTagAnalysis;
  /** Robots 指令 */
  robots: MetaTagAnalysis;
  /** Viewport */
  viewport: MetaTagAnalysis;
  /** 整體問題數量 */
  totalIssues: number;
}

// ============================================================
// 結構化資料
// ============================================================

/** 結構化資料分析結果 */
export interface StructuredDataResult {
  /** 是否有 JSON-LD */
  hasJsonLd: boolean;
  /** 發現的 Schema 類型 */
  typesFound: string[];
  /** 問題列表 */
  issues: string[];
  /** 原始 JSON-LD 資料 */
  rawData?: unknown[];
}

// ============================================================
// 基礎 SEO 檢查
// ============================================================

/** robots.txt 檢查結果 */
export interface RobotsTxtResult {
  /** 是否存在 */
  exists: boolean;
  /** 問題列表 */
  issues: string[];
  /** 內容（摘要） */
  content?: string;
}

/** Sitemap 檢查結果 */
export interface SitemapResult {
  /** 是否存在 */
  exists: boolean;
  /** Sitemap URL */
  url?: string;
  /** 問題列表 */
  issues: string[];
  /** URL 數量 */
  urlCount?: number;
}

/** 基礎 SEO 檢查結果 */
export interface BasicSeoResult {
  robotsTxt: RobotsTxtResult;
  sitemap: SitemapResult;
}

// ============================================================
// AI 建議
// ============================================================

/** 單條 AI 改善建議 */
export interface Recommendation {
  /** 唯一識別碼 */
  id: string;
  /** 優先級 */
  priority: RecommendationPriority;
  /** 分類 */
  category: RecommendationCategory;
  /** 標題 */
  title: string;
  /** 詳細說明 */
  description: string;
  /** 預期影響 */
  impact: ImpactLevel;
  /** 實施難度 */
  effort: ImpactLevel;
  /** 具體操作步驟（可選） */
  steps?: string[];
}

// ============================================================
// 健檢結果
// ============================================================

/** 完整健檢結果 */
export interface HealthCheckResult {
  /** 檢查 ID */
  id: string;
  /** 網站 ID */
  websiteId: string;
  /** 公司 ID */
  companyId: string;
  /** 狀態 */
  status: HealthCheckStatus;
  /** 檢查的 URL */
  urlChecked: string;
  /** 裝置類型 */
  deviceType: DeviceType;

  /** Core Web Vitals */
  coreWebVitals: CoreWebVitals;

  /** Lighthouse 分數 */
  scores: LighthouseScores;

  /** Meta 標籤分析 */
  metaAnalysis: MetaAnalysisResult;

  /** 結構化資料分析 */
  structuredData: StructuredDataResult;

  /** 基礎 SEO 檢查 */
  basicSeo: BasicSeoResult;

  /** AI 改善建議 */
  recommendations: Recommendation[];

  /** 錯誤訊息（如果失敗） */
  errorMessage?: string;

  /** 建立時間 */
  createdAt: string;
  /** 開始時間 */
  startedAt?: string;
  /** 完成時間 */
  completedAt?: string;
}

/** 健檢歷史摘要（用於列表顯示） */
export interface HealthCheckSummary {
  id: string;
  websiteId: string;
  status: HealthCheckStatus;
  urlChecked: string;
  deviceType: DeviceType;
  /** Lighthouse 分數 */
  scores: LighthouseScores;
  /** 建議數量 */
  recommendationCount: number;
  /** 建立時間 */
  createdAt: string;
  /** 完成時間 */
  completedAt?: string;
}

// ============================================================
// API Request/Response
// ============================================================

/** 觸發健檢請求 */
export interface TriggerHealthCheckRequest {
  /** 要檢查的 URL（可選，預設為網站首頁） */
  url?: string;
  /** 裝置類型 */
  device?: DeviceType;
  /** 是否包含 AI 建議 */
  includeAIRecommendations?: boolean;
}

/** 觸發健檢回應 */
export interface TriggerHealthCheckResponse {
  success: boolean;
  /** 健檢 ID */
  healthCheckId: string;
  message: string;
  /** 如果同步完成，直接返回結果 */
  result?: HealthCheckResult;
}

/** 健檢歷史查詢參數 */
export interface HealthCheckHistoryParams {
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  pageSize?: number;
  /** 裝置類型篩選 */
  deviceType?: DeviceType;
}

/** 健檢歷史回應 */
export interface HealthCheckHistoryResponse {
  checks: HealthCheckSummary[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============================================================
// PageSpeed API 相關
// ============================================================

/** PageSpeed API 回應（簡化版） */
export interface PageSpeedApiResponse {
  id: string;
  lighthouseResult: {
    categories: {
      performance: { score: number };
      accessibility: { score: number };
      "best-practices": { score: number };
      seo: { score: number };
    };
    audits: {
      "largest-contentful-paint"?: { numericValue: number };
      "interaction-to-next-paint"?: { numericValue: number };
      "cumulative-layout-shift"?: { numericValue: number };
      "first-contentful-paint"?: { numericValue: number };
      "server-response-time"?: { numericValue: number };
      [key: string]: unknown;
    };
    finalUrl: string;
    fetchTime: string;
  };
  loadingExperience?: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number; category: string };
      INTERACTION_TO_NEXT_PAINT?: { percentile: number; category: string };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number; category: string };
      FIRST_CONTENTFUL_PAINT_MS?: { percentile: number; category: string };
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: {
        percentile: number;
        category: string;
      };
    };
  };
}

// ============================================================
// 工具函數型別
// ============================================================

/** 根據數值取得 Vital 評級 */
export function getVitalRating(
  metric: keyof typeof VITAL_THRESHOLDS,
  value: number,
): VitalRating {
  const thresholds = VITAL_THRESHOLDS[metric];
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}

/** 根據分數取得評級顏色 */
export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

/** 根據分數取得背景顏色 */
export function getScoreBackgroundColor(score: number): string {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 50) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

/** 根據評級取得顏色 */
export function getRatingColor(rating: VitalRating): string {
  switch (rating) {
    case "good":
      return "text-green-500";
    case "needs-improvement":
      return "text-yellow-500";
    case "poor":
      return "text-red-500";
  }
}
