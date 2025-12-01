import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { TokenBillingService } from "@/lib/billing/token-billing-service";
import { getSafeErrorMessage, logError } from "@/lib/utils/error-handler";
import { getCachedBalance, setCachedBalance } from "@/lib/cache";

/**
 * GET /api/token-balance
 * 取得當前公司的 token 餘額和訂閱資訊
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const supabase = await createClient();

    // 取得用戶的公司
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "找不到公司" }, { status: 404 });
    }

    const companyId = membership.company_id;

    // 嘗試從 Redis 快取讀取
    const cached = await getCachedBalance(companyId);
    if (cached) {
      console.log("[token-balance] 🚀 Cache HIT for company:", companyId);
      return NextResponse.json({
        balance: {
          total: cached.total,
          monthlyQuota: cached.monthlyQuota,
          purchased: cached.purchased,
          reserved: cached.reserved,
          available: cached.available,
        },
        subscription: cached.subscription,
        plan: cached.plan,
        cached: true,
        cachedAt: cached.cachedAt,
      });
    }

    console.log("[token-balance] 📊 Cache MISS for company:", companyId);

    // 取得公司訂閱資訊
    const { data: company } = await supabase
      .from("companies")
      .select("subscription_tier")
      .eq("id", membership.company_id)
      .single();

    // 直接從 company_subscriptions 查詢所有需要的數據
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select(
        "monthly_token_quota, monthly_quota_balance, purchased_token_balance, current_period_start, current_period_end, plan_id",
      )
      .eq("company_id", membership.company_id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      return NextResponse.json({ error: "找不到有效訂閱" }, { status: 404 });
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
      await billingService.getAvailableBalanceWithReservations(
        membership.company_id,
      );
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

    const response = {
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
    };

    // 設置 Redis 快取（20 秒 TTL）
    await setCachedBalance(companyId, {
      total,
      monthlyQuota,
      purchased,
      reserved,
      available,
      subscription: {
        tier: company?.subscription_tier || "free",
        monthlyTokenQuota: subscription.monthly_token_quota,
      },
      plan: planInfo ? { name: planInfo.name, slug: planInfo.slug } : null,
    });

    return NextResponse.json(response);
  } catch (error) {
    logError("API:token-balance", error);
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 },
    );
  }
}
