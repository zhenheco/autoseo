import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";

/**
 * POST /api/payment/recurring/create
 *
 * Recurring payments are disabled while the legacy provider is removed and
 * Stripe subscriptions are not yet installed.
 */
export const POST = withRouteAuth(
  "authenticated",
  async (request: NextRequest) => {
    try {
      const bodyResult = await safeJson<{
        companyId?: string;
        planId?: string;
        description?: string;
        email?: string;
        invoice?: unknown;
      }>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      return NextResponse.json(
        {
          success: false,
          error: "訂閱付款暫時停用，Stripe 訂閱將在後續階段啟用",
          code: "PAYMENTS_DISABLED",
        },
        { status: 410 },
      );
    } catch (error) {
      console.error("[API] 建立定期定額失敗:", error);
      return NextResponse.json({ error: "建立定期定額失敗" }, { status: 500 });
    }
  },
);
