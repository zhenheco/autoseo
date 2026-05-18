import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineClient } from "../client";
import { ShoplineAuthError, ShoplineRateLimitError } from "../types";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function client(): ShoplineClient {
  return new ShoplineClient({
    shopHandle: "demo-shop",
    accessToken: "tok",
    retryDelaysMs: [1, 1, 1],
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("ShoplineClient", () => {
  it("sends bearer auth to the Admin REST API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({ products: [] }),
    });

    await client().listProducts();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /^https:\/\/demo-shop\.myshopline\.com\/admin\/openapi\/v20260301\/products\/products\.json/,
    );
    expect(init.headers["X-Shopline-Access-Token"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Content-Type"]).toBe(
      "application/json; charset=utf-8",
    );
  });

  it("parses products and skips malformed items", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        products: [
          {
            id: 1,
            title: "P1",
            handle: "p1",
            status: "active",
            images: [],
            variants: [],
            created_at: "2026-05-01T00:00:00Z",
            updated_at: "2026-05-01T00:00:00Z",
          },
          { malformed: true },
        ],
      }),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await client().listProducts();

    expect(res.products).toHaveLength(1);
    expect(res.products[0].title).toBe("P1");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("accepts real SHOPLINE product payload shapes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        products: [
          {
            id: "900000000000001",
            title: "Real API Product",
            handle: "real-api-product",
            product_type: null,
            vendor: null,
            status: "active",
            tags: null,
            images: [
              {
                id: "800000000000001",
                src: "https://img.myshopline.com/example.jpg",
                alt: null,
                position: 1,
              },
            ],
            variants: [],
            created_at: "2026-05-01T00:00:00Z",
            updated_at: "2026-05-01T00:00:00Z",
          },
        ],
      }),
    });

    const res = await client().listProducts();

    expect(res.products).toHaveLength(1);
    expect(res.products[0]).toMatchObject({
      id: "900000000000001",
      vendor: "",
      tags: "",
      product_type: "",
    });
    expect(res.products[0].images[0].id).toBe("800000000000001");
  });

  it("uses cursor pagination when pageInfo is provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Link: '<https://demo-shop.myshopline.com/admin/api/2024-04/products.json?page_info=next-token>; rel="next"',
      }),
      json: async () => ({ products: [] }),
    });

    const res = await client().listProducts({
      page: 2,
      pageInfo: "cursor-token",
      limit: 25,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("page_info=cursor-token");
    expect(url).toContain("limit=25");
    expect(url).not.toContain("page=2");
    expect(res.next?.pageInfo).toBe("next-token");
  });

  it("throws a dedicated auth error for 401 responses", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    await expect(client().listProducts()).rejects.toBeInstanceOf(
      ShoplineAuthError,
    );
  });

  it("retries rate limits and throws a dedicated rate limit error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "1" }),
    });

    await expect(client().listProducts()).rejects.toBeInstanceOf(
      ShoplineRateLimitError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("reads sitemap URLs for CLI discovery checks", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => `<?xml version="1.0"?><sitemapindex>
        <sitemap><sitemap:loc>https://demo-shop.myshopline.com/sitemap_products_1.xml</sitemap:loc></sitemap>
        <sitemap><loc>https://demo-shop.myshopline.com/sitemap_collections.xml</loc></sitemap>
      </sitemapindex>`,
    });

    await expect(client().getSitemapUrls()).resolves.toEqual([
      "https://demo-shop.myshopline.com/sitemap_products_1.xml",
      "https://demo-shop.myshopline.com/sitemap_collections.xml",
    ]);
  });
});
