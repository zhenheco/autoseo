/**
 * 自動翻譯設定 API
 *
 * GET: 取得用戶所有網站的自動翻譯設定
 * PUT: 更新指定網站的自動翻譯設定
 */

import { NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { safeJson } from "@/lib/api/request-body";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import {
  successResponse,
  validationError,
  forbidden,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import { createAdminClient } from "@shared/supabase";
import { canAccessTranslation } from "@/lib/translations/access-control";
import { resolveCompanyScopeForUser } from "@/lib/api/company-scope";
import type { TranslationLocale } from "@/types/translations";
import { TRANSLATION_LOCALES } from "@/types/translations";

/** 網站類型（只支援 platform 和 external） */
type SupportedSiteType = "platform" | "external";

/**
 * GET: 取得用戶所有網站的自動翻譯設定
 */
export const GET = withRouteAuth(
  "authenticated",
  async (_request: NextRequest, { user }) => {
    // 檢查翻譯功能存取權限（Beta 功能）
    if (!canAccessTranslation(user.email)) {
      return forbidden(
        "Translation feature is currently in beta. Access restricted.",
      );
    }

    try {
      const adminClient = createAdminClient();

      const companyScope = await resolveCompanyScopeForUser(
        adminClient,
        user.id,
      );

      if (!companyScope.success) {
        return successResponse({ websites: [] });
      }

      // 取得公司的所有網站及其自動翻譯設定
      // 只顯示 platform（官方 Blog）和 external（SDK 串接網站），排除 wordpress 網站
      const { data: websites, error } = await adminClient
        .from("website_configs")
        .select(
          "id, website_name, auto_translate_enabled, auto_translate_languages, site_type",
        )
        .eq("company_id", companyScope.companyId)
        .eq("is_active", true)
        .in("site_type", ["platform", "external"])
        .order("website_name");

      if (error) {
        console.error("Failed to fetch website configs:", error);
        return internalError("Failed to fetch website configs");
      }

      return successResponse({
        websites:
          websites?.map((w) => ({
            id: w.id,
            website_name: w.website_name,
            auto_translate_enabled: w.auto_translate_enabled ?? false,
            auto_translate_languages: w.auto_translate_languages ?? [],
            site_type: w.site_type as SupportedSiteType,
          })) || [],
      });
    } catch (error: unknown) {
      console.error("Translation settings API error:", error);
      return internalError((error as Error).message);
    }
  },
);

/**
 * PUT: 更新指定網站的自動翻譯設定
 */
export const PUT = withRouteAuth(
  "authenticated",
  async (request: NextRequest, { user }) => {
    // 檢查翻譯功能存取權限（Beta 功能）
    if (!canAccessTranslation(user.email)) {
      return forbidden(
        "Translation feature is currently in beta. Access restricted.",
      );
    }

    // 解析請求
    const jsonResult = await safeJson<{
      website_id?: string;
      auto_translate_enabled?: boolean;
      auto_translate_languages?: string[];
    }>(request);
    if (!jsonResult.success) {
      return requestErrorResponse(jsonResult.error);
    }

    const body = jsonResult.data;
    const { website_id, auto_translate_enabled, auto_translate_languages } =
      body;

    // 驗證參數
    if (!website_id) {
      return validationError("website_id is required");
    }

    if (typeof auto_translate_enabled !== "boolean") {
      return validationError("auto_translate_enabled must be a boolean");
    }

    // 驗證語言代碼
    if (auto_translate_languages) {
      if (!Array.isArray(auto_translate_languages)) {
        return validationError("auto_translate_languages must be an array");
      }

      const invalidLocales = auto_translate_languages.filter(
        (l: string) => !TRANSLATION_LOCALES.includes(l as TranslationLocale),
      );
      if (invalidLocales.length > 0) {
        return validationError(`Invalid locales: ${invalidLocales.join(", ")}`);
      }
    }

    try {
      const adminClient = createAdminClient();

      const companyScope = await resolveCompanyScopeForUser(
        adminClient,
        user.id,
      );

      if (!companyScope.success) {
        return forbidden("User is not a member of any company");
      }

      // 確認網站屬於用戶的公司
      const { data: website, error: websiteError } = await adminClient
        .from("website_configs")
        .select("id")
        .eq("id", website_id)
        .eq("company_id", companyScope.companyId)
        .single();

      if (websiteError || !website) {
        return notFound("Website not found or not accessible");
      }

      // 更新自動翻譯設定
      const { error: updateError } = await adminClient
        .from("website_configs")
        .update({
          auto_translate_enabled,
          auto_translate_languages: auto_translate_languages || [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", website_id);

      if (updateError) {
        console.error("Failed to update auto translate settings:", updateError);
        return internalError("Failed to update settings");
      }

      return successResponse({
        success: true,
        website_id,
        auto_translate_enabled,
        auto_translate_languages: auto_translate_languages || [],
      });
    } catch (error: unknown) {
      console.error("Translation settings API error:", error);
      return internalError((error as Error).message);
    }
  },
);
