import { describe, expect, it, vi } from "vitest";
import { publishNewWordPressArticle } from "./wordpress-new-target";

interface FakeResponse {
  error?: { message?: string } | null;
}

function createFakeSupabase(responses: FakeResponse[] = []) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];
  let responseIndex = 0;

  return {
    calls,
    from(table: string) {
      const builder = {
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        then<TResult1 = FakeResponse, TResult2 = never>(
          onfulfilled?: ((value: FakeResponse) => TResult1) | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          const response = responses[responseIndex++] ?? { error: null };
          return Promise.resolve(response).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("publishNewWordPressArticle", () => {
  it("publishes a new WordPress article and marks local records published", async () => {
    const supabase = createFakeSupabase();
    const publishArticle = vi.fn().mockResolvedValue({
      post: {
        id: 456,
        link: "https://wp.example.com/post",
        status: "publish",
      },
    });
    const createWordPressClient = vi.fn(() => ({ publishArticle }));
    const resolvePassword = vi.fn(() => "resolved-password");
    const publishedAt = "2026-05-19T12:00:00.000Z";

    await expect(
      publishNewWordPressArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: {
          id: "article-1",
          title: "Raw Title",
          html_content: "<p>Body</p>",
          seo_title: "SEO Title",
          seo_description: "SEO Description",
          slug: "seo-title",
          og_image: "https://cdn.example.com/og.jpg",
          categories: ["News"],
          tags: ["SEO"],
          focus_keyword: "keyword",
        },
        website: {
          id: "website-1",
          wordpress_url: "https://wp.example.com",
          wp_username: "editor",
          wp_app_password: "stored-password",
          wordpress_access_token: "access-token",
          wordpress_refresh_token: "refresh-token",
        },
        dependencies: {
          createWordPressClient,
          resolvePassword,
          now: () => publishedAt,
        },
      }),
    ).resolves.toEqual({ publishedAt, wordpressPostId: 456 });

    expect(resolvePassword).toHaveBeenCalledWith("stored-password");
    expect(createWordPressClient).toHaveBeenCalledWith({
      url: "https://wp.example.com",
      username: "editor",
      applicationPassword: "resolved-password",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(publishArticle).toHaveBeenCalledWith(
      {
        title: "SEO Title",
        content: "<p>Body</p>",
        excerpt: "SEO Description",
        slug: "seo-title",
        featuredImageUrl: "https://cdn.example.com/og.jpg",
        categories: ["News"],
        tags: ["SEO"],
        seoTitle: "SEO Title",
        seoDescription: "SEO Description",
        focusKeyword: "keyword",
      },
      "publish",
    );
    expect(supabase.calls).toEqual([
      {
        table: "article_jobs",
        method: "update",
        args: [
          {
            status: "published",
            published_at: publishedAt,
            wordpress_post_id: "456",
            publish_retry_count: 0,
            last_publish_error: null,
          },
        ],
      },
      {
        table: "article_jobs",
        method: "eq",
        args: ["id", "job-1"],
      },
      {
        table: "generated_articles",
        method: "update",
        args: [
          {
            wordpress_post_id: 456,
            wordpress_post_url: "https://wp.example.com/post",
            wordpress_status: "publish",
            published_at: publishedAt,
            status: "published",
            published_to_website_id: "website-1",
            published_to_website_at: publishedAt,
          },
        ],
      },
      {
        table: "generated_articles",
        method: "eq",
        args: ["id", "article-1"],
      },
    ]);
  });

  it("falls back to raw article fields when SEO fields are missing", async () => {
    const supabase = createFakeSupabase();
    const publishArticle = vi.fn().mockResolvedValue({
      post: {
        id: 456,
        link: "https://wp.example.com/post",
        status: "publish",
      },
    });

    await publishNewWordPressArticle({
      supabase: supabase as never,
      article: { id: "job-1" },
      generatedArticle: {
        id: "article-1",
        title: "Raw Title",
      },
      website: {
        id: "website-1",
        wordpress_url: "https://wp.example.com",
        wp_username: "editor",
        wp_app_password: "stored-password",
      },
      dependencies: {
        createWordPressClient: () => ({ publishArticle }),
        resolvePassword: () => "resolved-password",
      },
    });

    expect(publishArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Raw Title",
        content: "",
        excerpt: "",
        slug: "",
        featuredImageUrl: undefined,
        categories: [],
        tags: [],
        seoTitle: "Raw Title",
        seoDescription: "",
        focusKeyword: "",
      }),
      "publish",
    );
  });

  it("does not update local records when WordPress publish fails", async () => {
    const supabase = createFakeSupabase();
    const publishArticle = vi.fn().mockRejectedValue(new Error("wp failed"));

    await expect(
      publishNewWordPressArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: {
          id: "article-1",
          title: "Raw Title",
        },
        website: {
          id: "website-1",
          wordpress_url: "https://wp.example.com",
          wp_username: "editor",
          wp_app_password: "stored-password",
        },
        dependencies: {
          createWordPressClient: () => ({ publishArticle }),
          resolvePassword: () => "resolved-password",
        },
      }),
    ).rejects.toThrow("wp failed");

    expect(supabase.calls).toEqual([]);
  });
});
