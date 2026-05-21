import { NextRequest, NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";

/**
 * POST /api/payment/onetime/create
 *
 * Payments are disabled while the legacy provider is removed and Stripe is not
 * yet installed.
 */
export const POST = withRouteAuth(
  "authenticated",
  async (request: NextRequest) => {
    try {
      const bodyResult = await safeJson<{
        companyId?: string;
        paymentType?: string;
        relatedId?: string;
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
          error: "付款功能暫時停用，Stripe 結帳將在後續階段啟用",
          code: "PAYMENTS_DISABLED",
        },
        { status: 410 },
      );
    } catch (error) {
      console.error("[API] 建立單次支付失敗:", error);
      return NextResponse.json({ error: "建立單次支付失敗" }, { status: 500 });
    }
  },
);
