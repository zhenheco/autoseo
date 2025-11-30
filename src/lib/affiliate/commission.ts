/**
 * 聯盟行銷佣金計算邏輯
 */

import { createClient } from "@supabase/supabase-js";
import { COMMISSION_RATE, LOCK_PERIOD_DAYS } from "@/types/referral.types";

interface PaymentOrder {
  id: string;
  company_id: string;
  order_type: string;
  payment_type: "subscription" | "token_package" | "lifetime";
  amount: number;
  paid_at: string;
}

interface CalculateCommissionParams {
  supabaseUrl: string;
  supabaseServiceKey: string;
  paymentOrder: PaymentOrder;
}

/**
 * 計算並創建佣金記錄
 */
export async function calculateAndCreateCommission({
  supabaseUrl,
  supabaseServiceKey,
  paymentOrder,
}: CalculateCommissionParams): Promise<{
  success: boolean;
  commission_id?: string;
  message?: string;
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 檢查是否為訂閱付款（不包含 Credit 包）
    if (paymentOrder.payment_type !== "subscription") {
      return {
        success: false,
        message: "Credit 包不計算佣金",
      };
    }

    // 2. 查詢該公司是否有推薦碼
    const { data: company } = await supabase
      .from("companies")
      .select("referred_by_code")
      .eq("id", paymentOrder.company_id)
      .single();

    if (!company || !company.referred_by_code) {
      return {
        success: false,
        message: "該公司無推薦碼",
      };
    }

    const referralCode = company.referred_by_code;

    // 3. 從 referral_codes 找到推薦人的 company_id
    const { data: referralCodeRecord } = await supabase
      .from("referral_codes")
      .select("company_id")
      .eq("code", referralCode)
      .single();

    if (!referralCodeRecord) {
      return {
        success: false,
        message: "找不到推薦碼記錄",
      };
    }

    // 4. 查詢聯盟夥伴（透過 company_id）
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("*")
      .eq("company_id", referralCodeRecord.company_id)
      .single();

    if (!affiliate) {
      return {
        success: false,
        message: "找不到聯盟夥伴",
      };
    }

    // 5. 檢查聯盟夥伴狀態
    if (affiliate.status !== "active") {
      if (affiliate.status === "inactive") {
        // 有新客戶付款，重新啟動
        await supabase
          .from("affiliates")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", affiliate.id);

        console.log(`聯盟夥伴 ${referralCode} 已重新啟動`);
      } else {
        return {
          success: false,
          message: `聯盟夥伴狀態為 ${affiliate.status}，無法計算佣金`,
        };
      }
    }

    // 6. 查詢或創建推薦記錄（使用 referrals 表）
    let { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_company_id", referralCodeRecord.company_id)
      .eq("referred_company_id", paymentOrder.company_id)
      .single();

    if (!referral) {
      // 創建推薦記錄
      const { data: newReferral, error: referralError } = await supabase
        .from("referrals")
        .insert({
          referrer_company_id: referralCodeRecord.company_id,
          referred_company_id: paymentOrder.company_id,
          referral_code: referralCode,
          status: "qualified",
          registered_at: new Date().toISOString(),
          first_payment_at: paymentOrder.paid_at,
          first_payment_amount: paymentOrder.amount,
          total_payments: 1,
          lifetime_value: paymentOrder.amount,
        })
        .select()
        .single();

      if (referralError) {
        console.error("創建推薦記錄失敗:", referralError);
        return {
          success: false,
          message: "創建推薦記錄失敗",
        };
      }

      referral = newReferral;
    } else {
      // 更新推薦記錄
      await supabase
        .from("referrals")
        .update({
          total_payments: (referral.total_payments ?? 0) + 1,
          lifetime_value:
            parseFloat((referral.lifetime_value ?? 0).toString()) +
            paymentOrder.amount,
          last_payment_at: paymentOrder.paid_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", referral.id);
    }

    // 7. 計算佣金
    const commissionRate = affiliate.commission_rate ?? COMMISSION_RATE;
    const commissionAmount = paymentOrder.amount * (commissionRate / 100);
    const taxRate = parseFloat((affiliate.tax_rate ?? 10).toString());
    const taxAmount = commissionAmount * (taxRate / 100);
    const netCommission = commissionAmount - taxAmount;

    // 8. 計算解鎖時間（30天後）
    const earnedAt = new Date(paymentOrder.paid_at);
    const unlockAt = new Date(earnedAt);
    unlockAt.setDate(unlockAt.getDate() + LOCK_PERIOD_DAYS);

    // 9. 創建佣金記錄
    const { data: commission, error: commissionError } = await supabase
      .from("affiliate_commissions")
      .insert({
        affiliate_id: affiliate.id,
        referral_id: referral.id,
        payment_order_id: paymentOrder.id,
        order_amount: paymentOrder.amount,
        order_type: paymentOrder.order_type,
        tier_level: affiliate.current_tier ?? 1,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        net_commission: netCommission,
        earned_at: earnedAt.toISOString(),
        unlock_at: unlockAt.toISOString(),
        status: "locked",
      })
      .select()
      .single();

    if (commissionError) {
      console.error("創建佣金記錄失敗:", commissionError);
      return {
        success: false,
        message: "創建佣金記錄失敗",
      };
    }

    // 10. 更新聯盟夥伴統計（使用 pending_commission）
    await supabase
      .from("affiliates")
      .update({
        pending_commission:
          parseFloat((affiliate.pending_commission ?? 0).toString()) +
          netCommission,
        lifetime_commission:
          parseFloat((affiliate.lifetime_commission ?? 0).toString()) +
          netCommission,
        updated_at: new Date().toISOString(),
      })
      .eq("id", affiliate.id);

    // 11. 更新推薦記錄的累計佣金
    await supabase
      .from("referrals")
      .update({
        total_commission_generated:
          parseFloat((referral.total_commission_generated ?? 0).toString()) +
          commissionAmount,
      })
      .eq("id", referral.id);

    // 12. 記錄追蹤事件（使用 referral_tracking_logs）
    await supabase.from("referral_tracking_logs").insert({
      referral_code: referralCode,
      event_type: "payment",
      company_id: paymentOrder.company_id,
      metadata: {
        payment_order_id: paymentOrder.id,
        commission_id: commission.id,
        commission_amount: commissionAmount,
        net_commission: netCommission,
      },
    });

    console.log(
      `✅ 佣金計算成功: ${referralCode} - NT$${netCommission.toFixed(2)} (訂單 ${paymentOrder.id})`,
    );

    return {
      success: true,
      commission_id: commission.id,
      message: "佣金計算成功",
    };
  } catch (error) {
    console.error("佣金計算錯誤:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "未知錯誤",
    };
  }
}

/**
 * 檢查並更新不活躍的聯盟夥伴
 * （由 Cron Job 呼叫）
 *
 * 注意：目前資料庫沒有 last_active_payment_at 欄位，
 * 這個功能需要透過查詢 affiliate_commissions 來判斷最後活動時間
 */
export async function checkInactiveAffiliates(
  supabaseUrl: string,
  supabaseServiceKey: string,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // 查詢所有活躍的聯盟夥伴
  const { data: affiliates, error } = await supabase
    .from("affiliates")
    .select("id, company_id")
    .eq("status", "active");

  if (error) {
    console.error("查詢活躍聯盟夥伴失敗:", error);
    return;
  }

  if (!affiliates || affiliates.length === 0) {
    console.log("沒有活躍的聯盟夥伴需要檢查");
    return;
  }

  const inactiveIds: string[] = [];

  // 檢查每個聯盟夥伴的最後佣金記錄時間
  for (const affiliate of affiliates) {
    const { data: lastCommission } = await supabase
      .from("affiliate_commissions")
      .select("earned_at")
      .eq("affiliate_id", affiliate.id)
      .order("earned_at", { ascending: false })
      .limit(1)
      .single();

    // 如果沒有佣金記錄，或最後佣金超過 3 個月，標記為不活躍
    if (
      !lastCommission ||
      new Date(lastCommission.earned_at) < threeMonthsAgo
    ) {
      inactiveIds.push(affiliate.id);
    }
  }

  if (inactiveIds.length > 0) {
    const { error: updateError } = await supabase
      .from("affiliates")
      .update({
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .in("id", inactiveIds);

    if (updateError) {
      console.error("更新不活躍聯盟夥伴失敗:", updateError);
    } else {
      console.log(`✅ 已將 ${inactiveIds.length} 個聯盟夥伴設為不活躍`);
    }
  } else {
    console.log("沒有需要設為不活躍的聯盟夥伴");
  }
}
