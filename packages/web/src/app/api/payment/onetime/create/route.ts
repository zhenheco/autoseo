import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { withRouteAuth } from "@/lib/api/route-auth";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import {
  PaymentService,
  type CreateOnetimeOrderParams,
} from "@/lib/payment/payment-service";

/**
 * POST /api/payment/onetime/create
 *
 * 建立一次性付款訂單。
 * 使用金流微服務 SDK，金額從 DB 取得，不信任前端傳入的 amount。
 */
export const POST = withRouteAuth(
  "authenticated",
  async (request: NextRequest, { user, supabase }) => {
    try {
      const bodyResult = await safeJson<{
        companyId?: string;
        paymentType?: string;
        relatedId?: string;
        description?: string;
        email?: string;
        invoice?: CreateOnetimeOrderParams["invoice"];
      }>(request);
      if (!bodyResult.success) {
        return requestErrorResponse(bodyResult.error);
      }

      const body = bodyResult.data;
      const { companyId, paymentType, relatedId, description, email, invoice } =
        body;

      if (!companyId || !paymentType || !relatedId || !description || !email) {
        return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
      }

      const { data: membership } = await supabase
        .from("company_members")
        .select("role")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: "無權限存取此公司" },
          { status: 403 },
        );
      }

      // 從 DB 查詢真實金額，不信任前端傳入的 amount
      const adminSupabase = createAdminClient();
      const verifiedAmount = await getVerifiedAmount(
        adminSupabase,
        paymentType,
        relatedId,
      );

      if (!verifiedAmount) {
        return NextResponse.json(
          { error: "找不到對應的方案或金額" },
          { status: 400 },
        );
      }
      const verifiedPaymentType =
        paymentType as CreateOnetimeOrderParams["paymentType"];

      const paymentService = PaymentService.createInstance(supabase);

      const result = await paymentService.createOnetimePayment({
        companyId,
        paymentType: verifiedPaymentType,
        relatedId,
        amount: verifiedAmount,
        description,
        email,
        ...(invoice ? { invoice } : {}),
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        orderId: result.orderId,
        orderNo: result.orderNo,
        paymentId: result.paymentId,
        paymentForm: result.paymentForm,
      });
    } catch (error) {
      console.error("[API] 建立單次支付失敗:", error);
      return NextResponse.json({ error: "建立單次支付失敗" }, { status: 500 });
    }
  },
);

/**
 * 從 DB 查詢真實金額，防止前端竄改
 */
async function getVerifiedAmount(
  supabase: ReturnType<typeof createAdminClient>,
  paymentType: string,
  relatedId: string,
): Promise<number | null> {
  switch (paymentType) {
    case "token_package": {
      const { data } = await supabase
        .from("token_packages")
        .select("price")
        .eq("id", relatedId)
        .single();
      return data?.price ?? null;
    }
    case "subscription": {
      const { data } = await supabase
        .from("subscription_plans")
        .select("price")
        .eq("id", relatedId)
        .single();
      return data?.price ?? null;
    }
    case "article_package": {
      const { data } = await supabase
        .from("article_packages")
        .select("price")
        .eq("id", relatedId)
        .single();
      return data?.price ?? null;
    }
    case "lifetime": {
      const { data } = await supabase
        .from("subscription_plans")
        .select("price")
        .eq("id", relatedId)
        .eq("is_lifetime", true)
        .single();
      return data?.price ?? null;
    }
    default:
      return null;
  }
}
