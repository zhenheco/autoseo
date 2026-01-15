/**
 * GET /api/v1/sites/:id/usage
 *
 * 取得外部網站的 API 使用量統計
 *
 * 認證：需要用戶登入且有公司成員資格
 *
 * Query params:
 * - days: 查詢天數（預設 30，最大 90）
 *
 * Response:
 * - summary: 使用量摘要
 * - dailyStats: 每日統計（可選）
 */

import { NextRequest } from "next/server";
import { withCompany, CompanyAuthContext } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import {
  getUsageSummary,
  getDailyStats,
} from "@/lib/api-key/api-usage-tracker";

/**
 * 取得網站 API 使用量
 */
async function getWebsiteUsage(
  request: NextRequest,
  { supabase, companyId }: CompanyAuthContext,
  websiteId: string,
) {
  try {
    // 檢查網站是否存在且屬於該公司
    const { data: website, error: findError } = await supabase
      .from("website_configs")
      .select("id, website_name, is_external_site")
      .eq("id", websiteId)
      .eq("company_id", companyId)
      .single();

    if (findError || !website) {
      return notFound("網站");
    }

    // 確認是外部網站
    if (!website.is_external_site) {
      return notFound("外部網站");
    }

    // 取得查詢天數
    const url = new URL(request.url);
    const days = Math.min(
      90,
      Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)),
    );
    const includeDailyStats = url.searchParams.get("daily") === "true";

    // 取得使用量摘要
    const summary = await getUsageSummary(websiteId);

    if (!summary) {
      return internalError("取得使用量統計失敗");
    }

    // 取得每日統計（可選）
    let dailyStats = null;
    if (includeDailyStats) {
      dailyStats = await getDailyStats(websiteId, days);
    }

    return successResponse({
      website: {
        id: website.id,
        name: website.website_name,
      },
      summary,
      dailyStats,
    });
  } catch (error) {
    console.error("[Sites Usage] Error:", error);
    return internalError("取得使用量統計時發生錯誤");
  }
}

/**
 * GET handler
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const wrappedHandler = withCompany(async (req, authContext) => {
    const params = await context.params;
    return getWebsiteUsage(req, authContext, params.id);
  });

  return wrappedHandler(request);
}
