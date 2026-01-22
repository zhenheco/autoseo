/**
 * @1wayseo/article-sync-sdk
 * 核心類型定義
 */
/**
 * 同步的文章資料
 */
interface SyncedArticle {
    id: string;
    source_id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    html_content: string;
    markdown_content?: string | null;
    categories: string[];
    tags: string[];
    language: string;
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    featured_image_url: string | null;
    featured_image_alt: string | null;
    word_count: number | null;
    reading_time: number | null;
    published_at: string | null;
    synced_at: string;
    sync_status: "active" | "deleted";
    created_at: string;
    updated_at: string;
}
/**
 * 文章列表項目（精簡版）
 */
interface SyncedArticleListItem {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    featured_image_url: string | null;
    categories: string[];
    tags: string[];
    language: string;
    reading_time: number | null;
    published_at: string | null;
}
/**
 * 翻譯資料
 */
interface SyncedTranslation {
    language: string;
    title: string;
    slug: string;
    excerpt: string | null;
    html_content: string;
    seo_title: string | null;
    seo_description: string | null;
}
/**
 * Webhook 事件類型
 */
type WebhookEvent = "article.created" | "article.updated" | "article.deleted";
/**
 * Webhook Payload
 */
interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    article: WebhookArticleData;
    metadata?: {
        source: string;
        version: string;
    };
}
/**
 * Webhook 文章資料
 */
interface WebhookArticleData {
    source_id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    html_content: string;
    markdown_content?: string;
    categories: string[];
    tags: string[];
    language: string;
    translations?: SyncedTranslation[];
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    featured_image_url: string | null;
    featured_image_alt: string | null;
    word_count: number | null;
    reading_time: number | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}
/**
 * Webhook 處理結果
 */
interface WebhookHandlerResult {
    success: boolean;
    message?: string;
    article_id?: string;
    error?: string;
}
/**
 * SyncClient 配置
 */
interface SyncClientConfig {
    supabaseUrl: string;
    supabaseKey: string;
    tableName?: string;
}
/**
 * 文章查詢選項
 */
interface GetArticlesOptions {
    limit?: number;
    offset?: number;
    language?: string;
    category?: string;
    tag?: string;
    sortBy?: "published_at" | "synced_at" | "title";
    sortOrder?: "asc" | "desc";
}
/**
 * 文章列表回應
 */
interface GetArticlesResponse {
    articles: SyncedArticleListItem[];
    total: number;
    hasMore: boolean;
}
/**
 * 單篇文章回應
 */
interface GetArticleResponse {
    article: SyncedArticle | null;
}
/**
 * Webhook Handler 配置
 */
interface WebhookHandlerConfig {
    supabaseUrl: string;
    supabaseKey: string;
    webhookSecret: string;
    tableName?: string;
    onArticleCreated?: (article: SyncedArticle) => Promise<void> | void;
    onArticleUpdated?: (article: SyncedArticle) => Promise<void> | void;
    onArticleDeleted?: (sourceId: string) => Promise<void> | void;
}
/**
 * Webhook 驗證結果
 */
interface SignatureVerificationResult {
    valid: boolean;
    error?: string;
}
/**
 * useArticles Hook 選項
 */
interface UseArticlesOptions extends GetArticlesOptions {
    enabled?: boolean;
}
/**
 * useArticles Hook 回傳值
 */
interface UseArticlesResult {
    articles: SyncedArticleListItem[];
    total: number;
    isLoading: boolean;
    error: Error | null;
    hasMore: boolean;
    refetch: () => Promise<void>;
}
/**
 * useArticle Hook 選項
 */
interface UseArticleOptions {
    enabled?: boolean;
}
/**
 * useArticle Hook 回傳值
 */
interface UseArticleResult {
    article: SyncedArticle | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}
/**
 * synced_articles 表結構
 */
interface SyncedArticlesTable {
    id: string;
    source_id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    html_content: string | null;
    markdown_content: string | null;
    categories: string[];
    tags: string[];
    language: string;
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    featured_image_url: string | null;
    featured_image_alt: string | null;
    word_count: number | null;
    reading_time: number | null;
    published_at: string | null;
    synced_at: string;
    sync_status: string;
    created_at: string;
    updated_at: string;
}

export type { GetArticlesOptions as G, SyncClientConfig as S, UseArticlesOptions as U, WebhookHandlerConfig as W, GetArticlesResponse as a, GetArticleResponse as b, SyncedArticleListItem as c, WebhookHandlerResult as d, SignatureVerificationResult as e, SyncedArticle as f, SyncedTranslation as g, WebhookEvent as h, WebhookPayload as i, WebhookArticleData as j, UseArticlesResult as k, UseArticleOptions as l, UseArticleResult as m, SyncedArticlesTable as n };
