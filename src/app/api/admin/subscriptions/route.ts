import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { getAllSubscriptions } from "@/lib/admin/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/subscriptions
 * 取得所有會員訂閱資訊
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 取得所有訂閱
    const subscriptions = await getAllSubscriptions();

    // 格式化資料
    const formattedData = subscriptions.map((sub) => ({
      id: sub.id,
      companyId: sub.company_id,
      companyName: sub.company?.name || "未知",
      companySlug: sub.company?.slug || "",
      planName: sub.plan?.name || "無方案",
      planSlug: sub.plan?.slug || "free",
      status: sub.status,
      articlesPerMonth: sub.articles_per_month,
      subscriptionArticlesRemaining: sub.subscription_articles_remaining,
      purchasedArticlesRemaining: sub.purchased_articles_remaining,
      totalArticlesRemaining:
        sub.subscription_articles_remaining + sub.purchased_articles_remaining,
      billingCycle: sub.billing_cycle,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      isLifetime: sub.is_lifetime,
      createdAt: sub.created_at,
      updatedAt: sub.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      total: formattedData.length,
    });
  } catch (error) {
    console.error("[API] /admin/subscriptions error:", error);
    return NextResponse.json(
      { success: false, error: "取得訂閱列表失敗" },
      { status: 500 },
    );
  }
}
