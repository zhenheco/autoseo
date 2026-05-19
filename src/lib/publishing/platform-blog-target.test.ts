import { describe, expect, it, vi } from "vitest";
import { publishPlatformBlogArticle } from "./platform-blog-target";

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

describe("publishPlatformBlogArticle", () => {
  it("marks the scheduled job and generated article as published", async () => {
    const supabase = createFakeSupabase();
    const publishedAt = "2026-05-19T12:00:00.000Z";

    await expect(
      publishPlatformBlogArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
        now: () => publishedAt,
      }),
    ).resolves.toEqual({ publishedAt });

    expect(supabase.calls).toEqual([
      {
        table: "article_jobs",
        method: "update",
        args: [
          {
            status: "published",
            published_at: publishedAt,
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
            status: "published",
            published_at: publishedAt,
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

  it("throws when article job update fails", async () => {
    const supabase = createFakeSupabase([
      { error: { message: "job update failed" } },
    ]);

    await expect(
      publishPlatformBlogArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
        now: vi.fn(() => "2026-05-19T12:00:00.000Z"),
      }),
    ).rejects.toThrow("job update failed");

    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({ table: "generated_articles" }),
    );
  });

  it("throws when generated article update fails", async () => {
    const supabase = createFakeSupabase([
      { error: null },
      { error: { message: "article update failed" } },
    ]);

    await expect(
      publishPlatformBlogArticle({
        supabase: supabase as never,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
        now: () => "2026-05-19T12:00:00.000Z",
      }),
    ).rejects.toThrow("article update failed");
  });
});
