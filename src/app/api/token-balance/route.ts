/**
 * Token 餘額查詢 API
 */

import { withCompany } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";
import { TokenBillingService } from "@/lib/billing/token-billing-service";
import { logError } from "@/lib/utils/error-handler";

/**
 * GET /api/token-balance
 * 取得當前公司的 token 餘額和訂閱資訊
 */
export const GET = withCompany(async (request, { supabase, companyId }) => {
  try {
    // 取得公司訂閱層級
    const { data: company } = await supabase
      .from("companies")
      .select("subscription_tier")
      .eq("id", companyId)
      .single();

    // 取得訂閱詳情
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select(
        "monthly_token_quota, monthly_quota_balance, purchased_token_balance, current_period_start, current_period_end, plan_id",
      )
      .eq("company_id", companyId)
      .eq("status", "active")
      .single();

    if (!subscription) {
      return notFound("有效訂閱");
    }

    // 免費方案邏輯：monthly_token_quota = 0
    const isFree = subscription.monthly_token_quota === 0;

    // 計算餘額
    const monthlyQuota = subscription.monthly_quota_balance;
    const purchased = subscription.purchased_token_balance;
    const total = isFree ? purchased : monthlyQuota + purchased;

    // 取得預扣資訊
    const billingService = new TokenBillingService(supabase);
    const reservationInfo =
      await billingService.getAvailableBalanceWithReservations(companyId);
    const reserved = reservationInfo.reserved;
    const available = total - reserved;

    // 取得方案資訊
    let planInfo = null;
    if (subscription.plan_id) {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("name, slug, features, limits")
        .eq("id", subscription.plan_id)
        .single();

      planInfo = plan;
    }

    return successResponse({
      balance: {
        total,
        monthlyQuota,
        purchased,
        reserved,
        available,
      },
      subscription: {
        tier: company?.subscription_tier || "free",
        monthlyTokenQuota: subscription.monthly_token_quota,
        currentPeriodStart: isFree ? null : subscription.current_period_start,
        currentPeriodEnd: isFree ? null : subscription.current_period_end,
      },
      plan: planInfo,
    });
  } catch (error) {
    logError("API:token-balance", error);
    return internalError("查詢餘額失敗");
  }
});
