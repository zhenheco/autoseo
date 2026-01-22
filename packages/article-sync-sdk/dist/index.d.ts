import { S as SyncClientConfig, G as GetArticlesOptions, a as GetArticlesResponse, b as GetArticleResponse, c as SyncedArticleListItem, W as WebhookHandlerConfig, d as WebhookHandlerResult, e as SignatureVerificationResult } from './types-BUKyMdyc.js';
export { f as SyncedArticle, n as SyncedArticlesTable, g as SyncedTranslation, l as UseArticleOptions, m as UseArticleResult, U as UseArticlesOptions, k as UseArticlesResult, j as WebhookArticleData, h as WebhookEvent, i as WebhookPayload } from './types-BUKyMdyc.js';

/**
 * SyncClient
 * 用於查詢同步到本地的文章
 */

/**
 * SyncClient 類別
 * 提供文章查詢功能
 */
declare class SyncClient {
    private supabase;
    private tableName;
    constructor(config: SyncClientConfig);
    /**
     * 取得文章列表
     */
    getArticles(options?: GetArticlesOptions): Promise<GetArticlesResponse>;
    /**
     * 根據 slug 取得單篇文章
     */
    getArticleBySlug(slug: string): Promise<GetArticleResponse>;
    /**
     * 根據 source_id 取得單篇文章
     */
    getArticleBySourceId(sourceId: string): Promise<GetArticleResponse>;
    /**
     * 取得所有分類
     */
    getCategories(): Promise<string[]>;
    /**
     * 取得所有標籤
     */
    getTags(): Promise<string[]>;
    /**
     * 取得相關文章
     */
    getRelatedArticles(articleId: string, limit?: number): Promise<SyncedArticleListItem[]>;
    /**
     * 搜尋文章
     */
    searchArticles(query: string, options?: GetArticlesOptions): Promise<GetArticlesResponse>;
    /**
     * 取得文章數量
     */
    getArticleCount(language?: string): Promise<number>;
}
/**
 * 建立 SyncClient 實例
 */
declare function createSyncClient(config: SyncClientConfig): SyncClient;

/**
 * Webhook Handler
 * 接收和處理來自 1waySEO 的文章同步 webhook
 */

/**
 * 驗證 HMAC-SHA256 簽章
 */
declare function verifyWebhookSignature(payload: string, secret: string, signature: string, timestamp: number, maxAgeMs?: number): SignatureVerificationResult;
/**
 * Webhook Handler 類別
 */
declare class WebhookHandler {
    private supabase;
    private webhookSecret;
    private tableName;
    private onArticleCreated?;
    private onArticleUpdated?;
    private onArticleDeleted?;
    constructor(config: WebhookHandlerConfig);
    /**
     * 處理 Webhook 請求
     */
    handleWebhook(body: string, signature: string | null, timestamp: string | null): Promise<WebhookHandlerResult>;
    /**
     * 處理文章建立事件
     */
    private handleArticleCreated;
    /**
     * 處理文章更新事件
     */
    private handleArticleUpdated;
    /**
     * 處理文章刪除事件
     */
    private handleArticleDeleted;
    /**
     * 將 Webhook Payload 映射到文章資料
     */
    private mapPayloadToArticle;
    /**
     * 取得簽章和時間戳 header 名稱
     */
    static get SIGNATURE_HEADER(): string;
    static get TIMESTAMP_HEADER(): string;
}
/**
 * 建立 Webhook Handler 實例
 */
declare function createWebhookHandler(config: WebhookHandlerConfig): WebhookHandler;

export { GetArticleResponse, GetArticlesOptions, GetArticlesResponse, SignatureVerificationResult, SyncClient, SyncClientConfig, SyncedArticleListItem, WebhookHandler, WebhookHandlerConfig, WebhookHandlerResult, createSyncClient, createWebhookHandler, verifyWebhookSignature };
