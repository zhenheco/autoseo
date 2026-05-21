import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";

export const GET = withRouteAuth(
  "authenticated",
  async (
    _request: NextRequest,
    _context,
    { params }: { params: Promise<{ orderNo: string }> },
  ) => {
    try {
      const { orderNo } = await params;

      if (!orderNo) {
        return NextResponse.json({ error: "請提供訂單編號" }, { status: 400 });
      }

      return NextResponse.json(
        {
          synced: false,
          status: "disabled",
          message: "付款查詢暫時停用",
          code: "PAYMENTS_DISABLED",
        },
        { status: 410 },
      );
    } catch (error) {
      console.error("[Order Status API] 查詢訂單狀態失敗:", error);
      return NextResponse.json({ error: "查詢訂單狀態失敗" }, { status: 500 });
    }
  },
);
