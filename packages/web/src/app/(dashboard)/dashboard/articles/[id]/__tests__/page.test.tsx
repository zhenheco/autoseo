import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const messages: Record<string, string> = {
      notFound: "Not found",
      untitled: "Untitled",
      websiteLabel: "Website:",
      unspecified: "Unspecified",
      backToList: "Back",
      articleInfo: "Article info",
      statusLabel: "Status",
      statusPublished: "Published",
      statusFailed: "Failed",
      statusProcessing: "Processing",
      statusDraft: "Draft",
      statusPending: "Pending",
      inputMethod: "Input method",
      inputTypeKeyword: "Keyword",
      inputTypeUrl: "URL",
      inputTypeBatch: "Batch",
      inputContent: "Input",
      createdAt: "Created",
      publishedAt: "Published at",
      generatedContent: "Generated content",
      generatedContentDescription: "Generated article body",
      cardAssets: "Card assets",
      cardAssetsDescription: "Download generated social cards",
      downloadCard: "Download card",
      "socialPack.title": "Manual mode",
      "socialPack.download": "Download social pack",
      "socialPack.description":
        "Download a ZIP of cards + suggested captions to post manually until automatic publishing is approved by Meta.",
      errorMessage: "Error",
    };
    return messages[key] ?? key;
  }),
}));

function createSupabaseMock(input?: {
  articleJobMetadata?: Record<string, unknown> | null;
  cardAssets?: unknown[];
}) {
  return {
    from(table: string) {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        single: vi.fn(async () => {
          if (table !== "article_jobs") {
            return { data: null, error: null };
          }

          return {
            data: {
              id: "job-1",
              status: "completed",
              website_id: "website-1",
              input_type: "keyword",
              input_content: { keyword: "seo" },
              created_at: "2026-05-21T08:00:00.000Z",
              published_at: null,
              wp_post_id: null,
              error_message: null,
              metadata: input?.articleJobMetadata ?? null,
              article_title: "Fallback title",
              website_configs: {
                site_name: "Acme Site",
                site_url: "https://example.com",
              },
              generated_articles: {
                id: "article-1",
                title: "Card-ready article",
                html_content: "<p>Generated body</p>",
                markdown_content: "Generated body",
                word_count: 100,
                seo_title: "SEO title",
                seo_description: "SEO description",
                featured_image_url: null,
              },
            },
            error: null,
          };
        }),
        order: vi.fn(async () => {
          if (table !== "article_assets") {
            return { data: [], error: null };
          }

          return {
            data: input?.cardAssets ?? [
              {
                id: "asset-1",
                template: "quote",
                size: "ig_square",
                r2_url: "https://cdn.example.com/cards/article-1/quote.png",
                created_at: "2026-05-21T08:01:00.000Z",
              },
            ],
            error: null,
          };
        }),
      };

      return builder;
    },
  };
}

describe("article detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    supabaseMocks.createClient.mockResolvedValue(createSupabaseMock());
  });

  it("shows generated social card thumbnails with download links", async () => {
    const { default: ArticleDetailPage } = await import("../page");

    render(
      await ArticleDetailPage({
        params: Promise.resolve({ id: "job-1" }),
      }),
    );

    expect(screen.getByText("Card assets")).toBeInTheDocument();
    expect(screen.getByAltText("quote ig_square")).toHaveAttribute(
      "src",
      "https://cdn.example.com/cards/article-1/quote.png",
    );
    expect(screen.getByRole("link", { name: "Download card" })).toHaveAttribute(
      "href",
      "https://cdn.example.com/cards/article-1/quote.png",
    );
  });

  it("shows a quota banner when card generation was skipped for monthly quota", async () => {
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({
        articleJobMetadata: {
          tags: ["cards_quota_exceeded"],
          card_quota: {
            used: 100,
            cap: 100,
            plan: "solo",
          },
        },
        cardAssets: [],
      }),
    );
    const { default: ArticleDetailPage } = await import("../page");

    render(
      await ArticleDetailPage({
        params: Promise.resolve({ id: "job-1" }),
      }),
    );

    expect(
      screen.getByText(
        "Card quota for this month exhausted (used 100 / 100). Upgrade to Pro for 500/month.",
      ),
    ).toBeInTheDocument();
  });

  it("shows transition-mode social pack download when Meta OAuth is not public", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_OAUTH_PUBLIC_ENABLED", "false");
    const { default: ArticleDetailPage } = await import("../page");

    render(
      await ArticleDetailPage({
        params: Promise.resolve({ id: "job-1" }),
      }),
    );

    expect(
      screen.getByText(
        "Download a ZIP of cards + suggested captions to post manually until automatic publishing is approved by Meta.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download social pack" }),
    ).toHaveAttribute("href", "/api/articles/article-1/social-pack");
  });
});
