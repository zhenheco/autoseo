import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/refund/[refundNo]/status
 * 查詢退款狀態
 */
export const GET = withRouteAuth(
  "authenticated",
  async (
    _request: NextRequest,
    _context,
    { params }: { params: Promise<{ refundNo: string }> },
  ) => {
    try {
      const { refundNo } = await params;

      if (!refundNo) {
        return NextResponse.json(
          { success: false, error: "請提供退款單號" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "退款狀態查詢已停用",
          code: "REFUNDS_DISABLED",
        },
        { status: 410 },
      );
    } catch (error) {
      console.error("[API] /refund/[refundNo]/status error:", error);
      return NextResponse.json(
        { success: false, error: "查詢退款狀態失敗" },
        { status: 500 },
      );
    }
  },
);
