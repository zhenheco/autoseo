import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callGoogleApi,
  getWebsiteOAuthToken,
} from "@/lib/analytics/google-api-client";
import type { GA4Property } from "@/types/google-analytics.types";

const GA4_ADMIN_API_BASE = "https://analyticsadmin.googleapis.com/v1beta";

interface GA4AccountsResponse {
  accounts?: Array<{
    name: string;
    displayName: string;
  }>;
}

interface GA4PropertiesResponse {
  properties?: GA4Property[];
}

/**
 * GET /api/analytics/ga4/properties
 * 列出用戶在 Google Analytics 4 中的 Property
 *
 * Query Parameters:
 * - website_id: 網站 ID（用於取得 OAuth token）
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const websiteId = searchParams.get("website_id");

    if (!websiteId) {
      return NextResponse.json(
        { error: "缺少 website_id 參數" },
        { status: 400 },
      );
    }

    // 取得 OAuth token
    const tokenRecord = await getWebsiteOAuthToken(websiteId, "ga4");

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "尚未連接 Google Analytics 4" },
        { status: 400 },
      );
    }

    // 先取得所有帳戶
    const { data: accountsData, error: accountsError } =
      await callGoogleApi<GA4AccountsResponse>(
        `${GA4_ADMIN_API_BASE}/accounts`,
        tokenRecord,
      );

    if (accountsError) {
      return NextResponse.json({ error: accountsError }, { status: 400 });
    }

    const accounts = accountsData?.accounts || [];

    // 取得所有帳戶下的 Properties
    const allProperties: GA4Property[] = [];

    for (const account of accounts) {
      const { data: propertiesData, error: propertiesError } =
        await callGoogleApi<GA4PropertiesResponse>(
          `${GA4_ADMIN_API_BASE}/properties?filter=parent:${account.name}`,
          tokenRecord,
        );

      if (!propertiesError && propertiesData?.properties) {
        allProperties.push(...propertiesData.properties);
      }
    }

    return NextResponse.json({
      success: true,
      accounts,
      properties: allProperties,
    });
  } catch (error) {
    console.error("[GA4 Properties] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
