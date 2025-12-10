/**
 * Google Analytics 與 Search Console 整合類型定義
 */

// ================================================
// 資料庫類型
// ================================================

/** Google OAuth Token 服務類型 */
export type GoogleServiceType = "gsc" | "ga4";

/** OAuth Token 狀態 */
export type GoogleOAuthStatus = "active" | "expired" | "revoked" | "error";

/** Google OAuth Token 資料庫記錄 */
export interface GoogleOAuthToken {
  id: string;
  website_id: string;
  company_id: string;
  service_type: GoogleServiceType;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  scopes: string[];
  google_account_email: string | null;
  gsc_site_url: string | null;
  gsc_verified_at: string | null;
  ga4_property_id: string | null;
  ga4_stream_id: string | null;
  ga4_measurement_id: string | null;
  status: GoogleOAuthStatus;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Cookie 同意記錄 */
export interface CookieConsentLog {
  id: string;
  visitor_id: string;
  analytics_consent: boolean;
  marketing_consent: boolean;
  consent_version: string;
  ip_country: string | null;
  user_agent: string | null;
  consented_at: string;
  updated_at: string;
}

/** 分析數據快取記錄 */
export interface AnalyticsDataCache {
  id: string;
  website_id: string;
  data_type: string;
  date_start: string;
  date_end: string;
  filter_params: Record<string, unknown>;
  data: unknown;
  row_count: number;
  cached_at: string;
  expires_at: string;
}

// ================================================
// Cookie 同意類型
// ================================================

/** Cookie 同意狀態 */
export interface CookieConsentState {
  necessary: boolean; // 必要 Cookie，始終為 true
  analytics: boolean; // 分析 Cookie（GA4 等）
  marketing: boolean; // 行銷 Cookie
}

/** 儲存在 localStorage 的同意數據 */
export interface StoredCookieConsent {
  consent: CookieConsentState;
  version: string;
  timestamp: number;
}

/** Cookie 同意 Context 類型 */
export interface CookieConsentContextType {
  consent: CookieConsentState;
  hasConsented: boolean;
  isLoading: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (consent: Partial<CookieConsentState>) => void;
  openSettings: () => void;
  closeSettings: () => void;
  isSettingsOpen: boolean;
}

// ================================================
// GSC API 類型
// ================================================

/** GSC 網站資訊 */
export interface GSCSite {
  siteUrl: string;
  permissionLevel:
    | "siteOwner"
    | "siteFullUser"
    | "siteRestrictedUser"
    | "siteUnverifiedUser";
}

/** GSC 搜尋效能數據列 */
export interface GSCPerformanceRow {
  keys: string[]; // 維度值（日期、查詢、頁面等）
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** GSC 搜尋效能回應 */
export interface GSCPerformanceResponse {
  rows: GSCPerformanceRow[];
  responseAggregationType: string;
}

/** GSC 查詢數據（整理後） */
export interface GSCQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** GSC 頁面數據（整理後） */
export interface GSCPageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** GSC 每日效能數據（整理後） */
export interface GSCDailyPerformance {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** GSC 效能摘要 */
export interface GSCPerformanceSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  rows: GSCDailyPerformance[];
}

// ================================================
// GA4 API 類型
// ================================================

/** GA4 Property 資訊 */
export interface GA4Property {
  name: string; // 格式: properties/123456789
  displayName: string;
  createTime: string;
  updateTime: string;
  parent: string; // 格式: accounts/123456789
  industryCategory?: string;
  timeZone: string;
  currencyCode: string;
}

/** GA4 Data Stream 資訊 */
export interface GA4DataStream {
  name: string; // 格式: properties/123456789/dataStreams/987654321
  type: "WEB_DATA_STREAM" | "ANDROID_APP_DATA_STREAM" | "IOS_APP_DATA_STREAM";
  displayName: string;
  webStreamData?: {
    measurementId: string; // G-XXXXXXXXXX
    firebaseAppId?: string;
    defaultUri: string;
  };
  createTime: string;
  updateTime: string;
}

/** GA4 流量數據列 */
export interface GA4TrafficRow {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

/** GA4 事件數據列 */
export interface GA4EventRow {
  eventName: string;
  eventCount: number;
  users: number;
}

/** GA4 流量摘要 */
export interface GA4TrafficSummary {
  totalSessions: number;
  totalUsers: number;
  totalPageviews: number;
  avgBounceRate: number;
  avgSessionDuration: number;
  rows: GA4TrafficRow[];
}

// ================================================
// OAuth 類型
// ================================================

/** Google OAuth 授權請求參數 */
export interface GoogleOAuthAuthorizeParams {
  websiteId: string;
  serviceType: GoogleServiceType;
  redirectUri?: string;
}

/** Google OAuth Token 回應 */
export interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

/** Google 用戶資訊 */
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  picture?: string;
}

// ================================================
// 網站 OAuth 狀態
// ================================================

/** 網站 OAuth 連接狀態 */
export interface WebsiteOAuthStatus {
  gsc_connected: boolean;
  gsc_email: string | null;
  gsc_site_url: string | null;
  ga4_connected: boolean;
  ga4_email: string | null;
  ga4_property_id: string | null;
}

// ================================================
// API 請求/回應類型
// ================================================

/** 分析數據請求參數 */
export interface AnalyticsDataRequest {
  websiteId: string;
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  metrics?: string[];
}

/** API 錯誤回應 */
export interface AnalyticsApiError {
  error: string;
  code?: string;
  details?: string;
}

/** 通用 API 回應 */
export type AnalyticsApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: AnalyticsApiError };
