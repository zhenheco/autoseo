/**
 * 同步目標查詢 API（用戶端）
 * 用於發布文章時選擇同步目標
 * 現在從 website_configs 查詢 website_type = 'external' 的資料
 */

import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync-targets
 * 取得所有啟用的外部網站（同步目標）
 * 從 website_configs 查詢 website_type = 'external' 的資料
 * 僅返回必要欄位，脫敏敏感資訊
 */
export const GET = withCompany(async () => {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("website_configs")
      .select("id, website_name, external_slug, is_active, sync_on_publish")
      .eq("website_type", "external")
      .eq("is_active", true)
      .eq("sync_on_publish", true)
      .order("website_name", { ascending: true });

    if (error) {
      console.error("[SyncTargets] 查詢失敗:", error);
      return handleApiError(error);
    }

    return successResponse(data || []);
  } catch (error) {
    console.error("[SyncTargets] GET 錯誤:", error);
    return handleApiError(error);
  }
});
