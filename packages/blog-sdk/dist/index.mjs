// src/index.ts
var BlogApiError = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "BlogApiError";
  }
};
var BlogClient = class {
  constructor(options) {
    this.lastRateLimit = null;
    if (!options.apiKey) {
      throw new Error("API key is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://1wayseo.com").replace(
      /\/$/,
      ""
    );
    this.timeout = options.timeout || 3e4;
  }
  /**
   * 取得最後一次請求的 Rate Limit 資訊
   */
  getRateLimitInfo() {
    return this.lastRateLimit;
  }
  /**
   * 發送 API 請求
   */
  async request(endpoint, params) {
    const url = new URL(`${this.baseUrl}/api/v1/sites${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== void 0) {
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
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });
      this.lastRateLimit = {
        limit: parseInt(response.headers.get("X-RateLimit-Limit") || "100", 10),
        remaining: parseInt(
          response.headers.get("X-RateLimit-Remaining") || "100",
          10
        ),
        resetAt: parseInt(response.headers.get("X-RateLimit-Reset") || "0", 10),
        used: parseInt(response.headers.get("X-RateLimit-Used") || "0", 10)
      };
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = typeof errorData.error === "string" ? errorData.error : errorData.error?.message || `HTTP ${response.status}`;
        const errorCode = typeof errorData.error === "object" ? errorData.error?.code : void 0;
        throw new BlogApiError(errorMessage, response.status, errorCode);
      }
      const data = await response.json();
      return data;
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
  async getArticles(options = {}) {
    const response = await this.request("/articles", {
      page: options.page,
      limit: options.limit,
      lang: options.lang,
      category: options.category,
      tag: options.tag
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
        language: a.language
      })),
      pagination: response.pagination,
      availableLanguages: response.available_languages
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
  async getArticle(slug, options = {}) {
    const response = await this.request(`/articles/${encodeURIComponent(slug)}`, {
      lang: options.lang
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
        language: a.language
      },
      translations: response.translations
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
  async getCategories() {
    const response = await this.request("/categories");
    return {
      categories: response.categories,
      total: response.total
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
  async getTags() {
    const response = await this.request("/tags");
    return {
      tags: response.tags,
      total: response.total
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
  async getLanguages() {
    const response = await this.request("/languages");
    return {
      languages: response.languages,
      defaultLanguage: response.defaultLanguage
    };
  }
};
function createBlogClient(options) {
  return new BlogClient(options);
}
var index_default = createBlogClient;
export {
  BlogApiError,
  BlogClient,
  createBlogClient,
  index_default as default
};
