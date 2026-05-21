import { NextRequest, NextResponse } from "next/server";

/**
 * 地理位置檢測 API
 * 使用 Vercel Edge Functions 或 Cloudflare Workers 的地理位置資訊
 */
export async function GET(request: NextRequest) {
  try {
    // 嘗試從 Vercel 的地理位置標頭取得資訊
    const country =
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry");

    const city =
      request.headers.get("x-vercel-ip-city") ||
      request.headers.get("cf-ipcity");

    const region =
      request.headers.get("x-vercel-ip-country-region") ||
      request.headers.get("cf-region");

    // 如果沒有檢測到地理位置，嘗試使用 IP 檢測服務
    if (!country) {
      const clientIP =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip");

      // 返回基本資訊，不進行額外的 IP 查詢以避免延遲
      return NextResponse.json({
        country: null,
        city: null,
        region: null,
        ip: clientIP,
        source: "unknown",
      });
    }

    return NextResponse.json({
      country: country.toUpperCase(),
      city: city || null,
      region: region || null,
      source: request.headers.get("x-vercel-ip-country")
        ? "vercel"
        : "cloudflare",
    });
  } catch (error) {
    console.error("[Geo API] Error detecting location:", error);

    return NextResponse.json(
      {
        error: "Failed to detect location",
        country: null,
        city: null,
        region: null,
      },
      { status: 500 },
    );
  }
}

// 支援 Edge Runtime 以提升效能
export const runtime = "edge";
