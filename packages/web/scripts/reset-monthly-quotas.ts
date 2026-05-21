/**
 * 重置到期的月配額（備援 Cron Job）
 *
 * 此腳本作為 Lazy Reset 的備援機制，每天凌晨執行一次
 * 確保即使用戶沒有登入，配額也會在到期時重置
 */

import { createClient } from "@supabase/supabase-js";

interface SubscriptionWithPlan {
  id: string;
  company_id: string;
  plan_id: string;
  subscription_articles_remaining: number | null;
  articles_per_month: number | null;
  current_period_end: string | null;
  last_quota_reset_at: string | null;
  billing_cycle: "monthly" | "yearly" | null;
  subscription_plans: {
    articles_per_month: number;
  } | null;
}

async function resetMonthlyQuotas() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("缺少環境變數：SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();

  console.log(`[ResetQuotas] 開始執行月配額重置檢查 - ${now.toISOString()}`);

  // 查詢需要重置的訂閱
  // 條件：current_period_end 已過期，且 last_quota_reset_at 在 period_end 之前
  const { data: subscriptions, error: queryError } = await supabase
    .from("company_subscriptions")
    .select(
      `
      id,
      company_id,
      plan_id,
      subscription_articles_remaining,
      articles_per_month,
      current_period_end,
      last_quota_reset_at,
      billing_cycle,
      subscription_plans (
        articles_per_month
      )
    `,
    )
    .eq("status", "active")
    .not("current_period_end", "is", null)
    .lt("current_period_end", now.toISOString());

  if (queryError) {
    console.error("[ResetQuotas] 查詢失敗:", queryError);
    process.exit(1);
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("[ResetQuotas] 沒有需要重置的訂閱");
    return;
  }

  console.log(`[ResetQuotas] 找到 ${subscriptions.length} 個需要檢查的訂閱`);

  let resetCount = 0;
  let skipCount = 0;

  for (const rawSub of subscriptions) {
    const sub = rawSub as unknown as SubscriptionWithPlan;

    // 檢查是否已經重置過
    if (sub.last_quota_reset_at && sub.current_period_end) {
      const lastReset = new Date(sub.last_quota_reset_at);
      const periodEnd = new Date(sub.current_period_end);

      if (lastReset >= periodEnd) {
        // 已經重置過了
        skipCount++;
        continue;
      }
    }

    // 取得方案的每月篇數
    const articlesPerMonth =
      sub.articles_per_month || sub.subscription_plans?.articles_per_month || 0;

    if (articlesPerMonth === 0) {
      console.log(
        `[ResetQuotas] 跳過 company_id=${sub.company_id}，方案無月配額`,
      );
      skipCount++;
      continue;
    }

    // 計算新的週期
    const oldPeriodEnd = new Date(sub.current_period_end!);
    const newPeriodStart = oldPeriodEnd;
    let newPeriodEnd: Date;

    if (sub.billing_cycle === "yearly") {
      // 年繳：每月重置一次，持續 12 個月
      newPeriodEnd = new Date(
        newPeriodStart.getFullYear(),
        newPeriodStart.getMonth() + 1,
        newPeriodStart.getDate(),
      );
    } else {
      // 月繳：下個月
      newPeriodEnd = new Date(
        newPeriodStart.getFullYear(),
        newPeriodStart.getMonth() + 1,
        newPeriodStart.getDate(),
      );
    }

    // 更新訂閱
    const { error: updateError } = await supabase
      .from("company_subscriptions")
      .update({
        subscription_articles_remaining: articlesPerMonth,
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        last_quota_reset_at: now.toISOString(),
      })
      .eq("id", sub.id);

    if (updateError) {
      console.error(
        `[ResetQuotas] 更新失敗 company_id=${sub.company_id}:`,
        updateError,
      );
      continue;
    }

    console.log(
      `[ResetQuotas] ✅ 重置成功 company_id=${sub.company_id}, ` +
        `篇數=${articlesPerMonth}, 新週期=${newPeriodEnd.toISOString()}`,
    );
    resetCount++;
  }

  console.log(
    `[ResetQuotas] 完成！重置 ${resetCount} 個，跳過 ${skipCount} 個`,
  );
}

resetMonthlyQuotas().catch((error) => {
  console.error("[ResetQuotas] 執行失敗:", error);
  process.exit(1);
});
