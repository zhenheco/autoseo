import { beforeEach, describe, expect, it, vi } from "vitest";

const syncArticleMock = vi.hoisted(() => vi.fn());
const publishWordPressDraftArticleMock = vi.hoisted(() => vi.fn());
const publishNewWordPressArticleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({
  syncArticle: syncArticleMock,
}));

vi.mock("@/lib/publishing/wordpress-draft-target", () => ({
  publishWordPressDraftArticle: publishWordPressDraftArticleMock,
}));

vi.mock("@/lib/publishing/wordpress-new-target", () => ({
  publishNewWordPressArticle: publishNewWordPressArticleMock,
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

function createFakeSupabase(
  response:
    | { data?: unknown[]; error?: unknown }
    | Record<string, { data?: unknown[]; error?: unknown }>,
) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
    calls,
    from(table: string) {
      const builder = {
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          return builder;
        },
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        lte(...args: unknown[]) {
          calls.push({ table, method: "lte", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          const tableResponse =
            "data" in response || "error" in response
              ? response
              : ((
                  response as Record<
                    string,
                    { data?: unknown[]; error?: unknown }
                  >
                )[table] ?? {});
          return Promise.resolve(tableResponse);
        },
        single() {
          calls.push({ table, method: "single", args: [] });
          const tableResponse =
            "data" in response || "error" in response
              ? response
              : ((
                  response as Record<
                    string,
                    { data?: unknown[]; error?: unknown }
                  >
                )[table] ?? {});
          return Promise.resolve(tableResponse);
        },
        then<TResult1 = { error: null }, TResult2 = never>(
          onfulfilled?: ((value: { error: null }) => TResult1) | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          return Promise.resolve({ error: null }).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("process scheduled articles cron route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    syncArticleMock.mockReset();
    publishWordPressDraftArticleMock.mockReset();
    publishNewWordPressArticleMock.mockReset();
  });

  it("uses the standard cron response when the secret is missing", async () => {
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("uses the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("returns the existing no scheduled articles payload when cron auth passes", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createFakeSupabase({ data: [], error: null });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      processed: 0,
      message: "No scheduled articles to process",
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "eq",
      args: ["status", "scheduled"],
    });
  });

  it("records inactive websites as failed scheduled publishes", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createFakeSupabase({
      article_jobs: {
        data: [
          {
            id: "job-1",
            article_title: "Title",
            publish_retry_count: 2,
            website_configs: {
              is_active: false,
            },
            generated_articles: {
              id: "article-1",
              title: "Title",
            },
          },
        ],
        error: null,
      },
      article_translations: {
        data: [],
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      failed: 1,
      retried: 0,
      details: [
        {
          articleId: "job-1",
          title: "Title",
          status: "failed",
          error: "網站已停用",
        },
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        expect.objectContaining({
          last_publish_error: expect.stringContaining("網站已停用"),
          publish_retry_count: 0,
        }),
      ],
    });
  });

  it("publishes platform blog jobs through the scheduled publish flow", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const { revalidatePath } = await import("next/cache");
    const supabase = createFakeSupabase({
      article_jobs: {
        data: [
          {
            id: "job-1",
            article_title: "Title",
            company_id: "company-1",
            user_id: "user-1",
            publish_retry_count: 0,
            sync_target_ids: null,
            website_configs: {
              id: "website-1",
              is_active: true,
              is_platform_blog: true,
              auto_translate_enabled: false,
              auto_translate_languages: [],
            },
            generated_articles: {
              id: "article-1",
              title: "Generated Title",
            },
          },
        ],
        error: null,
      },
      article_translations: {
        data: [],
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
      retried: 0,
      details: [
        {
          articleId: "job-1",
          title: "Generated Title",
          status: "published",
        },
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        expect.objectContaining({
          status: "published",
          publish_retry_count: 0,
          last_publish_error: null,
        }),
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "generated_articles",
      method: "update",
      args: [
        expect.objectContaining({
          status: "published",
          published_to_website_id: "website-1",
        }),
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("publishes existing WordPress draft jobs through the draft adapter", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createFakeSupabase({
      article_jobs: {
        data: [
          {
            id: "job-1",
            article_title: "Title",
            company_id: "company-1",
            user_id: "user-1",
            publish_retry_count: 0,
            sync_target_ids: null,
            website_configs: {
              id: "website-1",
              is_active: true,
              wp_enabled: true,
              wordpress_url: "https://wp.example.com",
              wp_username: "editor",
              wp_app_password: "stored-password",
              auto_translate_enabled: false,
              auto_translate_languages: [],
            },
            generated_articles: {
              id: "article-1",
              title: "Generated Title",
              wordpress_post_id: 123,
              wordpress_status: "draft",
            },
          },
        ],
        error: null,
      },
      article_translations: {
        data: [],
        error: null,
      },
    });
    publishWordPressDraftArticleMock.mockResolvedValue({
      publishedAt: "2026-05-19T12:00:00.000Z",
      wordpressPostId: 123,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
      details: [
        {
          articleId: "job-1",
          title: "Title",
          status: "published",
        },
      ],
    });
    expect(publishWordPressDraftArticleMock).toHaveBeenCalledWith({
      supabase,
      article: expect.objectContaining({ id: "job-1" }),
      generatedArticle: expect.objectContaining({
        id: "article-1",
        wordpress_post_id: 123,
      }),
      website: expect.objectContaining({ id: "website-1" }),
    });
  });

  it("publishes new WordPress jobs through the new post adapter", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createFakeSupabase({
      article_jobs: {
        data: [
          {
            id: "job-1",
            article_title: "Title",
            company_id: "company-1",
            user_id: "user-1",
            publish_retry_count: 0,
            sync_target_ids: null,
            website_configs: {
              id: "website-1",
              is_active: true,
              wp_enabled: true,
              wordpress_url: "https://wp.example.com",
              wp_username: "editor",
              wp_app_password: "stored-password",
              auto_translate_enabled: false,
              auto_translate_languages: [],
            },
            generated_articles: {
              id: "article-1",
              title: "Generated Title",
              html_content: "<p>Body</p>",
              seo_title: "SEO Title",
              seo_description: "SEO Description",
              slug: "seo-title",
              og_image: null,
              categories: [],
              tags: [],
              focus_keyword: "keyword",
            },
          },
        ],
        error: null,
      },
      article_translations: {
        data: [],
        error: null,
      },
    });
    publishNewWordPressArticleMock.mockResolvedValue({
      publishedAt: "2026-05-19T12:00:00.000Z",
      wordpressPostId: 456,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
      details: [
        {
          articleId: "job-1",
          title: "Title",
          status: "published",
        },
      ],
    });
    expect(publishNewWordPressArticleMock).toHaveBeenCalledWith({
      supabase,
      article: expect.objectContaining({ id: "job-1" }),
      generatedArticle: expect.objectContaining({
        id: "article-1",
        title: "Generated Title",
      }),
      website: expect.objectContaining({ id: "website-1" }),
    });
  });

  it("publishes external website jobs through webhook sync", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const fullArticle = { id: "article-1", title: "Full Title" };
    const supabase = createFakeSupabase({
      article_jobs: {
        data: [
          {
            id: "job-1",
            article_title: "Title",
            company_id: "company-1",
            user_id: "user-1",
            publish_retry_count: 0,
            website_configs: {
              id: "website-1",
              website_name: "External Site",
              is_active: true,
              website_type: "external",
              webhook_url: "https://example.com/webhook",
              auto_translate_enabled: false,
              auto_translate_languages: [],
            },
            generated_articles: {
              id: "article-1",
              title: "Generated Title",
            },
          },
        ],
        error: null,
      },
      generated_articles: {
        data: fullArticle as never,
        error: null,
      },
      article_translations: {
        data: [],
        error: null,
      },
    });
    syncArticleMock.mockResolvedValue({
      failed: 0,
      results: [{ success: true }],
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-scheduled-articles/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
      details: [
        {
          articleId: "job-1",
          title: "Generated Title",
          status: "published",
        },
      ],
    });
    expect(syncArticleMock).toHaveBeenCalledWith(fullArticle, "create", [
      "website-1",
    ]);
    expect(supabase.calls).toContainEqual({
      table: "generated_articles",
      method: "select",
      args: ["*"],
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        expect.objectContaining({
          status: "published",
          publish_retry_count: 0,
          last_publish_error: null,
        }),
      ],
    });
  });
});
