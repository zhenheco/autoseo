import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import { extendSubscription } from "@/lib/admin/admin-service";

/**
 * POST /api/admin/subscriptions/[companyId]/extend
 * 延長訂閱期限
 */
export const POST = withRouteAuth(
  "admin",
  async (
    request: NextRequest,
    { user },
    { params }: { params: Promise<{ companyId: string }> },
  ) => {
    try {
      const { companyId } = await params;

      // 解析請求內容
      const bodyResult = await safeJson<{
        days?: unknown;
        reason?: string;
      }>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      const body = bodyResult.data;
      const { days, reason } = body;

      if (!days || typeof days !== "number" || days <= 0) {
        return NextResponse.json(
          { success: false, error: "請提供有效的延長天數" },
          { status: 400 },
        );
      }

      // 執行延長
      await extendSubscription({
        companyId,
        days,
        adminUserId: user.id,
        adminEmail: user.email || "",
        reason,
      });

      return NextResponse.json({
        success: true,
        message: `已成功延長 ${days} 天`,
      });
    } catch (error) {
      console.error("[API] /admin/subscriptions/extend error:", error);
      const message = error instanceof Error ? error.message : "延長訂閱失敗";
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      );
    }
  },
);
