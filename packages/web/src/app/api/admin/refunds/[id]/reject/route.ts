import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

interface RejectBody {
  rejectReason: string;
}

/**
 * POST /api/admin/refunds/[id]/reject
 * 管理員拒絕退款申請
 */
export const POST = withRouteAuth(
  "admin",
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ id: string }> },
  ) => {
    try {
      const { id } = await params;

      if (!id) {
        return NextResponse.json(
          { success: false, error: "請提供退款申請 ID" },
          { status: 400 },
        );
      }

      // 解析請求內容
      const bodyResult = await safeJson<RejectBody>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      const body = bodyResult.data;

      if (!body.rejectReason) {
        return NextResponse.json(
          { success: false, error: "請提供拒絕原因" },
          { status: 400 },
        );
      }

      // 拒絕退款
      const refundService = RefundService.createInstance();
      const result = await refundService.rejectRefund(
        id,
        user.id,
        body.rejectReason,
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "退款申請已拒絕",
      });
    } catch (error) {
      console.error("[API] /admin/refunds/[id]/reject error:", error);
      return NextResponse.json(
        { success: false, error: "拒絕退款失敗" },
        { status: 500 },
      );
    }
  },
);
