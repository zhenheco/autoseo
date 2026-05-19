import { describe, expect, it, vi } from "vitest";
import { runScheduledPostPublishEffects } from "./post-publish-effects";

function createFakeSupabase(fullArticle: unknown = null) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
    calls,
    from(table: string) {
      const builder = {
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
          return Promise.resolve({ data: fullArticle, error: null });
        },
      };

      return builder;
    },
  };
}

describe("runScheduledPostPublishEffects", () => {
  it("triggers auto translation with the scheduled article context", async () => {
    const supabase = createFakeSupabase();
    const triggerAutoTranslation = vi.fn().mockResolvedValue({
      triggered: true,
      jobCount: 1,
      skipped: 0,
    });

    await runScheduledPostPublishEffects({
      supabase: supabase as never,
      article: {
        id: "job-1",
        company_id: "company-1",
        user_id: "user-1",
        sync_target_ids: null,
      },
      generatedArticle: { id: "article-1" },
      website: {
        id: "website-1",
        auto_translate_enabled: true,
        auto_translate_languages: ["en", "ja"],
      },
      triggerAutoTranslation,
    });

    expect(triggerAutoTranslation).toHaveBeenCalledWith(
      supabase,
      "article-1",
      "website-1",
      "company-1",
      "user-1",
      true,
      ["en", "ja"],
    );
    expect(supabase.calls).toEqual([]);
  });

  it("loads the full article and schedules sync when target ids exist", async () => {
    const fullArticle = { id: "article-1", title: "Full Article" };
    const supabase = createFakeSupabase(fullArticle);
    const syncArticle = vi.fn().mockResolvedValue({ failed: 0, results: [] });

    await runScheduledPostPublishEffects({
      supabase: supabase as never,
      article: {
        id: "job-1",
        company_id: "company-1",
        user_id: "user-1",
        sync_target_ids: ["target-1", "target-2"],
      },
      generatedArticle: { id: "article-1" },
      website: {
        id: "website-1",
        auto_translate_enabled: false,
        auto_translate_languages: [],
      },
      triggerAutoTranslation: vi.fn().mockResolvedValue({}),
      loadSyncArticle: vi.fn().mockResolvedValue(syncArticle),
    });

    expect(supabase.calls).toEqual([
      {
        table: "generated_articles",
        method: "select",
        args: ["*"],
      },
      {
        table: "generated_articles",
        method: "eq",
        args: ["id", "article-1"],
      },
      {
        table: "generated_articles",
        method: "single",
        args: [],
      },
    ]);
    expect(syncArticle).toHaveBeenCalledWith(fullArticle, "create", [
      "target-1",
      "target-2",
    ]);
  });

  it("skips sync loading when there are no target ids", async () => {
    const supabase = createFakeSupabase();
    const loadSyncArticle = vi.fn();

    await runScheduledPostPublishEffects({
      supabase: supabase as never,
      article: {
        id: "job-1",
        company_id: "company-1",
        user_id: "user-1",
        sync_target_ids: [],
      },
      generatedArticle: { id: "article-1" },
      website: {
        id: "website-1",
        auto_translate_enabled: false,
        auto_translate_languages: [],
      },
      triggerAutoTranslation: vi.fn().mockResolvedValue({}),
      loadSyncArticle,
    });

    expect(loadSyncArticle).not.toHaveBeenCalled();
    expect(supabase.calls).toEqual([]);
  });

  it("logs background sync failures without rejecting the effect runner", async () => {
    const supabase = createFakeSupabase({ id: "article-1" });
    const logSyncError = vi.fn();

    await expect(
      runScheduledPostPublishEffects({
        supabase: supabase as never,
        article: {
          id: "job-1",
          company_id: "company-1",
          user_id: "user-1",
          sync_target_ids: ["target-1"],
        },
        generatedArticle: { id: "article-1" },
        website: {
          id: "website-1",
          auto_translate_enabled: false,
          auto_translate_languages: [],
        },
        triggerAutoTranslation: vi.fn().mockResolvedValue({}),
        loadSyncArticle: vi
          .fn()
          .mockResolvedValue(
            vi.fn().mockRejectedValue(new Error("sync failed")),
          ),
        logSyncError,
      }),
    ).resolves.toEqual({
      autoTranslation: {},
      syncQueued: true,
    });

    await Promise.resolve();

    expect(logSyncError).toHaveBeenCalledWith(
      "[Process Scheduled Articles] Sync failed for job-1:",
      expect.any(Error),
    );
  });
});
