import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

interface AcceptRetentionBody {
  refundId: string;
}

/**
 * POST /api/refund/accept-retention
 * 接受慰留方案（贈送 50% credits）
 *
 * 注意：退款功能暫時停用，等待金流微服務支援退款後再啟用
 */
export async function POST(request: NextRequest) {
  // 退款功能暫時停用
  return NextResponse.json(
    {
      success: false,
      error: "退款功能暫時停用，請聯繫客服處理退款事宜",
      code: "REFUND_DISABLED",
    },
    { status: 503 },
  );

  // 以下為原有邏輯，待金流微服務支援退款後啟用

  const _unusedRequest = request;
  void _unusedRequest;
}
