import { NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/refund/orders
 * 取得用戶可退款的訂單列表
 */
export const GET = withRouteAuth("authenticated", async () => {
  try {
    return NextResponse.json({
      success: true,
      orders: [],
      message: "退款功能已停用",
    });
  } catch (error) {
    console.error("[API] /refund/orders error:", error);
    return NextResponse.json(
      { success: false, error: "取得訂單列表失敗" },
      { status: 500 },
    );
  }
});
