/**
 * @1wayseo/blog-sdk
 *
 * SDK for integrating 1waySEO blog content into your website
 *
 * @example
 * ```ts
 * import { createBlogClient } from '@1wayseo/blog-sdk'
 *
 * const blog = createBlogClient({ apiKey: process.env.SITE_API_KEY })
 *
 * // 取得文章列表
 * const articles = await blog.getArticles({ lang: 'zh-TW', page: 1 })
 *
 * // 取得單篇文章
 * const article = await blog.getArticle('my-slug', { lang: 'en-US' })
 * ```
 */
/**
 * SDK 設定選項
 */
interface BlogClientOptions {
    /** API Key（sk_site_xxx 格式） */
    apiKey: string;
    /** API 基礎 URL（預設：https://1wayseo.com） */
    baseUrl?: string;
    /** 請求超時時間（毫秒，預設：30000） */
    timeout?: number;
}
/**
 * 文章列表項目
 */
interface Article {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    featuredImageUrl: string | null;
    categories: string[];
    tags: string[];
    readingTime: number | null;
    publishedAt: string | null;
    language: string;
}
/**
 * 文章詳情
 */
interface ArticleDetail extends Article {
    htmlContent: string | null;
    markdownContent: string | null;
    featuredImageAlt: string | null;
    wordCount: number | null;
    metaTitle: string | null;
    metaDescription: string | null;
}
/**
 * 翻譯版本摘要
 */
interface TranslationSummary {
    language: string;
    title: string;
    slug: string;
    excerpt: string | null;
}
/**
 * 分頁資訊
 */
interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}
/**
 * 文章列表回應
 */
interface ArticlesResponse {
    articles: Article[];
    pagination: Pagination;
    availableLanguages: string[];
}
/**
 * 單篇文章回應
 */
interface ArticleResponse {
    article: ArticleDetail;
    translations: Record<string, TranslationSummary>;
}
/**
 * 分類項目
 */
interface CategoryItem {
    name: string;
    count: number;
}
/**
 * 分類列表回應
 */
interface CategoriesResponse {
    categories: CategoryItem[];
    total: number;
}
/**
 * 標籤項目
 */
interface TagItem {
    name: string;
    count: number;
}
/**
 * 標籤列表回應
 */
interface TagsResponse {
    tags: TagItem[];
    total: number;
}
/**
 * 語系項目
 */
interface LanguageItem {
    code: string;
    name: string;
    articleCount: number;
    isDefault: boolean;
}
/**
 * 語系列表回應
 */
interface LanguagesResponse {
    languages: LanguageItem[];
    defaultLanguage: string;
}
/**
 * 文章列表查詢選項
 */
interface GetArticlesOptions {
    /** 頁碼（預設 1） */
    page?: number;
    /** 每頁數量（預設 10，最大 100） */
    limit?: number;
    /** 語系篩選 */
    lang?: string;
    /** 分類篩選 */
    category?: string;
    /** 標籤篩選 */
    tag?: string;
}
/**
 * 單篇文章查詢選項
 */
interface GetArticleOptions {
    /** 語系（預設返回原文） */
    lang?: string;
}
/**
 * API 錯誤
 */
declare class BlogApiError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(message: string, status: number, code?: string | undefined);
}
/**
 * Rate Limit 資訊
 */
interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetAt: number;
    used: number;
}
/**
 * Blog API Client
 */
declare class BlogClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private lastRateLimit;
    constructor(options: BlogClientOptions);
    /**
     * 取得最後一次請求的 Rate Limit 資訊
     */
    getRateLimitInfo(): RateLimitInfo | null;
    /**
     * 發送 API 請求
     */
    private request;
    /**
     * 取得文章列表
     *
     * @example
     * ```ts
     * const { articles, pagination } = await blog.getArticles({
     *   page: 1,
     *   limit: 10,
     *   lang: 'zh-TW',
     *   category: 'SEO'
     * })
     * ```
     */
    getArticles(options?: GetArticlesOptions): Promise<ArticlesResponse>;
    /**
     * 取得單篇文章
     *
     * @example
     * ```ts
     * const { article, translations } = await blog.getArticle('my-article-slug', {
     *   lang: 'en-US'
     * })
     * ```
     */
    getArticle(slug: string, options?: GetArticleOptions): Promise<ArticleResponse>;
    /**
     * 取得分類列表
     *
     * @example
     * ```ts
     * const { categories } = await blog.getCategories()
     * ```
     */
    getCategories(): Promise<CategoriesResponse>;
    /**
     * 取得標籤列表
     *
     * @example
     * ```ts
     * const { tags } = await blog.getTags()
     * ```
     */
    getTags(): Promise<TagsResponse>;
    /**
     * 取得語系列表
     *
     * @example
     * ```ts
     * const { languages, defaultLanguage } = await blog.getLanguages()
     * ```
     */
    getLanguages(): Promise<LanguagesResponse>;
}
/**
 * 建立 Blog API Client
 *
 * @example
 * ```ts
 * import { createBlogClient } from '@1wayseo/blog-sdk'
 *
 * const blog = createBlogClient({
 *   apiKey: process.env.SITE_API_KEY!,
 * })
 *
 * const articles = await blog.getArticles({ page: 1 })
 * ```
 */
declare function createBlogClient(options: BlogClientOptions): BlogClient;

export { type Article, type ArticleDetail, type ArticleResponse, type ArticlesResponse, BlogApiError, BlogClient, type BlogClientOptions, type CategoriesResponse, type CategoryItem, type GetArticleOptions, type GetArticlesOptions, type LanguageItem, type LanguagesResponse, type Pagination, type RateLimitInfo, type TagItem, type TagsResponse, type TranslationSummary, createBlogClient, createBlogClient as default };
