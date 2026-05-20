import { describe, expect, it, vi } from "vitest";
import {
  applyAuditFixToShopline,
  type ApplyShoplineFixDeps,
} from "../src/apply-shopline-fix";
import type { AuditIssue } from "../src/types";

function issue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    ruleId: "meta.description.tooShort",
    severity: "warning",
    riskLevel: "low",
    page: "https://demo-shop.myshopline.com/products/blue-shirt",
    selector: 'meta[name="description"]',
    current: "Short",
    source: "html-scan",
    estimatedImpact: "medium",
    ...overrides,
  };
}

function deps(
  overrides: Partial<ApplyShoplineFixDeps> = {},
): ApplyShoplineFixDeps {
  return {
    shoplineUpdate: vi.fn(async () => ({
      productId: "product-1",
      seo: { description: "A polished SHOPLINE meta description." },
    })),
    generateMetaDescription: vi.fn(
      async () => "A polished SHOPLINE meta description.",
    ),
    generateImageAlt: vi.fn(async () => "Generated image alt"),
    getShopHandleForReport: vi.fn(async () => "demo-shop"),
    ...overrides,
  };
}

describe("applyAuditFixToShopline", () => {
  it("rewrites short meta descriptions through AI and the SHOPLINE editor", async () => {
    const testDeps = deps();
    const testIssue = issue();

    const result = await applyAuditFixToShopline(
      {
        issue: testIssue,
        reportId: "report-1",
        shopHandle: "demo-shop",
      },
      testDeps,
    );

    expect(testDeps.generateMetaDescription).toHaveBeenCalledWith({
      current: "Short",
      pageUrl: "https://demo-shop.myshopline.com/products/blue-shirt",
    });
    expect(testDeps.shoplineUpdate).toHaveBeenCalledWith({
      issue: {
        ...testIssue,
        suggested: "A polished SHOPLINE meta description.",
      },
      reportId: "report-1",
      shopHandle: "demo-shop",
    });
    expect(result).toEqual({
      ok: true,
      route: "shopline-editor",
      before: "Short",
      after: "A polished SHOPLINE meta description.",
    });
  });

  it("uses the site logo before the first content image for missing og:image", async () => {
    const testDeps = deps({
      shoplineUpdate: vi.fn(async () => ({
        productId: "product-1",
        image: {
          id: "logo-image",
          alt: "https://cdn.myshopline.com/demo/logo.png",
        },
      })),
    });
    const testIssue = issue({
      ruleId: "og.image.missing",
      selector: 'meta[property="og:image"]',
      current: "",
      suggested: JSON.stringify({
        siteLogo: "https://cdn.myshopline.com/demo/logo.png",
        firstContentImage: "https://cdn.myshopline.com/demo/hero.png",
      }),
    });

    const result = await applyAuditFixToShopline(
      {
        issue: testIssue,
        reportId: "report-1",
        shopHandle: "demo-shop",
      },
      testDeps,
    );

    expect(testDeps.generateMetaDescription).not.toHaveBeenCalled();
    expect(testDeps.generateImageAlt).not.toHaveBeenCalled();
    expect(testDeps.shoplineUpdate).toHaveBeenCalledWith({
      issue: {
        ...testIssue,
        suggested: "https://cdn.myshopline.com/demo/logo.png",
      },
      reportId: "report-1",
      shopHandle: "demo-shop",
    });
    expect(result).toEqual({
      ok: true,
      route: "shopline-editor",
      before: "",
      after: "https://cdn.myshopline.com/demo/logo.png",
    });
  });
});
