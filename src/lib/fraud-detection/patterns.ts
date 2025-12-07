/**
 * 異常推薦模式偵測
 * 檢測短時間大量推薦、快速取消等異常行為
 */

import { createClient } from "@/lib/supabase/server";
import type { AbnormalPatternCheckResult } from "@/types/fraud.types";

// 閾值配置
const THRESHOLDS = {
  // 24 小時內的推薦數量上限
  RAPID_REFERRALS_24H: 5,
  // 7 天內的推薦數量上限
  RAPID_REFERRALS_7D: 10,
  // 快速取消的天數（首次付款後多少天內取消算快速取消）
  QUICK_CANCEL_DAYS: 7,
  // 快速取消的次數閾值
  QUICK_CANCEL_COUNT: 2,
};

/**
 * 檢查異常推薦模式
 */
export async function checkAbnormalPatterns(
  referrerCompanyId: string,
): Promise<AbnormalPatternCheckResult> {
  const supabase = await createClient();

  const result: AbnormalPatternCheckResult = {
    rapidReferrals: false,
    quickCancellations: false,
    details: {},
  };

  // 檢查 1: 24 小時內的推薦數量
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: referrals24h } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_company_id", referrerCompanyId)
    .gte("created_at", twentyFourHoursAgo);

  if (referrals24h && referrals24h > THRESHOLDS.RAPID_REFERRALS_24H) {
    result.rapidReferrals = true;
    result.referralCount = referrals24h;
    result.details.rapidReferrals24h = referrals24h;
    result.details.threshold24h = THRESHOLDS.RAPID_REFERRALS_24H;
  }

  // 檢查 2: 7 天內的推薦數量
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: referrals7d } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_company_id", referrerCompanyId)
    .gte("created_at", sevenDaysAgo);

  if (referrals7d && referrals7d > THRESHOLDS.RAPID_REFERRALS_7D) {
    result.rapidReferrals = true;
    if (!result.referralCount || referrals7d > result.referralCount) {
      result.referralCount = referrals7d;
    }
    result.details.rapidReferrals7d = referrals7d;
    result.details.threshold7d = THRESHOLDS.RAPID_REFERRALS_7D;
  }

  // 檢查 3: 快速取消訂閱的被推薦人數量
  // 查詢首次付款後 7 天內取消訂閱的被推薦人
  const { data: cancelledReferrals, count: cancelCount } = await supabase
    .from("referrals")
    .select(
      `
      id,
      referred_company_id,
      first_payment_at,
      company_subscriptions!inner(
        status,
        cancelled_at
      )
    `,
      { count: "exact" },
    )
    .eq("referrer_company_id", referrerCompanyId)
    .not("first_payment_at", "is", null);

  // 過濾出快速取消的推薦
  let quickCancelCount = 0;
  if (cancelledReferrals) {
    for (const referral of cancelledReferrals) {
      const subscription = referral.company_subscriptions as unknown as {
        status: string;
        cancelled_at: string | null;
      };

      if (
        subscription &&
        subscription.status === "cancelled" &&
        subscription.cancelled_at &&
        referral.first_payment_at
      ) {
        const paymentDate = new Date(referral.first_payment_at);
        const cancelDate = new Date(subscription.cancelled_at);
        const daysDiff =
          (cancelDate.getTime() - paymentDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysDiff <= THRESHOLDS.QUICK_CANCEL_DAYS) {
          quickCancelCount++;
        }
      }
    }
  }

  if (quickCancelCount >= THRESHOLDS.QUICK_CANCEL_COUNT) {
    result.quickCancellations = true;
    result.cancelCount = quickCancelCount;
    result.details.quickCancelCount = quickCancelCount;
    result.details.quickCancelThreshold = THRESHOLDS.QUICK_CANCEL_COUNT;
  }

  return result;
}

/**
 * 檢查同 IP 位址的推薦數量
 */
export async function checkSameIpReferrals(
  referrerCompanyId: string,
  ipAddress: string,
): Promise<{ isSuspicious: boolean; count: number }> {
  if (!ipAddress) {
    return { isSuspicious: false, count: 0 };
  }

  const supabase = await createClient();

  // 查詢同一 IP 的推薦追蹤記錄
  const { count } = await supabase
    .from("referral_tracking_logs")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .eq("event_type", "register");

  const referralCount = count || 0;

  // 如果同一 IP 有超過 5 個註冊，標記為可疑
  return {
    isSuspicious: referralCount > 5,
    count: referralCount,
  };
}
