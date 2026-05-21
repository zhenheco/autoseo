import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/refund/proceed
 * 繼續退款（拒絕慰留方案）
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "退款功能已停用，請聯繫客服處理退款事宜",
      code: "REFUNDS_DISABLED",
    },
    { status: 410 },
  );
}
