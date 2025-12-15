/**
 * On-Demand ISR Revalidation API
 *
 * 用於手動清除特定頁面的 ISR 快取
 *
 * 使用方式：
 * GET /api/revalidate?path=/blog/article-slug&secret=xxx
 *
 * 也可以一次清除多個路徑：
 * GET /api/revalidate?path=/blog&path=/blog/article-slug&secret=xxx
 */

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  // 驗證 secret
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  // 取得所有 path 參數
  const paths = request.nextUrl.searchParams.getAll("path");

  if (paths.length === 0) {
    return NextResponse.json(
      { error: "No path provided. Use ?path=/your-path&secret=xxx" },
      { status: 400 },
    );
  }

  // 清除每個路徑的快取
  const results: { path: string; revalidated: boolean }[] = [];

  for (const path of paths) {
    try {
      revalidatePath(path);
      results.push({ path, revalidated: true });
    } catch (error) {
      console.error(`Failed to revalidate ${path}:`, error);
      results.push({ path, revalidated: false });
    }
  }

  return NextResponse.json({
    revalidated: results.every((r) => r.revalidated),
    results,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST 方法：接受 JSON body
 *
 * POST /api/revalidate
 * Body: { "secret": "xxx", "paths": ["/blog", "/blog/article-slug"] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, paths } = body as { secret?: string; paths?: string[] };

    // 驗證 secret
    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: "No paths provided. Send { paths: ['/your-path'] }" },
        { status: 400 },
      );
    }

    // 清除每個路徑的快取
    const results: { path: string; revalidated: boolean }[] = [];

    for (const path of paths) {
      try {
        revalidatePath(path);
        results.push({ path, revalidated: true });
      } catch (error) {
        console.error(`Failed to revalidate ${path}:`, error);
        results.push({ path, revalidated: false });
      }
    }

    return NextResponse.json({
      revalidated: results.every((r) => r.revalidated),
      results,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
