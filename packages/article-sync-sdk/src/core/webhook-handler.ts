/**
 * Webhook Handler
 * 接收和處理來自 1waySEO 的文章同步 webhook
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  WebhookHandlerConfig,
  WebhookPayload,
  WebhookHandlerResult,
  SignatureVerificationResult,
  SyncedArticle,
} from "./types";

const SIGNATURE_HEADER = "x-webhook-signature";
const TIMESTAMP_HEADER = "x-webhook-timestamp";
const DEFAULT_TABLE_NAME = "synced_articles";

/**
 * 驗證 HMAC-SHA256 簽章
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000
): SignatureVerificationResult {
  // 檢查時間戳是否在有效範圍內
  const now = Date.now();
  const age = now - timestamp;

  if (age > maxAgeMs) {
    return {
      valid: false,
      error: `Signature expired. Age: ${age}ms, Max: ${maxAgeMs}ms`,
    };
  }

  if (age < -60000) {
    return {
      valid: false,
      error: "Signature timestamp is in the future",
    };
  }

  // 生成預期的簽章並比對
  const signaturePayload = `${timestamp}.${payload}`;

  // 注意：這是同步版本，實際使用時建議用 async 版本
  // 為了支援更廣泛的環境，這裡使用同步比對
  const expectedSignature = generateSignatureSync(signaturePayload, secret);

  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * 同步生成簽章（使用 Node.js crypto 或 Web Crypto）
 */
function generateSignatureSync(payload: string, secret: string): string {
  // 嘗試使用 Node.js crypto（較快）
  try {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    return `sha256=${hmac.digest("hex")}`;
  } catch {
    // 如果在瀏覽器環境，這個函數不應該被調用
    // Webhook 處理應該在伺服器端
    throw new Error("Webhook verification must be done on the server side");
  }
}

/**
 * Webhook Handler 類別
 */
export class WebhookHandler {
  private supabase: SupabaseClient;
  private webhookSecret: string;
  private tableName: string;
  private onArticleCreated?: WebhookHandlerConfig["onArticleCreated"];
  private onArticleUpdated?: WebhookHandlerConfig["onArticleUpdated"];
  private onArticleDeleted?: WebhookHandlerConfig["onArticleDeleted"];

  constructor(config: WebhookHandlerConfig) {
    this.webhookSecret = config.webhookSecret;
    this.tableName = config.tableName || DEFAULT_TABLE_NAME;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.onArticleCreated = config.onArticleCreated;
    this.onArticleUpdated = config.onArticleUpdated;
    this.onArticleDeleted = config.onArticleDeleted;
  }

  /**
   * 處理 Webhook 請求
   */
  async handleWebhook(
    body: string,
    signature: string | null,
    timestamp: string | null
  ): Promise<WebhookHandlerResult> {
    // 驗證簽章
    if (!signature || !timestamp) {
      return {
        success: false,
        error: "Missing signature or timestamp headers",
      };
    }

    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      return {
        success: false,
        error: "Invalid timestamp",
      };
    }

    const verifyResult = verifyWebhookSignature(
      body,
      this.webhookSecret,
      signature,
      timestampNum
    );

    if (!verifyResult.valid) {
      return {
        success: false,
        error: verifyResult.error || "Invalid signature",
      };
    }

    // 解析 payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      return {
        success: false,
        error: "Invalid JSON payload",
      };
    }

    // 根據事件類型處理
    try {
      switch (payload.event) {
        case "article.created":
          return await this.handleArticleCreated(payload);
        case "article.updated":
          return await this.handleArticleUpdated(payload);
        case "article.deleted":
          return await this.handleArticleDeleted(payload);
        default:
          return {
            success: false,
            error: `Unknown event type: ${payload.event}`,
          };
      }
    } catch (error) {
      console.error("[WebhookHandler] 處理錯誤:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 處理文章建立事件
   */
  private async handleArticleCreated(
    payload: WebhookPayload
  ): Promise<WebhookHandlerResult> {
    const articleData = this.mapPayloadToArticle(payload);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(articleData, { onConflict: "source_id" })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    // 呼叫 callback
    if (this.onArticleCreated) {
      await this.onArticleCreated(data as SyncedArticle);
    }

    return {
      success: true,
      message: "Article created successfully",
      article_id: data.id,
    };
  }

  /**
   * 處理文章更新事件
   */
  private async handleArticleUpdated(
    payload: WebhookPayload
  ): Promise<WebhookHandlerResult> {
    const articleData = this.mapPayloadToArticle(payload);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert(articleData, { onConflict: "source_id" })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    // 呼叫 callback
    if (this.onArticleUpdated) {
      await this.onArticleUpdated(data as SyncedArticle);
    }

    return {
      success: true,
      message: "Article updated successfully",
      article_id: data.id,
    };
  }

  /**
   * 處理文章刪除事件
   */
  private async handleArticleDeleted(
    payload: WebhookPayload
  ): Promise<WebhookHandlerResult> {
    const sourceId = payload.article.source_id;

    // 軟刪除：更新狀態為 deleted
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        sync_status: "deleted",
        updated_at: new Date().toISOString(),
      })
      .eq("source_id", sourceId);

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    // 呼叫 callback
    if (this.onArticleDeleted) {
      await this.onArticleDeleted(sourceId);
    }

    return {
      success: true,
      message: "Article deleted successfully",
    };
  }

  /**
   * 將 Webhook Payload 映射到文章資料
   */
  private mapPayloadToArticle(payload: WebhookPayload): Record<string, unknown> {
    const article = payload.article;
    const now = new Date().toISOString();

    return {
      source_id: article.source_id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      html_content: article.html_content,
      markdown_content: article.markdown_content || null,
      categories: article.categories || [],
      tags: article.tags || [],
      language: article.language || "zh-TW",
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      focus_keyword: article.focus_keyword,
      keywords: article.keywords || [],
      featured_image_url: article.featured_image_url,
      featured_image_alt: article.featured_image_alt,
      word_count: article.word_count,
      reading_time: article.reading_time,
      published_at: article.published_at,
      synced_at: now,
      sync_status: "active",
      updated_at: now,
    };
  }

  /**
   * 取得簽章和時間戳 header 名稱
   */
  static get SIGNATURE_HEADER(): string {
    return SIGNATURE_HEADER;
  }

  static get TIMESTAMP_HEADER(): string {
    return TIMESTAMP_HEADER;
  }
}

/**
 * 建立 Webhook Handler 實例
 */
export function createWebhookHandler(
  config: WebhookHandlerConfig
): WebhookHandler {
  return new WebhookHandler(config);
}
