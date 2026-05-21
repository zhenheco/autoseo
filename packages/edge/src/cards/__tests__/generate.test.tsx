import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Quote } from "../templates";
import {
  CardCapExceededError,
  generateCards,
  type BrowserRenderingClient,
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
