import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/refunds
 * 管理員取得所有退款申請列表
 */
export const GET = withRouteAuth("admin", async (request: NextRequest) => {
  try {
    new URL(request.url);

    return NextResponse.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
      message: "退款資料表已移除",
    });
  } catch (error) {
    console.error("[API] /admin/refunds error:", error);
    return NextResponse.json(
      { success: false, error: "查詢退款申請失敗" },
      { status: 500 },
    );
  }
});
