/**
 * Sitemap Revalidate API
 * 路由: POST /api/sitemap/revalidate
 *
 * 用於觸發 sitemap 即時更新和搜尋引擎 ping
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pingAllSearchEngines } from "@/lib/sitemap/ping-service";

// 定義可 revalidate 的 sitemap 類型
type SitemapType = "post" | "category" | "tag" | "page" | "index";

// Sitemap 路徑對應
const SITEMAP_PATHS: Record<SitemapType, string> = {
  post: "/post-sitemap.xml",
  category: "/category-sitemap.xml",
  tag: "/tag-sitemap.xml",
  page: "/page-sitemap.xml",
  index: "/sitemap.xml",
};

/**
 * POST /api/sitemap/revalidate
 *
 * Body:
 * - sitemaps?: SitemapType[] - 要 revalidate 的 sitemap（預設全部）
 * - ping?: boolean - 是否 ping 搜尋引擎（預設 true）
 *
 * Headers:
 * - x-revalidate-secret: 驗證 token
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證 secret
    const secret = request.headers.get("x-revalidate-secret");
    const expectedSecret = process.env.REVALIDATE_SECRET?.trim();

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    // 解析請求內容
    const body = await request.json().catch(() => ({}));
    const sitemapsToRevalidate: SitemapType[] = body.sitemaps || [
      "post",
      "category",
      "tag",
      "index",
    ];
    const shouldPing = body.ping !== false;

    // Revalidate 指定的 sitemap
    const revalidated: string[] = [];
    for (const type of sitemapsToRevalidate) {
      const path = SITEMAP_PATHS[type];
      if (path) {
        revalidatePath(path);
        revalidated.push(path);
        console.log(`[Sitemap Revalidate] Revalidated: ${path}`);
      }
    }

    // Ping 搜尋引擎
    let pingResults: { service: string; success: boolean }[] = [];
    if (shouldPing) {
      const results = await pingAllSearchEngines();
      pingResults = results.map((r) => ({
        service: r.service,
        success: r.success,
      }));
    }

    return NextResponse.json({
      success: true,
      revalidated,
      pingResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Sitemap Revalidate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * 方便其他模組調用的 helper 函數
 * 在文章發布後調用此函數來 revalidate sitemap
 */
export async function revalidateSitemaps(options?: {
  sitemaps?: SitemapType[];
  ping?: boolean;
}): Promise<void> {
  const sitemapsToRevalidate = options?.sitemaps || [
    "post",
    "category",
    "tag",
    "index",
  ];

  // Revalidate
  for (const type of sitemapsToRevalidate) {
    const path = SITEMAP_PATHS[type];
    if (path) {
      revalidatePath(path);
      console.log(`[Sitemap Revalidate] Revalidated: ${path}`);
    }
  }

  // Ping（如果啟用）
  if (options?.ping !== false) {
    await pingAllSearchEngines();
  }
}
