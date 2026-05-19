import { describe, expect, it, vi } from "vitest";
import { publishWordPressDraftArticle } from "./wordpress-draft-target";

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

describe("publishWordPressDraftArticle", () => {
  it("publishes an existing WordPress draft and marks local records published", async () => {
    const supabase = createFakeSupabase();
    const updatePost = vi.fn().mockResolvedValue({});
    const createWordPressClient = vi.fn(() => ({ updatePost }));
    const resolvePassword = vi.fn(() => "resolved-password");
    const publishedAt = "2026-05-19T12:00:00.000Z";

    await expect(
      publishWordPressDraftArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: {
          id: "article-1",
          wordpress_post_id: 123,
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
    ).resolves.toEqual({ publishedAt, wordpressPostId: 123 });

    expect(resolvePassword).toHaveBeenCalledWith("stored-password");
    expect(createWordPressClient).toHaveBeenCalledWith({
      url: "https://wp.example.com",
      username: "editor",
      applicationPassword: "resolved-password",
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(updatePost).toHaveBeenCalledWith(123, { status: "publish" });
    expect(supabase.calls).toEqual([
      {
        table: "article_jobs",
        method: "update",
        args: [
          {
            status: "published",
            published_at: publishedAt,
            wordpress_post_id: "123",
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

  it("does not update local records when WordPress publish fails", async () => {
    const supabase = createFakeSupabase();
    const updatePost = vi.fn().mockRejectedValue(new Error("wp failed"));

    await expect(
      publishWordPressDraftArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: {
          id: "article-1",
          wordpress_post_id: 123,
        },
        website: {
          id: "website-1",
          wordpress_url: "https://wp.example.com",
          wp_username: "editor",
          wp_app_password: "stored-password",
        },
        dependencies: {
          createWordPressClient: () => ({ updatePost }),
          resolvePassword: () => "resolved-password",
        },
      }),
    ).rejects.toThrow("wp failed");

    expect(supabase.calls).toEqual([]);
  });

  it("throws when the article job update fails", async () => {
    const supabase = createFakeSupabase([
      { error: { message: "job update failed" } },
    ]);

    await expect(
      publishWordPressDraftArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: {
          id: "article-1",
          wordpress_post_id: 123,
        },
        website: {
          id: "website-1",
          wordpress_url: "https://wp.example.com",
          wp_username: "editor",
          wp_app_password: "stored-password",
        },
        dependencies: {
          createWordPressClient: () => ({
            updatePost: vi.fn().mockResolvedValue({}),
          }),
          resolvePassword: () => "resolved-password",
        },
      }),
    ).rejects.toThrow("job update failed");

    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({ table: "generated_articles" }),
    );
  });
});
