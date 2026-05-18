import {
  ShoplineAuthError,
  ShoplineProductSchema,
  ShoplineRateLimitError,
  ShoplineShopSchema,
} from "./types";
import type { ShoplineProduct, ShoplineShop } from "./types";

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
