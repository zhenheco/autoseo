/**
 * POST /api/v1/sites/:id/regenerate-key
 *
 * 重新生成外部網站的 API Key
 *
 * 認證：需要用戶登入且有公司成員資格
 *
 * Response:
 * - api_key: 新的 API Key（只顯示一次）
 */

import { NextRequest } from "next/server";
import { withCompany, CompanyAuthContext } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import { regenerateApiKey, maskApiKey } from "@/lib/api-key/api-key-service";

/**
 * 重新生成 API Key
 */
async function regenerateKey(
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

    // 重新生成 API Key
    const newApiKey = await regenerateApiKey(websiteId, companyId);

    if (!newApiKey) {
      return internalError("重新生成 API Key 失敗");
    }

    return successResponse({
      website: {
        id: website.id,
        website_name: website.website_name,
        api_key_masked: maskApiKey(newApiKey),
      },
      // 新的 API Key 只顯示一次
      api_key: newApiKey,
      message: "舊的 API Key 已失效，請使用新的 API Key",
    });
  } catch (error) {
    console.error("[Sites Regenerate Key] Error:", error);
    return internalError("重新生成 API Key 時發生錯誤");
  }
}

/**
 * POST handler
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const wrappedHandler = withCompany(async (req, authContext) => {
    const params = await context.params;
    return regenerateKey(req, authContext, params.id);
  });

  return wrappedHandler(request);
}
