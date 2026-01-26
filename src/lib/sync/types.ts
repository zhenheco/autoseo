/**
 * 文章同步模組類型定義
 */

import type { Tables } from "@/types/database.types";

// 資料庫類型別名
export type ArticleSyncLog = Tables<"article_sync_logs">;

// 外部網站類型（從 website_configs 查詢 website_type = 'external'）
export type ExternalWebsite = Tables<"website_configs"> & {
  website_type: "external";
};

// SyncTarget 現在是 ExternalWebsite 的別名（向後相容）
export type SyncTarget = ExternalWebsite;

/**
 * 外部網站（同步目標）
 * 從 website_configs 查詢 website_type = 'external' 的資料
 */
export interface ExternalWebsiteTarget {
  id: string;
  website_name: string;
  external_slug: string | null;
  webhook_url: string;
  webhook_secret: string | null;
  sync_on_publish: boolean;
  sync_on_update: boolean;
  sync_on_unpublish: boolean;
  sync_translations: boolean;
  sync_languages: string[];
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

/**
 * 同步操作類型
 */
export type SyncAction = "create" | "update" | "delete";

/**
 * 同步狀態
 */
export type SyncStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "retrying";

/**
 * Webhook Payload - 發送給外部專案的資料
 */
export interface WebhookPayload {
  // 事件資訊
  event: "article.created" | "article.updated" | "article.deleted";
  timestamp: string;

  // 文章資料
  article: SyncedArticleData;

  // 元資料
  metadata?: {
    source: string;
    version: string;
  };
}

/**
 * 同步的文章資料結構
 * 這是傳送給外部專案的標準化格式
 */
export interface SyncedArticleData {
  // 識別資訊
  source_id: string; // Z-1wayseo 的 article ID
  slug: string;

  // 內容
  title: string;
  excerpt: string | null;
  html_content: string;
  markdown_content?: string;

  // 分類和標籤
  categories: string[];
  tags: string[];

  // 多語系
  language: string;
  translations?: SyncedTranslationData[];

  // SEO
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  keywords: string[];

  // 媒體
  featured_image_url: string | null;
  featured_image_alt: string | null;

  // 閱讀資訊
  word_count: number | null;
  reading_time: number | null;

  // 時間戳記
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 同步的翻譯資料結構
 */
export interface SyncedTranslationData {
  language: string;
  title: string;
  slug: string;
  excerpt: string | null;
  html_content: string;
  seo_title: string | null;
  seo_description: string | null;
}

/**
 * Webhook 回應
 */
export interface WebhookResponse {
  success: boolean;
  message?: string;
  received_at?: string;
}

/**
 * 同步結果
 */
export interface SyncResult {
  success: boolean;
  sync_target_id: string;
  sync_target_slug: string;
  article_id: string;
  action: SyncAction;
  response_status?: number;
  error_message?: string;
  duration_ms?: number;
}

/**
 * 批次同步結果
 */
export interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  results: SyncResult[];
}

/**
 * 同步服務配置
 */
export interface SyncServiceConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  batchSize?: number;
}

/**
 * Webhook 發送選項
 */
export interface WebhookSendOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * HMAC 簽章資訊
 */
export interface WebhookSignature {
  signature: string;
  timestamp: number;
}
