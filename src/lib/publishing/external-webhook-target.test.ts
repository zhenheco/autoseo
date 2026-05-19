import { describe, expect, it, vi } from "vitest";
import { publishExternalWebhookArticle } from "./external-webhook-target";

interface FakeResponse {
  data?: unknown;
  error?: { message?: string } | null;
}

function createFakeSupabase(responses: FakeResponse[] = []) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];
  let responseIndex = 0;

  function nextResponse() {
    return responses[responseIndex++] ?? { error: null };
  }

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
        single() {
          calls.push({ table, method: "single", args: [] });
          return Promise.resolve(nextResponse());
        },
        then<TResult1 = FakeResponse, TResult2 = never>(
          onfulfilled?: ((value: FakeResponse) => TResult1) | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          return Promise.resolve(nextResponse()).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("publishExternalWebhookArticle", () => {
  it("syncs the full article and marks it as published", async () => {
    const fullArticle = { id: "article-1", title: "Full Title" };
    const supabase = createFakeSupabase([{ data: fullArticle, error: null }]);
    const syncArticle = vi.fn().mockResolvedValue({
      failed: 0,
      results: [{ success: true }],
    });
    const publishedAt = "2026-05-19T12:00:00.000Z";

    await expect(
      publishExternalWebhookArticle({
        supabase: supabase as never,
        syncArticle,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
        now: () => publishedAt,
      }),
    ).resolves.toEqual({ publishedAt, fullArticle });

    expect(syncArticle).toHaveBeenCalledWith(fullArticle, "create", [
      "website-1",
    ]);
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        expect.objectContaining({
          status: "published",
          published_at: publishedAt,
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
  });

  it("throws when the full article cannot be loaded", async () => {
    const supabase = createFakeSupabase([{ data: null, error: null }]);
    const syncArticle = vi.fn();

    await expect(
      publishExternalWebhookArticle({
        supabase: supabase as never,
        syncArticle,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
      }),
    ).rejects.toThrow("無法取得完整文章資料");

    expect(syncArticle).not.toHaveBeenCalled();
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "article_jobs",
        method: "update",
      }),
    );
  });

  it("throws the failed webhook sync error", async () => {
    const fullArticle = { id: "article-1" };
    const supabase = createFakeSupabase([{ data: fullArticle, error: null }]);
    const syncArticle = vi.fn().mockResolvedValue({
      failed: 1,
      results: [{ success: false, error_message: "webhook down" }],
    });

    await expect(
      publishExternalWebhookArticle({
        supabase: supabase as never,
        syncArticle,
        article: { id: "job-1" },
        generatedArticle: { id: "article-1" },
        website: { id: "website-1" },
      }),
    ).rejects.toThrow("webhook down");
  });
});
