/**
 * Sitemap Ping API
 * 路由: POST /api/sitemap/ping
 *
 * 手動觸發 Google/Bing sitemap ping
 */

import { NextRequest, NextResponse } from "next/server";
import {
  pingAllSearchEngines,
  getAllSitemapUrls,
} from "@/lib/sitemap/ping-service";

/**
 * POST /api/sitemap/ping
 *
 * Body:
 * - sitemapUrl?: string - 指定要 ping 的 sitemap URL（預設為主 sitemap）
 * - all?: boolean - 是否 ping 所有 sitemap
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
    const sitemapUrl = body.sitemapUrl;
    const pingAll = body.all === true;

    let results;

    if (pingAll) {
      // Ping 所有 sitemap
      const allUrls = getAllSitemapUrls();
      results = [];
      for (const url of allUrls) {
        const pingResult = await pingAllSearchEngines(url);
        results.push({
          url,
          results: pingResult.map((r) => ({
            service: r.service,
            success: r.success,
            status: r.status,
            error: r.error,
          })),
        });
      }
    } else {
      // Ping 單一 sitemap
      const targetUrl = sitemapUrl || "https://1wayseo.com/sitemap.xml";
      const pingResult = await pingAllSearchEngines(targetUrl);
      results = [
        {
          url: targetUrl,
          results: pingResult.map((r) => ({
            service: r.service,
            success: r.success,
            status: r.status,
            error: r.error,
          })),
        },
      ];
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Sitemap Ping] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/sitemap/ping
 * 返回可用的 sitemap URL 列表
 */
export async function GET(request: NextRequest) {
  // 驗證 secret
  const secret = request.headers.get("x-revalidate-secret");
  const expectedSecret = process.env.REVALIDATE_SECRET?.trim();

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const sitemapUrls = getAllSitemapUrls();

  return NextResponse.json({
    sitemapUrls,
    pingEnabled:
      process.env.SITEMAP_PING_ENABLED?.toLowerCase().trim() === "true",
  });
}
