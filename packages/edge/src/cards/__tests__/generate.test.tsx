import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Quote } from "../templates";
import {
  CardCapExceededError,
  CardQuotaExceededError,
  generateCards,
  type BrowserRenderingClient,
  type CardQuotaEnforcer,
} from "../generate";
import type { Brand, GeneratedArticle } from "../types";

const article: GeneratedArticle = {
  id: "article-123",
  title: "5 SEO wins this week",
  excerpt: "A practical weekly SEO summary.",
  markdown_content:
    "- Ship faster metadata fixes\n- Refresh stale product pages\n- Improve internal links",
  html_content:
    "<ul><li>Ship faster metadata fixes</li><li>Refresh stale product pages</li><li>Improve internal links</li></ul>",
  seo_description: "A practical weekly SEO summary.",
  focus_keyword: "SEO wins",
  word_count: 860,
  reading_time: 5,
  featured_image_url: "https://cdn.example.com/hero.png",
  takeaways: [
    "Ship faster metadata fixes",
    "Refresh stale product pages",
    "Improve internal links",
  ],
};

const brand: Brand = {
  id: "brand-123",
  name: "Acme SEO",
  primaryColor: "#0057ff",
  secondaryColor: "#ffcc00",
  logoUrl: null,
};

function browserRenderingClient(): BrowserRenderingClient {
  return {
    screenshot: vi.fn(async () => new Uint8Array([137, 80, 78, 71]).buffer),
  };
}

function r2Bucket() {
  return {
    put: vi.fn(async () => null),
  } as unknown as R2Bucket;
}

function quotaEnforcer(input?: {
  used?: number;
  cap?: number;
  allowed?: boolean;
}): CardQuotaEnforcer {
  const used = input?.used ?? 0;
  const cap = input?.cap ?? 100;
  const allowed = input?.allowed ?? true;

  return {
    canConsume: vi.fn(async () => ({
      allowed,
      used,
      cap,
      remaining: Math.max(cap - used, 0),
      plan: "solo",
      resource: "cards",
    })),
    consume: vi.fn(async () => ({
      allowed,
      used: allowed ? used + 1 : used,
      cap,
      remaining: Math.max(cap - (allowed ? used + 1 : used), 0),
      plan: "solo",
      resource: "cards",
    })),
  };
}

describe("generateCards", () => {
  it("returns one R2 url for one template and one size", async () => {
    const browser = browserRenderingClient();
    const bucket = r2Bucket();

    const result = await generateCards(
      {
        articleId: article.id,
        brandId: brand.id,
        formats: ["ig_square"],
        templates: ["quote"],
      },
      {
        fetchArticle: vi.fn(async () => article),
        fetchBrand: vi.fn(async () => brand),
        browserRenderingClient: browser,
        r2Bucket: bucket,
      },
    );

    expect(result).toEqual([
      {
        template: "quote",
        format: "ig_square",
        size: { width: 1080, height: 1080 },
        r2Url:
          "r2://card-assets/cards/article-123/quote_1080x1080.png",
      },
    ]);
    expect(browser.screenshot).toHaveBeenCalledTimes(1);
  });

  it("throws CardCapExceededError before rendering when card cap is exceeded", async () => {
    const browser = browserRenderingClient();

    await expect(
      generateCards(
        {
          articleId: article.id,
          brandId: brand.id,
          formats: ["ig_square", "og"],
          templates: ["quote", "stat", "list"],
        },
        {
          fetchArticle: vi.fn(async () => article),
          fetchBrand: vi.fn(async () => brand),
          browserRenderingClient: browser,
          r2Bucket: r2Bucket(),
        },
      ),
    ).rejects.toBeInstanceOf(CardCapExceededError);

    expect(browser.screenshot).not.toHaveBeenCalled();
  });

  it("checks and consumes one card quota unit around Browser Rendering", async () => {
    const browser = browserRenderingClient();
    const quota = quotaEnforcer();

    await generateCards(
      {
        articleId: article.id,
        brandId: brand.id,
        companyId: "company-1",
        formats: ["ig_square"],
        templates: ["quote"],
      },
      {
        fetchArticle: vi.fn(async () => article),
        fetchBrand: vi.fn(async () => brand),
        browserRenderingClient: browser,
        r2Bucket: r2Bucket(),
        quotaEnforcer: quota,
      },
    );

    expect(quota.canConsume).toHaveBeenCalledWith("company-1", "cards", 1);
    expect(browser.screenshot).toHaveBeenCalledTimes(1);
    expect(quota.consume).toHaveBeenCalledWith("company-1", "cards", 1);
  });

  it("throws CardQuotaExceededError and skips remaining cards when quota is exhausted", async () => {
    const browser = browserRenderingClient();
    const quota = quotaEnforcer({ used: 100, cap: 100, allowed: false });

    await expect(
      generateCards(
        {
          articleId: article.id,
          brandId: brand.id,
          companyId: "company-1",
          formats: ["ig_square", "og"],
          templates: ["quote"],
        },
        {
          fetchArticle: vi.fn(async () => article),
          fetchBrand: vi.fn(async () => brand),
          browserRenderingClient: browser,
          r2Bucket: r2Bucket(),
          quotaEnforcer: quota,
        },
      ),
    ).rejects.toBeInstanceOf(CardQuotaExceededError);

    expect(browser.screenshot).not.toHaveBeenCalled();
    expect(quota.consume).not.toHaveBeenCalled();
  });

  it("emits a card quota warning when usage crosses 80 percent", async () => {
    const captureCardQuotaWarning = vi.fn();

    await generateCards(
      {
        articleId: article.id,
        brandId: brand.id,
        companyId: "company-1",
        formats: ["ig_square"],
        templates: ["quote"],
      },
      {
        fetchArticle: vi.fn(async () => article),
        fetchBrand: vi.fn(async () => brand),
        browserRenderingClient: browserRenderingClient(),
        r2Bucket: r2Bucket(),
        quotaEnforcer: quotaEnforcer({ used: 79, cap: 100 }),
        captureCardQuotaWarning,
      },
    );

    expect(captureCardQuotaWarning).toHaveBeenCalledWith({
      companyId: "company-1",
      used: 80,
      cap: 100,
      plan: "solo",
      threshold: 0.8,
    });
  });

  it("applies the brand primary color to the Quote template background", () => {
    const html = renderToString(
      <Quote brand={brand} article={article} size={{ width: 1080, height: 1080 }} />,
    );

    expect(html).toContain(`background:${brand.primaryColor}`);
  });

  it("writes PNGs to the expected R2 key shape", async () => {
    const bucket = r2Bucket();

    await generateCards(
      {
        articleId: article.id,
        brandId: brand.id,
        formats: ["ig_square"],
        templates: ["quote"],
      },
      {
        fetchArticle: vi.fn(async () => article),
        fetchBrand: vi.fn(async () => brand),
        browserRenderingClient: browserRenderingClient(),
        r2Bucket: bucket,
      },
    );

    expect(bucket.put).toHaveBeenCalledWith(
      "cards/article-123/quote_1080x1080.png",
      expect.any(ArrayBuffer),
      expect.objectContaining({
        httpMetadata: { contentType: "image/png" },
      }),
    );
  });

  it("snapshots the Quote template HTML", () => {
    const html = renderToString(
      <Quote brand={brand} article={article} size={{ width: 1080, height: 1080 }} />,
    );

    expect(html).toMatchSnapshot();
  });
});
