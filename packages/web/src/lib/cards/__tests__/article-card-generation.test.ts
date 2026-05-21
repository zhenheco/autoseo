import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CARD_FORMATS,
  DEFAULT_CARD_TEMPLATES,
  runArticleCardGeneration,
  triggerArticleCardGeneration,
  type GenerateCardsFn,
} from "../article-card-generation";

function createSupabaseMock() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const articleJobMetadata = {
    current_phase: "content_completed",
  };

  return {
    inserts,
    updates,
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        update: vi.fn((payload: unknown) => {
          updates.push({ table, payload });
          return builder;
        }),
        insert: vi.fn(async (payload: unknown) => {
          inserts.push({ table, payload });
          return { data: payload, error: null };
        }),
        single: vi.fn(async () => {
          if (table === "article_jobs") {
            return {
              data: {
                metadata: articleJobMetadata,
              },
              error: null,
            };
          }

          if (table === "generated_articles") {
            return {
              data: {
                id: "article-1",
                brand_id: "brand-1",
                title: "Card-ready article",
                markdown_content: "Body",
                html_content: "<p>Body</p>",
              },
              error: null,
            };
          }

          if (table === "brands") {
            return {
              data: {
                id: "brand-1",
                name: "Acme",
                primary_color: "#111111",
                secondary_color: "#eeeeee",
                logo_url: null,
              },
              error: null,
            };
          }

          return { data: null, error: null };
        }),
        then: vi.fn((onfulfilled?: (value: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onfulfilled),
        ),
      };

      return builder;
    }),
  };
}

describe("article card generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates default cards in async-safe batches and stores article_assets rows", async () => {
    const supabase = createSupabaseMock();
    const generateCards: GenerateCardsFn = vi.fn(async (input) =>
      input.formats.map((format: "ig_square" | "ig_story" | "og") => ({
        template: input.templates?.[0] ?? "hero",
        format,
        size:
          format === "ig_story"
            ? { width: 1080, height: 1920 }
            : format === "og"
              ? { width: 1200, height: 630 }
              : { width: 1080, height: 1080 },
        r2Url: `r2://card-assets/cards/${input.articleId}/${input.templates?.[0]}_${format}.png`,
      })),
    ) satisfies GenerateCardsFn;

    await runArticleCardGeneration(
      {
        articleId: "article-1",
        brandId: "brand-1",
      },
      {
        supabase: supabase as never,
        generateCards,
        browserRenderingClient: { screenshot: vi.fn() },
        r2Bucket: {} as never,
        alertOps: vi.fn(),
      },
    );

    expect(generateCards).toHaveBeenCalledTimes(
      DEFAULT_CARD_TEMPLATES.length * DEFAULT_CARD_FORMATS.length,
    );
    expect(generateCards).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "article-1",
        brandId: "brand-1",
        formats: ["ig_square"],
        templates: ["quote"],
      }),
      expect.any(Object),
    );

    expect(supabase.inserts).toEqual([
      {
        table: "article_assets",
        payload: expect.arrayContaining([
          expect.objectContaining({
            article_id: "article-1",
            kind: "card",
            template: "quote",
            size: "ig_square",
            r2_url: "r2://card-assets/cards/article-1/quote_ig_square.png",
            brand_id: "brand-1",
          }),
        ]),
      },
    ]);
    expect(
      (supabase.inserts[0] as { payload: unknown[] }).payload,
    ).toHaveLength(DEFAULT_CARD_FORMATS.length * DEFAULT_CARD_TEMPLATES.length);
  });

  it("alerts ops and resolves when card generation fails", async () => {
    const supabase = createSupabaseMock();
    const alertOps = vi.fn(async () => ({ ok: true }));

    await expect(
      runArticleCardGeneration(
        {
          articleId: "article-1",
          brandId: "brand-1",
        },
        {
          supabase: supabase as never,
          generateCards: vi.fn(async () => {
            throw new Error("renderer_down");
          }),
          browserRenderingClient: { screenshot: vi.fn() },
          r2Bucket: {} as never,
          alertOps,
        },
      ),
    ).resolves.toBeUndefined();

    expect(alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Card generation failed"),
        text: expect.stringContaining("renderer_down"),
        idempotencyKey: expect.stringContaining(
          "article-card-generation-failed:article-1:",
        ),
      }),
    );
  });

  it("catches card quota exhaustion, alerts ops, tags the article job, and stores completed cards", async () => {
    const supabase = createSupabaseMock();
    const alertOps = vi.fn(async () => ({ ok: true }));
    const generateCards = vi
      .fn<GenerateCardsFn>()
      .mockResolvedValueOnce([
        {
          template: "quote",
          format: "ig_square",
          size: { width: 1080, height: 1080 },
          r2Url: "r2://card-assets/cards/article-1/quote_ig_square.png",
        },
      ])
      .mockRejectedValueOnce(
        Object.assign(new Error("card_quota_exceeded"), {
          name: "CardQuotaExceededError",
          companyId: "company-1",
          used: 100,
          cap: 100,
          plan: "solo",
        }),
      );

    await expect(
      runArticleCardGeneration(
        {
          articleId: "article-1",
          brandId: "brand-1",
          articleJobId: "job-1",
          companyId: "company-1",
        },
        {
          supabase: supabase as never,
          generateCards,
          browserRenderingClient: { screenshot: vi.fn() },
          r2Bucket: {} as never,
          alertOps,
        },
      ),
    ).resolves.toBeUndefined();

    expect(supabase.inserts).toEqual([
      {
        table: "article_assets",
        payload: [
          expect.objectContaining({
            article_id: "article-1",
            kind: "card",
            template: "quote",
          }),
        ],
      },
    ]);
    expect(supabase.updates).toContainEqual({
      table: "article_jobs",
      payload: expect.objectContaining({
        metadata: expect.objectContaining({
          tags: ["cards_quota_exceeded"],
          card_quota: expect.objectContaining({
            used: 100,
            cap: 100,
            plan: "solo",
          }),
        }),
      }),
    });
    expect(alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Card quota exhausted"),
        text: expect.stringContaining("cards_quota_exceeded"),
      }),
    );
    expect(generateCards).toHaveBeenCalledTimes(2);
  });

  it("starts generation without returning the background promise", async () => {
    const run = vi.fn(async () => undefined);

    triggerArticleCardGeneration(
      {
        articleId: "article-1",
        brandId: "brand-1",
      },
      { run },
    );

    expect(run).toHaveBeenCalledWith({
      articleId: "article-1",
      brandId: "brand-1",
    });
  });
});
