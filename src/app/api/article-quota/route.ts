import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";
import { getSafeErrorMessage, logError } from "@/lib/utils/error-handler";

/**
 * GET /api/article-quota
 * 取得當前公司的文章額度餘額和訂閱資訊
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const supabase = await createClient();

    // 取得用戶的公司（使用 limit(1) 避免多筆記錄時報錯）
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "找不到公司" }, { status: 404 });
    }

    // 使用新的篇數制服務
    const quotaService = new ArticleQuotaService(supabase);

    // 取得餘額（會自動執行 Lazy Reset）
    const balance = await quotaService.getBalance(membership.company_id);

    // 取得方案資訊
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select(
        `
        plan_id,
        billing_cycle,
        current_period_start,
        current_period_end,
        subscription_plans (
          name,
          slug,
          features
        )
      `,
      )
      .eq("company_id", membership.company_id)
      .eq("status", "active")
      .single();

    // 取得預扣中的篇數（status = 'active' 表示正在處理中的預扣）
    const { data: reservations } = await supabase
      .from("token_reservations")
      .select("reserved_amount")
      .eq("company_id", membership.company_id)
      .eq("status", "active");

    const reservedCount =
      reservations?.reduce((sum, r) => sum + (r.reserved_amount || 0), 0) || 0;

    // 處理 subscription_plans 的類型（可能是對象或陣列）
    const planData = subscription?.subscription_plans as unknown as {
      name: string;
      slug: string;
      features: unknown;
    } | null;

    // balance.totalAvailable 已經扣除了預扣，所以 available 直接使用它
    // reserved 顯示處理中的篇數（僅供 UI 顯示用）
    const response = {
      balance: {
        subscriptionRemaining: balance.subscriptionRemaining,
        purchasedRemaining: balance.purchasedRemaining,
        totalAvailable: balance.totalAvailable + reservedCount, // 還原為未扣預扣的總額
        monthlyQuota: balance.monthlyQuota,
        reserved: reservedCount,
        available: balance.totalAvailable, // 已扣除預扣的實際可用額度
      },
      subscription: {
        billingCycle: balance.billingCycle,
        periodEnd: balance.periodEnd,
        periodStart: subscription?.current_period_start || null,
      },
      plan: planData
        ? {
            name: planData.name,
            slug: planData.slug,
            features: planData.features,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError("API:article-quota", error);
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 },
    );
  }
}
