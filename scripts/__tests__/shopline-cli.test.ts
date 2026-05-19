import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seoUpdate } from "../shopline-cli";

const { updateShoplineProductSeo } = vi.hoisted(() => ({
  updateShoplineProductSeo: vi.fn(),
}));

vi.mock("../../src/lib/shopline/seo-updater", () => ({
  updateShoplineProductSeo,
}));

describe("shopline-cli seo-update", () => {
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    updateShoplineProductSeo.mockReset();
    vi.spyOn(console, "log").mockImplementation((message: string) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the output format while updating through the shared deep module", async () => {
    updateShoplineProductSeo.mockResolvedValueOnce({
      id: "product_1",
      title: "Product 1",
      handle: "product-1",
      product_type: "",
      vendor: "",
      status: "active",
      tags: "",
      images: [],
      variants: [],
      created_at: "2026-05-19T00:00:00.000Z",
      updated_at: "2026-05-19T00:00:00.000Z",
      seo: {
        title: "New SEO title",
        description: "Description",
      },
    });

    await seoUpdate({
      "product-id": "product_1",
      "seo-title": "New SEO title",
      "seo-description": "Description",
      "shop-handle": "demo-shop",
      "access-token": "token-123",
    });

    expect(updateShoplineProductSeo).toHaveBeenCalledWith(
      "cli",
      "cli",
      "product_1",
      {
        seo: {
          title: "New SEO title",
          description: "Description",
        },
        handle: undefined,
        source: "cli",
      },
      expect.objectContaining({
        store: expect.any(Object),
      }),
    );
    expect(logs).toEqual([
      "shopline_seo_update=pass",
      "product_id=product_1",
      "handle=product-1",
      "seo_title=New SEO title",
      "seo_description_len=11",
    ]);
  });
});
