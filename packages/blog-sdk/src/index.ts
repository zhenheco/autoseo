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

// ============================================================================
// Types
// ============================================================================

/**
 * SDK 設定選項
 */
export interface BlogClientOptions {
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
export interface Article {
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
export interface ArticleDetail extends Article {
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
export interface TranslationSummary {
  language: string;
  title: string;
  slug: string;
  excerpt: string | null;
}

/**
 * 分頁資訊
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * 文章列表回應
 */
export interface ArticlesResponse {
  articles: Article[];
  pagination: Pagination;
  availableLanguages: string[];
}

/**
 * 單篇文章回應
 */
export interface ArticleResponse {
  article: ArticleDetail;
  translations: Record<string, TranslationSummary>;
}

/**
 * 分類項目
 */
export interface CategoryItem {
  name: string;
  count: number;
}

/**
 * 分類列表回應
 */
export interface CategoriesResponse {
  categories: CategoryItem[];
  total: number;
}

/**
 * 標籤項目
 */
export interface TagItem {
  name: string;
  count: number;
}

/**
 * 標籤列表回應
 */
export interface TagsResponse {
  tags: TagItem[];
  total: number;
}

/**
 * 語系項目
 */
export interface LanguageItem {
  code: string;
  name: string;
  articleCount: number;
  isDefault: boolean;
}

/**
 * 語系列表回應
 */
export interface LanguagesResponse {
  languages: LanguageItem[];
  defaultLanguage: string;
}

/**
 * 文章列表查詢選項
 */
export interface GetArticlesOptions {
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
export interface GetArticleOptions {
  /** 語系（預設返回原文） */
  lang?: string;
}

/**
 * API 錯誤
 */
export class BlogApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BlogApiError";
  }
}

/**
 * Rate Limit 資訊
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  used: number;
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Blog API Client
 */
export class BlogClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private lastRateLimit: RateLimitInfo | null = null;

  constructor(options: BlogClientOptions) {
    if (!options.apiKey) {
      throw new Error("API key is required");
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://1wayseo.com").replace(
      /\/$/,
      "",
    );
    this.timeout = options.timeout || 30000;
  }

  /**
   * 取得最後一次請求的 Rate Limit 資訊
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.lastRateLimit;
  }

  /**
   * 發送 API 請求
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1/sites${endpoint}`);

    // 加入查詢參數
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      // 解析 Rate Limit headers
      this.lastRateLimit = {
        limit: parseInt(response.headers.get("X-RateLimit-Limit") || "100", 10),
        remaining: parseInt(
          response.headers.get("X-RateLimit-Remaining") || "100",
          10,
        ),
        resetAt: parseInt(response.headers.get("X-RateLimit-Reset") || "0", 10),
        used: parseInt(response.headers.get("X-RateLimit-Used") || "0", 10),
      };

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string | { code?: string; message?: string };
        };
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?.message || `HTTP ${response.status}`;
        const errorCode =
          typeof errorData.error === "object"
            ? errorData.error?.code
            : undefined;
        throw new BlogApiError(errorMessage, response.status, errorCode);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof BlogApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new BlogApiError("Request timeout", 408);
        }
        throw new BlogApiError(error.message, 0);
      }

      throw new BlogApiError("Unknown error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

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
  async getArticles(
    options: GetArticlesOptions = {},
  ): Promise<ArticlesResponse> {
    const response = await this.request<{
      success: boolean;
      articles: Array<{
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        featured_image_url: string | null;
        categories: string[];
        tags: string[];
        reading_time: number | null;
        published_at: string | null;
        language: string;
      }>;
      pagination: Pagination;
      available_languages: string[];
    }>("/articles", {
      page: options.page,
      limit: options.limit,
      lang: options.lang,
      category: options.category,
      tag: options.tag,
    });

    return {
      articles: response.articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        featuredImageUrl: a.featured_image_url,
        categories: a.categories,
        tags: a.tags,
        readingTime: a.reading_time,
        publishedAt: a.published_at,
        language: a.language,
      })),
      pagination: response.pagination,
      availableLanguages: response.available_languages,
    };
  }

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
  async getArticle(
    slug: string,
    options: GetArticleOptions = {},
  ): Promise<ArticleResponse> {
    const response = await this.request<{
      success: boolean;
      article: {
        id: string;
        slug: string;
        title: string;
        excerpt: string | null;
        html_content: string | null;
        markdown_content: string | null;
        featured_image_url: string | null;
        featured_image_alt: string | null;
        categories: string[];
        tags: string[];
        reading_time: number | null;
        word_count: number | null;
        meta_title: string | null;
        meta_description: string | null;
        published_at: string | null;
        language: string;
      };
      translations: Record<
        string,
        {
          language: string;
          title: string;
          slug: string;
          excerpt: string | null;
        }
      >;
    }>(`/articles/${encodeURIComponent(slug)}`, {
      lang: options.lang,
    });

    const a = response.article;
    return {
      article: {
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        htmlContent: a.html_content,
        markdownContent: a.markdown_content,
        featuredImageUrl: a.featured_image_url,
        featuredImageAlt: a.featured_image_alt,
        categories: a.categories,
        tags: a.tags,
        readingTime: a.reading_time,
        wordCount: a.word_count,
        metaTitle: a.meta_title,
        metaDescription: a.meta_description,
        publishedAt: a.published_at,
        language: a.language,
      },
      translations: response.translations,
    };
  }

  /**
   * 取得分類列表
   *
   * @example
   * ```ts
   * const { categories } = await blog.getCategories()
   * ```
   */
  async getCategories(): Promise<CategoriesResponse> {
    const response = await this.request<{
      success: boolean;
      categories: CategoryItem[];
      total: number;
    }>("/categories");

    return {
      categories: response.categories,
      total: response.total,
    };
  }

  /**
   * 取得標籤列表
   *
   * @example
   * ```ts
   * const { tags } = await blog.getTags()
   * ```
   */
  async getTags(): Promise<TagsResponse> {
    const response = await this.request<{
      success: boolean;
      tags: TagItem[];
      total: number;
    }>("/tags");

    return {
      tags: response.tags,
      total: response.total,
    };
  }

  /**
   * 取得語系列表
   *
   * @example
   * ```ts
   * const { languages, defaultLanguage } = await blog.getLanguages()
   * ```
   */
  async getLanguages(): Promise<LanguagesResponse> {
    const response = await this.request<{
      success: boolean;
      languages: LanguageItem[];
      defaultLanguage: string;
    }>("/languages");

    return {
      languages: response.languages,
      defaultLanguage: response.defaultLanguage,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

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
export function createBlogClient(options: BlogClientOptions): BlogClient {
  return new BlogClient(options);
}

// Default export
export default createBlogClient;
