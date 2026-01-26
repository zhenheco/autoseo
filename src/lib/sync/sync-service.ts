/**
 * 文章同步服務
 * 負責將文章同步到已註冊的外部專案
 */

import { createAdminClient } from "@/lib/supabase/server";
import { sendWebhook } from "./webhook-sender";
import type {
  SyncAction,
  SyncResult,
  BatchSyncResult,
  SyncServiceConfig,
  WebhookPayload,
  SyncedArticleData,
  SyncedTranslationData,
  ExternalWebsiteTarget,
  SyncTarget,
} from "./types";
import type { GeneratedArticle } from "@/types/article.types";

// 預設配置
const DEFAULT_CONFIG: Required<SyncServiceConfig> = {
  maxRetries: 3,
  retryDelayMs: 5000,
  timeoutMs: 30000,
  batchSize: 10,
};

/**
 * 文章同步服務
 */
export class ArticleSyncService {
  private config: Required<SyncServiceConfig>;

  constructor(config: SyncServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 同步文章到指定的 sync_targets
   * @param article 要同步的文章
   * @param action 同步操作類型
   * @param targetIds 可選：指定同步目標 ID 列表。若不傳則同步到所有啟用目標；若傳空陣列則不執行同步
   */
  async syncArticle(
    article: GeneratedArticle,
    action: SyncAction,
    targetIds?: string[]
  ): Promise<BatchSyncResult> {
    // 如果明確傳入空陣列，表示不同步
    if (targetIds && targetIds.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    const supabase = createAdminClient();

    // 取得所有啟用的同步目標
    let targets = await this.getActiveSyncTargets(action);

    // 如果有指定 targetIds，過濾目標
    if (targetIds && targetIds.length > 0) {
      targets = targets.filter((t) => targetIds.includes(t.id));
    }

    if (targets.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        results: [],
      };
    }

    // 取得文章翻譯（如果需要同步翻譯）
    const translations = await this.getArticleTranslations(article.id);

    // 準備 payload
    const articleData = this.prepareArticleData(article, translations);
    const payload = this.createWebhookPayload(action, articleData);

    // 並行發送到所有目標
    const results: SyncResult[] = [];

    for (const target of targets) {
      const result = await this.syncToTarget(
        target,
        article.id,
        action,
        payload
      );
      results.push(result);

      // 更新外部網站的 last_synced_at
      if (result.success) {
        await supabase
          .from("website_configs")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: "success",
            last_sync_error: null,
          })
          .eq("id", target.id);
      } else {
        await supabase
          .from("website_configs")
          .update({
            last_sync_status: "failed",
            last_sync_error: result.error_message || "Unknown error",
          })
          .eq("id", target.id);
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      results,
    };
  }

  /**
   * 同步到單一目標
   */
  private async syncToTarget(
    target: SyncTarget,
    articleId: string,
    action: SyncAction,
    payload: WebhookPayload
  ): Promise<SyncResult> {
    const supabase = createAdminClient();

    // 檢查 webhook_url 是否存在
    if (!target.webhook_url) {
      console.error("[SyncService] Target has no webhook_url:", target.id);
      return {
        success: false,
        sync_target_id: target.id,
        sync_target_slug: target.external_slug || target.id,
        article_id: articleId,
        action,
        error_message: "Target has no webhook_url configured",
      };
    }

    // 創建同步日誌
    const { data: logEntry, error: logError } = await supabase
      .from("article_sync_logs")
      .insert({
        article_id: articleId,
        external_website_id: target.id,
        action,
        status: "processing",
        webhook_url: target.webhook_url,
        request_payload: this.sanitizePayloadForLog(payload),
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError || !logEntry) {
      console.error("[SyncService] Failed to create sync log:", logError);
      return {
        success: false,
        sync_target_id: target.id,
        sync_target_slug: target.external_slug || target.id,
        article_id: articleId,
        action,
        error_message: "Failed to create sync log",
      };
    }

    // 發送 webhook
    const result = await sendWebhook(
      target.webhook_url,
      payload,
      target.webhook_secret,
      { timeoutMs: this.config.timeoutMs }
    );

    // 更新同步日誌
    const updateData = {
      status: result.success ? ("success" as const) : ("failed" as const),
      response_status: result.status,
      response_body: result.body?.substring(0, 1000), // 限制長度
      error_message: result.error,
      completed_at: new Date().toISOString(),
    };

    // 如果失敗，設定重試資訊
    if (!result.success && logEntry.retry_count < this.config.maxRetries) {
      Object.assign(updateData, {
        status: "retrying" as const,
        retry_count: logEntry.retry_count + 1,
        next_retry_at: new Date(
          Date.now() + this.config.retryDelayMs * (logEntry.retry_count + 1)
        ).toISOString(),
      });
    }

    await supabase
      .from("article_sync_logs")
      .update(updateData)
      .eq("id", logEntry.id);

    return {
      success: result.success,
      sync_target_id: target.id,
      sync_target_slug: target.external_slug || target.id,
      article_id: articleId,
      action,
      response_status: result.status,
      error_message: result.error,
      duration_ms: result.durationMs,
    };
  }

  /**
   * 取得啟用的外部網站（同步目標）
   * 從 website_configs 查詢 website_type = 'external' 的資料
   */
  private async getActiveSyncTargets(action: SyncAction): Promise<SyncTarget[]> {
    const supabase = createAdminClient();

    let query = supabase
      .from("website_configs")
      .select("*")
      .eq("website_type", "external")
      .eq("is_active", true);

    // 根據 action 類型篩選
    switch (action) {
      case "create":
        query = query.eq("sync_on_publish", true);
        break;
      case "update":
        query = query.eq("sync_on_update", true);
        break;
      case "delete":
        query = query.eq("sync_on_unpublish", true);
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error("[SyncService] Failed to get sync targets:", error);
      return [];
    }

    return data || [];
  }

  /**
   * 取得文章翻譯
   */
  private async getArticleTranslations(
    articleId: string
  ): Promise<SyncedTranslationData[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("article_translations")
      .select("*")
      .eq("original_article_id", articleId)
      .eq("status", "completed");

    if (error || !data) {
      return [];
    }

    return data.map((t) => ({
      language: t.target_language,
      title: t.title,
      slug: t.slug,
      excerpt: t.excerpt,
      html_content: t.html_content,
      seo_title: t.seo_title,
      seo_description: t.seo_description,
    }));
  }

  /**
   * 準備文章資料
   */
  private prepareArticleData(
    article: GeneratedArticle,
    translations: SyncedTranslationData[]
  ): SyncedArticleData {
    return {
      source_id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      html_content: article.html_content,
      markdown_content: article.markdown_content,
      categories: article.categories || [],
      tags: article.tags || [],
      language: "zh-TW", // 原文預設為繁體中文
      translations: translations.length > 0 ? translations : undefined,
      seo_title: article.seo_title,
      seo_description: article.seo_description,
      focus_keyword: article.focus_keyword,
      keywords: article.keywords || [],
      featured_image_url: null, // TODO: 從文章中提取
      featured_image_alt: null,
      word_count: article.word_count,
      reading_time: article.reading_time,
      published_at: article.published_at,
      created_at: article.created_at,
      updated_at: article.updated_at,
    };
  }

  /**
   * 創建 Webhook Payload
   */
  private createWebhookPayload(
    action: SyncAction,
    article: SyncedArticleData
  ): WebhookPayload {
    const eventMap: Record<SyncAction, WebhookPayload["event"]> = {
      create: "article.created",
      update: "article.updated",
      delete: "article.deleted",
    };

    return {
      event: eventMap[action],
      timestamp: new Date().toISOString(),
      article,
      metadata: {
        source: "1wayseo",
        version: "1.0.0",
      },
    };
  }

  /**
   * 脫敏 payload 用於日誌記錄
   * 移除敏感或過大的內容
   */
  private sanitizePayloadForLog(payload: WebhookPayload): Record<string, unknown> {
    return {
      event: payload.event,
      timestamp: payload.timestamp,
      article: {
        source_id: payload.article.source_id,
        slug: payload.article.slug,
        title: payload.article.title,
        language: payload.article.language,
        translations_count: payload.article.translations?.length || 0,
        // 不記錄完整內容
        html_content_length: payload.article.html_content?.length || 0,
      },
      metadata: payload.metadata,
    };
  }

  /**
   * 重試失敗的同步任務（由 cron job 呼叫）
   */
  async retryFailedSyncs(): Promise<BatchSyncResult> {
    const supabase = createAdminClient();

    // 查詢需要重試的任務（使用新的 external_website_id FK）
    const { data: pendingLogs, error } = await supabase
      .from("article_sync_logs")
      .select(
        `
        *,
        website_configs!external_website_id(*),
        generated_articles!inner(*)
      `
      )
      .in("status", ["failed", "retrying"])
      .lt("retry_count", 3)
      .lte("next_retry_at", new Date().toISOString())
      .not("external_website_id", "is", null)
      .limit(this.config.batchSize);

    if (error || !pendingLogs) {
      console.error("[SyncService] Failed to get pending syncs:", error);
      return { total: 0, success: 0, failed: 0, results: [] };
    }

    const results: SyncResult[] = [];

    for (const log of pendingLogs) {
      const target = log.website_configs as unknown as SyncTarget;

      // 跳過沒有 webhook_url 的目標
      if (!target?.webhook_url) {
        console.warn("[SyncService] Skipping retry, no webhook_url:", log.id);
        continue;
      }

      // 重新準備 payload
      const translations = await this.getArticleTranslations(log.article_id);
      const articleData = this.prepareArticleData(
        log.generated_articles as unknown as GeneratedArticle,
        translations
      );
      const payload = this.createWebhookPayload(
        log.action as SyncAction,
        articleData
      );

      // 更新狀態為 processing
      await supabase
        .from("article_sync_logs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      // 發送 webhook
      const webhookResult = await sendWebhook(
        target.webhook_url,
        payload,
        target.webhook_secret,
        { timeoutMs: this.config.timeoutMs }
      );

      // 更新日誌
      const newRetryCount = log.retry_count + 1;
      const isMaxRetries = newRetryCount >= this.config.maxRetries;

      // 決定同步狀態
      let status: "success" | "failed" | "retrying";
      if (webhookResult.success) {
        status = "success";
      } else if (isMaxRetries) {
        status = "failed";
      } else {
        status = "retrying";
      }

      // 決定下次重試時間
      const shouldSetNextRetry = !webhookResult.success && !isMaxRetries;
      const nextRetryAt = shouldSetNextRetry
        ? new Date(Date.now() + this.config.retryDelayMs * (newRetryCount + 1)).toISOString()
        : null;

      await supabase
        .from("article_sync_logs")
        .update({
          status,
          response_status: webhookResult.status,
          response_body: webhookResult.body?.substring(0, 1000),
          error_message: webhookResult.error,
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt,
          completed_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      results.push({
        success: webhookResult.success,
        sync_target_id: target.id,
        sync_target_slug: target.external_slug || target.id,
        article_id: log.article_id,
        action: log.action as SyncAction,
        response_status: webhookResult.status,
        error_message: webhookResult.error,
        duration_ms: webhookResult.durationMs,
      });
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      results,
    };
  }
}

// 單例實例
let syncServiceInstance: ArticleSyncService | null = null;

/**
 * 取得同步服務實例
 */
export function getSyncService(config?: SyncServiceConfig): ArticleSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ArticleSyncService(config);
  }
  return syncServiceInstance;
}

/**
 * 便捷函數：同步文章
 * @param article 要同步的文章
 * @param action 同步操作類型
 * @param targetIds 可選：指定同步目標 ID 列表。若不傳則同步到所有啟用目標；若傳空陣列則不執行同步
 */
export async function syncArticle(
  article: GeneratedArticle,
  action: SyncAction,
  targetIds?: string[]
): Promise<BatchSyncResult> {
  const service = getSyncService();
  return service.syncArticle(article, action, targetIds);
}
