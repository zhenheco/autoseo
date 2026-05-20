import { describe, expect, it, vi } from "vitest";
import { parseShoplineShopHandleFromUrl } from "../parse-shop-handle";

function mockFetch(html: string): typeof fetch {
  return vi.fn(async () => new Response(html)) as unknown as typeof fetch;
}

describe("parseShoplineShopHandleFromUrl", () => {
  it("matches the primary handle pattern", async () => {
    await expect(
      parseShoplineShopHandleFromUrl("https://newweb.renoirpuzzle.com.tw/", {
        fetch: mockFetch("window.Shopline = { handle: 'renoir199063' };"),
      }),
    ).resolves.toBe("renoir199063");
  });

  it("matches the shop_handle fallback pattern", async () => {
    await expect(
      parseShoplineShopHandleFromUrl("https://brand.example.com/", {
        fetch: mockFetch('{"shop_handle":"brand-shop"}'),
      }),
    ).resolves.toBe("brand-shop");
  });

  it("matches the myshopline domain fallback and skips cdn", async () => {
    await expect(
      parseShoplineShopHandleFromUrl("https://brand.example.com/", {
        fetch: mockFetch(
          "https://cdn.myshopline.com/x.js https://brand.myshopline.com/foo",
        ),
      }),
    ).resolves.toBe("brand");
  });

  it("throws when no pattern matches", async () => {
    await expect(
      parseShoplineShopHandleFromUrl("https://example.com/", {
        fetch: mockFetch("<html><body>No SHOPLINE markers</body></html>"),
      }),
    ).rejects.toThrow("shopline_shop_handle_parse_failed");
  });

  it("throws when fetch fails", async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;

    await expect(
      parseShoplineShopHandleFromUrl("https://example.com/", {
        fetch: failingFetch,
      }),
    ).rejects.toThrow("shopline_shop_handle_parse_failed");
  });
});
