import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { getAdminActionLogs } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/logs
 * 取得 Admin 操作記錄
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const actionType = searchParams.get("actionType") || undefined;
    const targetType = searchParams.get("targetType") || undefined;

    // 取得操作記錄
    const { logs, total } = await getAdminActionLogs({
      limit,
      offset,
      actionType,
      targetType,
    });

    // 操作類型文字對應
    const actionTypeText: Record<string, string> = {
      extend_subscription: "延長訂閱",
      grant_articles: "贈送篇數",
      adjust_subscription: "調整訂閱",
      create_promo_code: "建立優惠碼",
      update_promo_code: "更新優惠碼",
      deactivate_promo_code: "停用優惠碼",
      manual_adjustment: "手動調整",
      other: "其他",
    };

    // 目標類型文字對應
    const targetTypeText: Record<string, string> = {
      company: "公司",
      subscription: "訂閱",
      promo_code: "優惠碼",
    };

    // 格式化資料
    const formattedData = logs.map((log) => ({
      id: log.id,
      adminEmail: log.admin_email,
      actionType: log.action_type,
      actionTypeText: actionTypeText[log.action_type] || log.action_type,
      targetType: log.target_type,
      targetTypeText: targetTypeText[log.target_type] || log.target_type,
      targetId: log.target_id,
      targetName: log.target_name,
      actionDetails: log.action_details,
      createdAt: log.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[API] /admin/logs error:", error);
    return NextResponse.json(
      { success: false, error: "取得操作記錄失敗" },
      { status: 500 },
    );
  }
}
