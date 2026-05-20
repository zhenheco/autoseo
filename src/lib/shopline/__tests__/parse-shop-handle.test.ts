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
});
