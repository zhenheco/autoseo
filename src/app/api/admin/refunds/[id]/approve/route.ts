import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

// 管理員 email 白名單
const ADMIN_EMAILS = ["avyshiu@gmail.com", "ace@marketermilk.com"];

interface ApproveBody {
  notes?: string;
}

/**
 * POST /api/admin/refunds/[id]/approve
 * 管理員核准退款申請
 *
 * 注意：退款功能暫時停用，等待金流微服務支援退款後再啟用
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 退款功能暫時停用
  return NextResponse.json(
    {
      success: false,
      error: "退款功能暫時停用，請透過手動方式處理退款",
      code: "REFUND_DISABLED",
    },
    { status: 503 },
  );

  // 以下為原有邏輯，待金流微服務支援退款後啟用

  const _unusedRequest = request;
  const _unusedParams = params;
  void _unusedRequest;
  void _unusedParams;
}
