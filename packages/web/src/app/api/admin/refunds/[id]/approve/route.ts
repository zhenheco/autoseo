import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/refunds/[id]/approve
 * 管理員核准退款申請
 */
export const POST = withRouteAuth("admin", async (_request: NextRequest) => {
  return NextResponse.json(
    {
      success: false,
      error: "退款功能已停用",
      code: "REFUNDS_DISABLED",
    },
    { status: 410 },
  );
});
