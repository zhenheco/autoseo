/**
 * 同步目標查詢 API（用戶端）
 * 用於發布文章時選擇同步目標
 */

import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync-targets
 * 取得所有啟用的同步目標（給用戶端選擇用）
 * 僅返回必要欄位，脫敏敏感資訊
 */
export const GET = withCompany(async () => {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("sync_targets")
      .select("id, name, slug, description, is_active, sync_on_publish")
      .eq("is_active", true)
      .eq("sync_on_publish", true)
      .order("name", { ascending: true });

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
