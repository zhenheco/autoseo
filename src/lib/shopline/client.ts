import {
  ShoplineAuthError,
  ShoplineCollectSchema,
  ShoplineImageSchema,
  ShoplineProductSchema,
  ShoplineRateLimitError,
  ShoplineShopSchema,
} from "./types";
import type {
  ShoplineCollect,
  ShoplineImage,
  ShoplineProduct,
  ShoplineShop,
} from "./types";

export const SHOPLINE_ADMIN_API_VERSION = "v20260301";

function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.random() * baseMs * 0.5;
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

export interface ShoplineClientOptions {
  shopHandle: string;
  accessToken: string;
  retryDelaysMs?: number[];
}

function assertShoplineId(
  value: string,
  errorCode:
    | "invalid_shopline_product_id"
    | "invalid_shopline_collection_id"
    | "invalid_shopline_collect_id"
    | "invalid_shopline_image_id",
): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(errorCode);
  }
}

export class ShoplineClient {
  private readonly shopHandle: string;
  private readonly accessToken: string;
  private readonly retryDelaysMs: number[];

  constructor(opts: ShoplineClientOptions) {
    if (!/^[a-zA-Z0-9-]+$/.test(opts.shopHandle)) {
      throw new Error("invalid_shopline_shop_handle");
    }
    if (!opts.accessToken) {
      throw new Error("SHOPLINE access token is required");
    }

    this.shopHandle = opts.shopHandle;
    this.accessToken = opts.accessToken;
    this.retryDelaysMs = opts.retryDelaysMs ?? [200, 500, 1000];
  }

  private baseUrl(): string {
    return `https://${this.shopHandle}.myshopline.com/admin/openapi/${SHOPLINE_ADMIN_API_VERSION}`;
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl()}${path}`;
    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      let resp: Response;

      try {
        resp = await fetch(url, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json; charset=utf-8",
            ...(init?.headers ?? {}),
          },
        });
      } catch (err) {
        lastErr = err;
        if (attempt < this.retryDelaysMs.length) {
          await sleepWithJitter(this.retryDelaysMs[attempt]);
          continue;
        }
        throw err;
      }

      if (resp.status === 429) {
        if (attempt < this.retryDelaysMs.length) {
          await sleepWithJitter(this.retryDelaysMs[attempt]);
          continue;
        }

        const retryAfter = Number(resp.headers.get("Retry-After")) || undefined;
        throw new ShoplineRateLimitError(retryAfter);
      }

      if (
        [502, 503, 504].includes(resp.status) &&
        attempt < this.retryDelaysMs.length
      ) {
        await sleepWithJitter(this.retryDelaysMs[attempt]);
        continue;
      }

      if (resp.status === 401 || resp.status === 403) {
        throw new ShoplineAuthError();
      }

      return resp;
    }

    throw lastErr ?? new Error("shopline_fetch_unknown_failure");
  }

  private parseNextPage(
    linkHeader: string | null,
  ): { page?: number; pageInfo?: string } | undefined {
    if (!linkHeader) return undefined;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!match) return undefined;

    try {
      const url = new URL(match[1]);
      const pageInfo = url.searchParams.get("page_info") ?? undefined;
      const pageStr = url.searchParams.get("page");
      const page = pageStr ? Number(pageStr) : undefined;
      if (pageInfo) return { pageInfo };
      if (page !== undefined && !Number.isNaN(page)) return { page };
    } catch {
      return undefined;
    }

    return undefined;
  }

  async getShop(): Promise<ShoplineShop> {
    const resp = await this.fetch("/shop.json");
    if (!resp.ok) throw new Error(`shopline_get_shop_failed: ${resp.status}`);

    const data = (await resp.json()) as { shop: unknown };
    return ShoplineShopSchema.parse(data.shop);
  }

  async listProducts(params?: {
    page?: number;
    pageInfo?: string;
    limit?: number;
  }): Promise<{
    products: ShoplineProduct[];
    next?: { page?: number; pageInfo?: string };
  }> {
    const qs = new URLSearchParams();
    if (params?.pageInfo) qs.set("page_info", params.pageInfo);
    else if (params?.page) qs.set("page", String(params.page));
    qs.set("limit", String(params?.limit ?? 50));

    const resp = await this.fetch(`/products/products.json?${qs.toString()}`);
    if (!resp.ok)
      throw new Error(`shopline_list_products_failed: ${resp.status}`);

    const data = (await resp.json()) as { products?: unknown[] };
    const products = (data.products ?? []).flatMap((product) => {
      const parsed = ShoplineProductSchema.safeParse(product);
      if (!parsed.success) {
        console.warn(
          "[shopline] skipping product with invalid schema:",
          parsed.error.flatten(),
        );
        return [];
      }
      return [parsed.data];
    });

    return {
      products,
      next: this.parseNextPage(resp.headers.get("Link")),
    };
  }

  async getProduct(productId: string): Promise<ShoplineProduct> {
    assertShoplineId(productId, "invalid_shopline_product_id");

    const resp = await this.fetch(`/products/products/${productId}.json`);
    if (!resp.ok) {
      throw new Error(`shopline_get_product_failed: ${resp.status}`);
    }

    const data = (await resp.json()) as { product: unknown };
    return ShoplineProductSchema.parse(data.product);
  }

  async updateProduct(
    productId: string,
    payload: {
      seo?: { title?: string; description?: string };
      handle?: string;
      title?: string;
    },
  ): Promise<ShoplineProduct> {
    assertShoplineId(productId, "invalid_shopline_product_id");

    const productPatch: Record<string, unknown> = {};
    if (payload.seo) {
      const seo: Record<string, string> = {};
      if (typeof payload.seo.title === "string") seo.title = payload.seo.title;
      if (typeof payload.seo.description === "string")
        seo.description = payload.seo.description;
      if (Object.keys(seo).length > 0) productPatch.seo = seo;
    }
    if (typeof payload.handle === "string")
      productPatch.handle = payload.handle;
    if (typeof payload.title === "string") productPatch.title = payload.title;

    if (Object.keys(productPatch).length === 0) {
      throw new Error("shopline_update_product_no_fields");
    }

    const resp = await this.fetch(`/products/products/${productId}.json`, {
      method: "PUT",
      body: JSON.stringify({ product: { id: productId, ...productPatch } }),
    });
    if (!resp.ok) {
      throw new Error(`shopline_update_product_failed: ${resp.status}`);
    }

    const data = (await resp.json()) as { product: unknown };
    return ShoplineProductSchema.parse(data.product);
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    payload: { alt?: string },
  ): Promise<ShoplineImage> {
    assertShoplineId(productId, "invalid_shopline_product_id");
    assertShoplineId(imageId, "invalid_shopline_image_id");
    if (typeof payload.alt !== "string") {
      throw new Error("shopline_update_image_no_fields");
    }

    const resp = await this.fetch(
      `/products/products/${productId}/images/${imageId}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ image: { id: imageId, alt: payload.alt } }),
      },
    );
    if (!resp.ok) {
      throw new Error(`shopline_update_image_failed: ${resp.status}`);
    }

    const data = (await resp.json()) as { image: unknown };
    return ShoplineImageSchema.parse(data.image);
  }

  async listProductCollects(
    productId: string,
  ): Promise<{ collects: ShoplineCollect[] }> {
    assertShoplineId(productId, "invalid_shopline_product_id");

    const qs = new URLSearchParams({ product_id: productId });
    const resp = await this.fetch(`/products/collects.json?${qs.toString()}`);
    if (!resp.ok) {
      throw new Error(`shopline_list_product_collects_failed: ${resp.status}`);
    }

    const data = (await resp.json()) as { collects?: unknown[] };
    return {
      collects: (data.collects ?? []).map((collect) =>
        ShoplineCollectSchema.parse(collect),
      ),
    };
  }

  async assignProductToCollection(
    productId: string,
    collectionId: string,
  ): Promise<ShoplineCollect> {
    assertShoplineId(productId, "invalid_shopline_product_id");
    assertShoplineId(collectionId, "invalid_shopline_collection_id");

    const resp = await this.fetch("/products/collects.json", {
      method: "POST",
      body: JSON.stringify({
        collect: {
          collection_id: collectionId,
          product_id: productId,
        },
      }),
    });
    if (!resp.ok) {
      throw new Error(
        `shopline_assign_product_collection_failed: ${resp.status}`,
      );
    }

    const data = (await resp.json()) as { collect: unknown };
    return ShoplineCollectSchema.parse(data.collect);
  }

  async removeProductFromCollection(collectId: string): Promise<void> {
    assertShoplineId(collectId, "invalid_shopline_collect_id");

    const resp = await this.fetch(`/products/collects/${collectId}.json`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      throw new Error(
        `shopline_remove_product_collection_failed: ${resp.status}`,
      );
    }
  }

  async getSitemapUrls(): Promise<string[]> {
    const resp = await fetch(
      `https://${this.shopHandle}.myshopline.com/sitemap.xml`,
    );
    if (!resp.ok) return [];

    const xml = await resp.text();
    return Array.from(
      xml.matchAll(/<(?:\w+:)?loc>([^<]+)<\/(?:\w+:)?loc>/g),
    ).map((match) => match[1]);
  }
}
