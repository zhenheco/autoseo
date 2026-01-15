/**
 * 自動翻譯設定 API
 *
 * GET: 取得用戶所有網站的自動翻譯設定
 * PUT: 更新指定網站的自動翻譯設定
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  forbidden,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import { canAccessTranslation } from "@/lib/translations/access-control";
import type { TranslationLocale } from "@/types/translations";
import { TRANSLATION_LOCALES } from "@/types/translations";

/**
 * GET: 取得用戶所有網站的自動翻譯設定
 */
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  // 檢查翻譯功能存取權限（Beta 功能）
  if (!canAccessTranslation(user.email)) {
    return forbidden(
      "Translation feature is currently in beta. Access restricted."
    );
  }

  try {
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 取得用戶的公司
    const { data: companyMember } = await adminClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return successResponse({ websites: [] });
    }

    // 取得公司的所有網站及其自動翻譯設定
    const { data: websites, error } = await adminClient
      .from("website_configs")
      .select(
        "id, website_name, auto_translate_enabled, auto_translate_languages"
      )
      .eq("company_id", companyMember.company_id)
      .eq("is_active", true)
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
        })) || [],
    });
  } catch (error: unknown) {
    console.error("Translation settings API error:", error);
    return internalError((error as Error).message);
  }
});

/**
 * PUT: 更新指定網站的自動翻譯設定
 */
export const PUT = withAuth(async (request: NextRequest, { user }) => {
  // 檢查翻譯功能存取權限（Beta 功能）
  if (!canAccessTranslation(user.email)) {
    return forbidden(
      "Translation feature is currently in beta. Access restricted."
    );
  }

  // 解析請求
  const body = await request.json();
  const { website_id, auto_translate_enabled, auto_translate_languages } = body;

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
      (l: string) => !TRANSLATION_LOCALES.includes(l as TranslationLocale)
    );
    if (invalidLocales.length > 0) {
      return validationError(`Invalid locales: ${invalidLocales.join(", ")}`);
    }
  }

  try {
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 取得用戶的公司
    const { data: companyMember } = await adminClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return forbidden("User is not a member of any company");
    }

    // 確認網站屬於用戶的公司
    const { data: website, error: websiteError } = await adminClient
      .from("website_configs")
      .select("id")
      .eq("id", website_id)
      .eq("company_id", companyMember.company_id)
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
});
