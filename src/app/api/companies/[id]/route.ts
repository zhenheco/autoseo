/**
 * 單一公司操作 API
 */

import { NextRequest } from "next/server";
import { withAuth, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  forbidden,
  internalError,
} from "@/lib/api/response-helpers";

/**
 * DELETE /api/companies/[id]
 * 刪除公司（僅擁有者可執行）
 */
export const DELETE = withAuth(
  async (request: NextRequest, { user, supabase }) => {
    const { id } = extractPathParams(request);

    if (!id) {
      return notFound("公司");
    }

    // 檢查用戶是否為該公司的擁有者
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", id)
      .eq("user_id", user.id)
      .single();

    if (!member || member.role !== "owner") {
      return forbidden("只有擁有者可以刪除公司");
    }

    // 刪除公司（CASCADE 會自動刪除關聯資料）
    const { error } = await supabase.from("companies").delete().eq("id", id);

    if (error) {
      console.error("刪除公司失敗:", error);
      return internalError("刪除公司失敗");
    }

    return successResponse(null);
  },
);
