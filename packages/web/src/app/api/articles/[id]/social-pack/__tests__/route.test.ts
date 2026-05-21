import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) =>
      async (request: Request, ...args: unknown[]) =>
        handler(
          request,
          {
            authMode: "company",
            companyId: "company-1",
            user: { id: "user-1" },
            supabase: supabaseState.client,
          },
          ...args,
        ),
  ),
}));

const supabaseState = vi.hoisted(() => ({
  article: {
    id: "article-1",
    title: "Manual Posting Wins",
    excerpt: "Manual packs keep social publishing moving.",
    seo_description: "SEO description fallback",
    og_description: null,
    html_content: "<h1>Manual Posting Wins</h1><p>Body</p>",
    slug: "manual-posting-wins",
    wordpress_post_url: null,
    website_configs: {
      site_url: "https://example.com/blog",
    },
  } as Record<string, unknown> | null,
  assets: [
    {
      id: "asset-1",
      template: "quote",
      size: "ig_square",
      r2_url: "https://cdn.example.com/cards/article-1/quote_ig_square.png",
      created_at: "2026-05-21T01:00:00.000Z",
    },
    {
      id: "asset-2",
      template: "quote",
      size: "ig_story",
      r2_url: "https://cdn.example.com/cards/article-1/quote_ig_story.png",
      created_at: "2026-05-21T01:01:00.000Z",
    },
    {
      id: "asset-3",
      template: "quote",
      size: "og",
      r2_url: "https://cdn.example.com/cards/article-1/quote_og.png",
      created_at: "2026-05-21T01:02:00.000Z",
    },
  ] as Array<Record<string, unknown>>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  client: {
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          supabaseState.calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          supabaseState.calls.push({ table, method: "eq", args });
          return builder;
        },
        order(...args: unknown[]) {
          supabaseState.calls.push({ table, method: "order", args });
          return Promise.resolve({
            data: table === "article_assets" ? supabaseState.assets : [],
            error: null,
          });
        },
        single() {
          supabaseState.calls.push({ table, method: "single", args: [] });
          return Promise.resolve({
            data: table === "generated_articles" ? supabaseState.article : null,
            error: supabaseState.article ? null : { message: "not found" },
          });
        },
      };

      return builder;
    },
  },
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

function routeContext(id = "article-1") {
  return {
    params: Promise.resolve({ id }),
  };
}

async function zipText(zip: JSZip, fileName: string) {
  const file = zip.file(fileName);
  expect(file).toBeTruthy();
  return await file!.async("string");
}

describe("GET /api/articles/[id]/social-pack", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    supabaseState.article = {
      id: "article-1",
      title: "Manual Posting Wins",
      excerpt: "Manual packs keep social publishing moving.",
      seo_description: "SEO description fallback",
      og_description: null,
      html_content: "<h1>Manual Posting Wins</h1><p>Body</p>",
      slug: "manual-posting-wins",
      wordpress_post_url: null,
      website_configs: {
        site_url: "https://example.com/blog",
      },
    };
    supabaseState.assets = [
      {
        id: "asset-1",
        template: "quote",
        size: "ig_square",
        r2_url: "https://cdn.example.com/cards/article-1/quote_ig_square.png",
        created_at: "2026-05-21T01:00:00.000Z",
      },
      {
        id: "asset-2",
        template: "quote",
        size: "ig_story",
        r2_url: "https://cdn.example.com/cards/article-1/quote_ig_story.png",
        created_at: "2026-05-21T01:01:00.000Z",
      },
      {
        id: "asset-3",
        template: "quote",
        size: "og",
        r2_url: "https://cdn.example.com/cards/article-1/quote_og.png",
        created_at: "2026-05-21T01:02:00.000Z",
      },
    ];
    supabaseState.calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = new TextEncoder().encode(`image bytes for ${url}`);
        return new Response(body, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }),
    );
  });

  it("returns a ZIP containing card files, manifest, caption, and deep links", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://app.example.com/api/articles/article-1/social-pack",
      ) as never,
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(response.headers.get("content-disposition")).toContain("attachment");

    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const fileNames = Object.keys(zip.files);

    expect(fileNames).toEqual(
      expect.arrayContaining([
        "cards/quote_ig_square.png",
        "cards/quote_ig_story.png",
        "cards/quote_og.png",
        "manifest.txt",
        "caption.txt",
        "deep-links.txt",
      ]),
    );

    const manifest = await zipText(zip, "manifest.txt");
    expect(manifest).toContain("quote_ig_square.png");
    expect(manifest).toContain("IG feed");
    expect(manifest).toContain(
      "https://cdn.example.com/cards/article-1/quote_ig_square.png",
    );
    expect(manifest).toContain(
      "https://cdn.example.com/cards/article-1/quote_ig_story.png",
    );
    expect(manifest).toContain(
      "https://cdn.example.com/cards/article-1/quote_og.png",
    );

    await expect(zipText(zip, "caption.txt")).resolves.toContain(
      "Manual Posting Wins",
    );
    await expect(zipText(zip, "caption.txt")).resolves.toContain(
      "Manual packs keep social publishing moving.",
    );

    const deepLinks = await zipText(zip, "deep-links.txt");
    expect(deepLinks).toContain("IG: instagram://camera");
    expect(deepLinks).toContain(
      "Threads: https://www.threads.net/intent/post?text=Manual%20Posting%20Wins",
    );
    expect(deepLinks).toContain(
      "X: https://twitter.com/intent/tweet?text=Manual%20Posting%20Wins",
    );
    expect(deepLinks).toContain(
      "FB: https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.com%2Fblog%2Fmanual-posting-wins",
    );

    expect(supabaseState.calls).toContainEqual({
      table: "generated_articles",
      method: "eq",
      args: ["company_id", "company-1"],
    });
  });

  it("returns 404 for a cross-company article", async () => {
    supabaseState.article = null;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://app.example.com/api/articles/article-2/social-pack",
      ) as never,
      routeContext("article-2"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
