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

  return {
    inserts,
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        insert: vi.fn(async (payload: unknown) => {
          inserts.push({ table, payload });
          return { data: payload, error: null };
        }),
        single: vi.fn(async () => {
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

    expect(generateCards).toHaveBeenCalledTimes(DEFAULT_CARD_TEMPLATES.length);
    expect(generateCards).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "article-1",
        brandId: "brand-1",
        formats: DEFAULT_CARD_FORMATS,
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
