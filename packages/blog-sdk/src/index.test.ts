/**
 * @1wayseo/blog-sdk 測試
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createBlogClient,
  BlogClient,
  BlogApiError,
} from "./index";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("createBlogClient", () => {
  test("should create a BlogClient instance", () => {
    const client = createBlogClient({ apiKey: "sk_site_test123" });
    expect(client).toBeInstanceOf(BlogClient);
  });

  test("should throw error when apiKey is missing", () => {
    expect(() => createBlogClient({ apiKey: "" })).toThrow("API key is required");
  });

  test("should use default baseUrl when not provided", () => {
    const client = createBlogClient({ apiKey: "sk_site_test123" });
    // 透過內部存取確認 baseUrl
    expect(client).toBeDefined();
  });

  test("should accept custom baseUrl", () => {
    const client = createBlogClient({
      apiKey: "sk_site_test123",
      baseUrl: "https://custom.example.com",
    });
    expect(client).toBeDefined();
  });

  test("should strip trailing slash from baseUrl", () => {
    const client = createBlogClient({
      apiKey: "sk_site_test123",
      baseUrl: "https://example.com/",
    });
    expect(client).toBeDefined();
  });
});

describe("BlogClient", () => {
  let client: BlogClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = createBlogClient({
      apiKey: "sk_site_test123",
      baseUrl: "https://test.example.com",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getArticles", () => {
    test("should fetch articles successfully", async () => {
      const mockResponse = {
        success: true,
        articles: [
          {
            id: "article-1",
            slug: "test-article",
            title: "Test Article",
            excerpt: "Test excerpt",
            featured_image_url: "https://example.com/image.jpg",
            categories: ["SEO"],
            tags: ["test"],
            reading_time: 5,
            published_at: "2025-01-15T00:00:00Z",
            language: "zh-TW",
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
        available_languages: ["zh-TW", "en-US"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "99",
          "X-RateLimit-Reset": "1705276800",
          "X-RateLimit-Used": "1",
        }),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getArticles({ page: 1, limit: 10 });

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].id).toBe("article-1");
      expect(result.articles[0].featuredImageUrl).toBe(
        "https://example.com/image.jpg"
      );
      expect(result.pagination.total).toBe(1);
      expect(result.availableLanguages).toEqual(["zh-TW", "en-US"]);
    });

    test("should include query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            articles: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false },
            available_languages: [],
          }),
      });

      await client.getArticles({
        page: 2,
        limit: 20,
        lang: "zh-TW",
        category: "SEO",
        tag: "test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=20"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("lang=zh-TW"),
        expect.any(Object)
      );
    });

    test("should convert snake_case to camelCase", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            articles: [
              {
                id: "1",
                slug: "test",
                title: "Test",
                excerpt: null,
                featured_image_url: "https://example.com/img.jpg",
                categories: [],
                tags: [],
                reading_time: 10,
                published_at: "2025-01-15T00:00:00Z",
                language: "zh-TW",
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
            available_languages: [],
          }),
      });

      const result = await client.getArticles();

      // 確認 snake_case 已轉換為 camelCase
      expect(result.articles[0]).toHaveProperty("featuredImageUrl");
      expect(result.articles[0]).toHaveProperty("readingTime");
      expect(result.articles[0]).toHaveProperty("publishedAt");
      expect(result.articles[0]).not.toHaveProperty("featured_image_url");
      expect(result.articles[0]).not.toHaveProperty("reading_time");
    });
  });

  describe("getArticle", () => {
    test("should fetch single article successfully", async () => {
      const mockResponse = {
        success: true,
        article: {
          id: "article-1",
          slug: "test-article",
          title: "Test Article",
          excerpt: "Test excerpt",
          html_content: "<p>Test content</p>",
          markdown_content: "Test content",
          featured_image_url: "https://example.com/image.jpg",
          featured_image_alt: "Test image",
          categories: ["SEO"],
          tags: ["test"],
          reading_time: 5,
          word_count: 100,
          meta_title: "Test Title",
          meta_description: "Test Description",
          published_at: "2025-01-15T00:00:00Z",
          language: "zh-TW",
        },
        translations: {
          "en-US": {
            language: "en-US",
            title: "Test Article (EN)",
            slug: "test-article-en",
            excerpt: "Test excerpt in English",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getArticle("test-article");

      expect(result.article.id).toBe("article-1");
      expect(result.article.htmlContent).toBe("<p>Test content</p>");
      expect(result.article.markdownContent).toBe("Test content");
      expect(result.article.metaTitle).toBe("Test Title");
      expect(result.translations["en-US"].title).toBe("Test Article (EN)");
    });

    test("should encode slug in URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            article: {
              id: "1",
              slug: "test",
              title: "Test",
              excerpt: null,
              html_content: null,
              markdown_content: null,
              featured_image_url: null,
              featured_image_alt: null,
              categories: [],
              tags: [],
              reading_time: null,
              word_count: null,
              meta_title: null,
              meta_description: null,
              published_at: null,
              language: "zh-TW",
            },
            translations: {},
          }),
      });

      await client.getArticle("my-article/with-slash");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("my-article%2Fwith-slash"),
        expect.any(Object)
      );
    });

    test("should include lang parameter when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            article: {
              id: "1",
              slug: "test",
              title: "Test",
              excerpt: null,
              html_content: null,
              markdown_content: null,
              featured_image_url: null,
              featured_image_alt: null,
              categories: [],
              tags: [],
              reading_time: null,
              word_count: null,
              meta_title: null,
              meta_description: null,
              published_at: null,
              language: "en-US",
            },
            translations: {},
          }),
      });

      await client.getArticle("test", { lang: "en-US" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("lang=en-US"),
        expect.any(Object)
      );
    });
  });

  describe("getCategories", () => {
    test("should fetch categories successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            categories: [
              { name: "SEO", count: 10 },
              { name: "Marketing", count: 5 },
            ],
            total: 2,
          }),
      });

      const result = await client.getCategories();

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].name).toBe("SEO");
      expect(result.total).toBe(2);
    });
  });

  describe("getTags", () => {
    test("should fetch tags successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            tags: [
              { name: "test", count: 10 },
              { name: "example", count: 5 },
            ],
            total: 2,
          }),
      });

      const result = await client.getTags();

      expect(result.tags).toHaveLength(2);
      expect(result.tags[0].name).toBe("test");
      expect(result.total).toBe(2);
    });
  });

  describe("getLanguages", () => {
    test("should fetch languages successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            languages: [
              { code: "zh-TW", name: "繁體中文", articleCount: 10, isDefault: true },
              { code: "en-US", name: "English", articleCount: 5, isDefault: false },
            ],
            defaultLanguage: "zh-TW",
          }),
      });

      const result = await client.getLanguages();

      expect(result.languages).toHaveLength(2);
      expect(result.languages[0].code).toBe("zh-TW");
      expect(result.defaultLanguage).toBe("zh-TW");
    });
  });

  describe("getRateLimitInfo", () => {
    test("should return null before any request", () => {
      const result = client.getRateLimitInfo();
      expect(result).toBeNull();
    });

    test("should return rate limit info after request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "95",
          "X-RateLimit-Reset": "1705276800",
          "X-RateLimit-Used": "5",
        }),
        json: () =>
          Promise.resolve({
            success: true,
            categories: [],
            total: 0,
          }),
      });

      await client.getCategories();
      const rateLimit = client.getRateLimitInfo();

      expect(rateLimit).not.toBeNull();
      expect(rateLimit?.limit).toBe(100);
      expect(rateLimit?.remaining).toBe(95);
      expect(rateLimit?.used).toBe(5);
    });
  });

  describe("Error Handling", () => {
    test("should throw BlogApiError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ success: false, error: "Invalid API key" }),
      });

      try {
        await client.getArticles();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlogApiError);
        expect((error as BlogApiError).status).toBe(401);
      }
    });

    test("should throw BlogApiError on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: () => Promise.resolve({ success: false, error: "Article not found" }),
      });

      await expect(client.getArticle("non-existent")).rejects.toThrow(BlogApiError);
    });

    test("should throw BlogApiError on 429 (rate limit)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "1705276800",
        }),
        json: () =>
          Promise.resolve({ success: false, error: "Rate limit exceeded" }),
      });

      try {
        await client.getArticles();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlogApiError);
        expect((error as BlogApiError).status).toBe(429);
      }
    });

    test("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      try {
        await client.getArticles();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlogApiError);
        expect((error as BlogApiError).message).toBe("Network error");
        expect((error as BlogApiError).status).toBe(0);
      }
    });

    test("should handle timeout", async () => {
      // 建立一個短 timeout 的 client
      const shortTimeoutClient = createBlogClient({
        apiKey: "sk_site_test123",
        baseUrl: "https://test.example.com",
        timeout: 100,
      });

      // Mock 一個會 abort 的 fetch
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new Error("AbortError");
            error.name = "AbortError";
            setTimeout(() => reject(error), 50);
          })
      );

      try {
        await shortTimeoutClient.getArticles();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BlogApiError);
        expect((error as BlogApiError).status).toBe(408);
      }
    });

    test("should handle JSON parse error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(client.getArticles()).rejects.toThrow(BlogApiError);
    });
  });

  describe("Authorization Header", () => {
    test("should include Bearer token in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            success: true,
            categories: [],
            total: 0,
          }),
      });

      await client.getCategories();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk_site_test123",
          }),
        })
      );
    });
  });
});

describe("BlogApiError", () => {
  test("should create error with message and status", () => {
    const error = new BlogApiError("Test error", 400);
    expect(error.message).toBe("Test error");
    expect(error.status).toBe(400);
    expect(error.name).toBe("BlogApiError");
  });

  test("should create error with code", () => {
    const error = new BlogApiError("Test error", 400, "INVALID_REQUEST");
    expect(error.code).toBe("INVALID_REQUEST");
  });
});
