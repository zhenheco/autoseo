/**
 * POST /api/v1/sites/register
 *
 * 註冊外部網站並取得 API Key
 *
 * 認證：需要用戶登入且有公司成員資格
 *
 * Request body:
 * - website_name: 網站名稱
 * - website_url: 網站網址
 *
 * Response:
 * - website: 網站資訊
 * - api_key: API Key（只在建立時返回一次）
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { withCompany, CompanyAuthContext } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import {
  generateApiKey,
  hashApiKey,
  maskApiKey,
} from "@/lib/api-key/api-key-service";

// 請求 schema
const registerSchema = z.object({
  website_name: z.string().min(1, "網站名稱不可為空").max(100),
  website_url: z.string().url("請輸入有效的網址"),
});

/**
 * 註冊外部網站
 */
async function registerExternalSite(
  request: NextRequest,
  { supabase, companyId }: CompanyAuthContext,
) {
  try {
    // 解析請求
    const body = await request.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(parseResult.error.issues[0].message);
    }

    const { website_name, website_url } = parseResult.data;

    // 檢查網址是否已被使用
    const { data: existingWebsite } = await supabase
      .from("website_configs")
      .select("id")
      .eq("wordpress_url", website_url)
      .single();

    if (existingWebsite) {
      return validationError("此網址已被註冊");
    }

    // 生成 API Key
    const apiKey = await generateApiKey();
    const hashedApiKey = await hashApiKey(apiKey);

    // 建立網站記錄
    const { data: website, error } = await supabase
      .from("website_configs")
      .insert({
        company_id: companyId,
        website_name,
        wordpress_url: website_url,
        site_type: "external",
        is_external_site: true,
        wp_enabled: false,
        api_key: hashedApiKey,
        api_key_created_at: new Date().toISOString(),
      })
      .select("id, website_name, wordpress_url, site_type, is_external_site")
      .single();

    if (error) {
      console.error("[Sites Register] Database error:", error);
      return internalError("建立網站失敗");
    }

    return successResponse({
      website: {
        id: website.id,
        website_name: website.website_name,
        website_url: website.wordpress_url,
        site_type: website.site_type,
        is_external_site: website.is_external_site,
        api_key_masked: maskApiKey(apiKey),
      },
      // API Key 只在建立時返回一次
      api_key: apiKey,
      message: "請妥善保管 API Key，此金鑰只會顯示一次",
    });
  } catch (error) {
    console.error("[Sites Register] Error:", error);
    return internalError("註冊網站時發生錯誤");
  }
}

export const POST = withCompany(registerExternalSite);
