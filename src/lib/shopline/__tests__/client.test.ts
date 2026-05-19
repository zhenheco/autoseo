import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineClient } from "../client";
import {
  ShoplineAuthError,
  ShoplineCollectionSchema,
  ShoplineRateLimitError,
} from "../types";

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

  it("parses collections and exposes cursor pagination", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Link: '<https://demo-shop.myshopline.com/admin/openapi/v20260301/products/collections.json?page_info=collection-next>; rel="next"',
      }),
      json: async () => ({
        collections: [
          {
            id: 101,
            title: "Summer Collection",
            handle: "summer",
            body_html: null,
            seo: { title: "Summer SEO" },
            image: {
              id: "image-1",
              src: "https://img.myshopline.com/collection.jpg",
              alt: null,
            },
            products_count: 12,
            published_at: null,
            updated_at: "2026-05-19T00:00:00Z",
          },
        ],
      }),
    });

    const parsed = ShoplineCollectionSchema.parse({
      id: 101,
      title: "Summer Collection",
      handle: "summer",
      body_html: null,
    });
    const result = await client().listCollections({
      pageInfo: "collection-cursor",
      limit: 25,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(parsed.body_html).toBe("");
    expect(url).toMatch(/\/products\/collections\.json\?/);
    expect(url).toContain("page_info=collection-cursor");
    expect(url).toContain("limit=25");
    expect(result.collections).toEqual([
      expect.objectContaining({
        id: "101",
        title: "Summer Collection",
        handle: "summer",
        body_html: "",
        products_count: 12,
        seo: { title: "Summer SEO" },
      }),
    ]);
    expect(result.next?.pageInfo).toBe("collection-next");
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

  it("updates product SEO via PUT with seo title/description and handle", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        product: {
          id: "42",
          title: "P",
          handle: "new-handle",
          status: "active",
          images: [],
          variants: [],
          created_at: "2026-05-01T00:00:00Z",
          updated_at: "2026-05-01T00:00:00Z",
          seo: { title: "New SEO Title", description: "New SEO Desc" },
        },
      }),
    });

    const updated = await client().updateProduct("42", {
      seo: { title: "New SEO Title", description: "New SEO Desc" },
      handle: "new-handle",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/admin\/openapi\/v20260301\/products\/products\/42\.json$/,
    );
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.product.seo.title).toBe("New SEO Title");
    expect(body.product.seo.description).toBe("New SEO Desc");
    expect(body.product.handle).toBe("new-handle");
    expect(updated.handle).toBe("new-handle");
    expect(updated.seo?.title).toBe("New SEO Title");
  });

  it("rejects updateProduct when no SEO fields supplied", async () => {
    await expect(client().updateProduct("42", {})).rejects.toThrow(
      /shopline_update_product_no_fields/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates collection SEO via PUT with seo, handle, and title", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        collection: {
          id: "collection-1",
          title: "New Collection Title",
          handle: "new-collection",
          body_html: "",
          seo: { title: "New SEO Title", description: "New SEO Desc" },
          updated_at: "2026-05-19T00:00:00Z",
        },
      }),
    });

    const updated = await client().updateCollection("collection-1", {
      seo: { title: "New SEO Title", description: "New SEO Desc" },
      handle: "new-collection",
      title: "New Collection Title",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/admin\/openapi\/v20260301\/products\/collections\/collection-1\.json$/,
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      collection: {
        id: "collection-1",
        seo: { title: "New SEO Title", description: "New SEO Desc" },
        handle: "new-collection",
        title: "New Collection Title",
      },
    });
    expect(updated).toMatchObject({
      id: "collection-1",
      title: "New Collection Title",
      handle: "new-collection",
      seo: { title: "New SEO Title", description: "New SEO Desc" },
    });
  });

  it("rejects updateCollection when no fields are supplied", async () => {
    await expect(client().updateCollection("collection-1", {})).rejects.toThrow(
      /shopline_update_collection_no_fields/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects updateCollection with invalid collection ids", async () => {
    await expect(
      client().updateCollection("invalid/id", { title: "Collection" }),
    ).rejects.toThrow(/invalid_shopline_collection_id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates product image alt via PUT and parses the returned image", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        image: {
          id: "image_1",
          src: "https://img.myshopline.com/example.jpg",
          alt: "Updated alt",
          position: 1,
        },
      }),
    });

    const updated = await client().updateProductImage("42", "image_1", {
      alt: "Updated alt",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/admin\/openapi\/v20260301\/products\/products\/42\/images\/image_1\.json$/,
    );
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      image: { id: "image_1", alt: "Updated alt" },
    });
    expect(updated).toEqual({
      id: "image_1",
      src: "https://img.myshopline.com/example.jpg",
      alt: "Updated alt",
      position: 1,
    });
  });

  it("rejects updateProductImage for invalid product or image ids", async () => {
    await expect(
      client().updateProductImage("invalid/id", "image_1", { alt: "Alt" }),
    ).rejects.toThrow(/invalid_shopline_product_id/);
    await expect(
      client().updateProductImage("42", "invalid/id", { alt: "Alt" }),
    ).rejects.toThrow(/invalid_shopline_image_id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects updateProductImage when alt is undefined", async () => {
    await expect(
      client().updateProductImage("42", "image_1", { alt: undefined }),
    ).rejects.toThrow(/shopline_update_image_no_fields/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists product collects and parses ids as strings", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        collects: [
          {
            id: 1001,
            collection_id: "collection_1",
            product_id: 42,
            extra: "kept by passthrough",
          },
        ],
      }),
    });

    const result = await client().listProductCollects("42");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/admin\/openapi\/v20260301\/products\/collects\.json\?product_id=42$/,
    );
    expect(result.collects).toEqual([
      expect.objectContaining({
        id: "1001",
        collection_id: "collection_1",
        product_id: "42",
      }),
    ]);
  });

  it("assigns a product to a collection via POST", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({
        collect: {
          id: "collect_1",
          collection_id: "collection_1",
          product_id: "product_1",
        },
      }),
    });

    const result = await client().assignProductToCollection(
      "product_1",
      "collection_1",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/admin\/openapi\/v20260301\/products\/collects\.json$/,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      collect: { collection_id: "collection_1", product_id: "product_1" },
    });
    expect(result).toEqual({
      id: "collect_1",
      collection_id: "collection_1",
      product_id: "product_1",
    });
  });

  it("removes a product collect via DELETE and accepts 204 or 200", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
      });

    await expect(
      client().removeProductFromCollection("collect_1"),
    ).resolves.toBeUndefined();
    await expect(
      client().removeProductFromCollection("collect_2"),
    ).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/admin\/openapi\/v20260301\/products\/collects\/collect_1\.json$/,
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[1][0]).toMatch(
      /\/admin\/openapi\/v20260301\/products\/collects\/collect_2\.json$/,
    );
  });

  it("rejects collect operations with invalid ids", async () => {
    await expect(client().listProductCollects("invalid/id")).rejects.toThrow(
      /invalid_shopline_product_id/,
    );
    await expect(
      client().assignProductToCollection("product_1", "invalid/id"),
    ).rejects.toThrow(/invalid_shopline_collection_id/);
    await expect(
      client().assignProductToCollection("invalid/id", "collection_1"),
    ).rejects.toThrow(/invalid_shopline_product_id/);
    await expect(
      client().removeProductFromCollection("invalid/id"),
    ).rejects.toThrow(/invalid_shopline_collect_id/);
    expect(fetchMock).not.toHaveBeenCalled();
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
