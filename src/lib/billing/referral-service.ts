import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface ReferralCode {
  companyId: string;
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalRewardsTokens: number;
}

export interface ReferralReward {
  id: string;
  referralId: string;
  companyId: string;
  rewardType: "signup" | "first_payment" | "revenue_share";
  tokenAmount: number | null;
  cashAmount: number | null;
  description: string;
  createdAt: string;
}

export class ReferralService {
  private supabase: ReturnType<typeof createClient<Database>>;

  private readonly REWARDS = {
    SIGNUP: 2000,
    FIRST_PAYMENT_REFERRER_PERCENT: 0.2,
    FIRST_PURCHASE_DISCOUNT: 0.8,
  };

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase;
  }

  async getReferralCode(companyId: string): Promise<ReferralCode | null> {
    const { data, error } = await this.supabase
      .from("referral_codes")
      .select("*")
      .eq("company_id", companyId)
      .single<{
        id: string;
        company_id: string;
        code: string;
        total_referrals: number;
        successful_referrals: number;
        total_clicks: number;
        created_at: string;
      }>();

    if (error || !data) {
      console.error("[ReferralService] 取得推薦碼失敗:", error);
      return null;
    }

    return {
      companyId: data.company_id,
      code: data.code,
      totalReferrals: data.total_referrals,
      successfulReferrals: data.successful_referrals,
      totalRewardsTokens: 0,
    };
  }

  async validateReferralCode(
    code: string,
  ): Promise<{ valid: boolean; companyId?: string }> {
    const { data, error } = await this.supabase
      .from("referral_codes")
      .select("company_id")
      .eq("code", code)
      .single<{ company_id: string }>();

    if (error || !data) {
      return { valid: false };
    }

    return { valid: true, companyId: data.company_id };
  }

  async createReferral(
    referrerCompanyId: string,
    referredCompanyId: string,
    referralCode: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data: existing } = await this.supabase
      .from("referrals")
      .select("id")
      .eq("referred_company_id", referredCompanyId)
      .single<{ id: string }>();

    if (existing) {
      return { success: false, error: "此公司已使用過推薦碼" };
    }

    const { data: referral, error: referralError } = await this.supabase
      .from("referrals")
      .insert({
        referrer_company_id: referrerCompanyId,
        referred_company_id: referredCompanyId,
        referral_code: referralCode,
        status: "pending",
      })
      .select()
      .single<{
        id: string;
        referrer_company_id: string;
        referred_company_id: string;
      }>();

    if (referralError) {
      console.error("[ReferralService] 建立推薦關係失敗:", referralError);
      return { success: false, error: "建立推薦關係失敗" };
    }

    await this.giveSignupReward(referral.id, referredCompanyId);

    const { data: referrerCodeData } = await this.supabase
      .from("referral_codes")
      .select("total_referrals")
      .eq("company_id", referrerCompanyId)
      .single<{ total_referrals: number }>();

    if (referrerCodeData) {
      await this.supabase
        .from("referral_codes")
        .update({ total_referrals: referrerCodeData.total_referrals + 1 })
        .eq("company_id", referrerCompanyId);
    }

    return { success: true };
  }

  private async giveSignupReward(
    referralId: string,
    referredCompanyId: string,
  ): Promise<void> {
    const signupReward = this.REWARDS.SIGNUP;

    const { data: subscription } = await this.supabase
      .from("company_subscriptions")
      .select("purchased_token_balance")
      .eq("company_id", referredCompanyId)
      .eq("status", "active")
      .single<{ purchased_token_balance: number }>();

    if (!subscription) {
      console.error("[ReferralService] 找不到被推薦者的訂閱");
      return;
    }

    const newBalance = subscription.purchased_token_balance + signupReward;

    await this.supabase
      .from("company_subscriptions")
      .update({ purchased_token_balance: newBalance })
      .eq("company_id", referredCompanyId);

    await this.supabase.from("referral_rewards").insert({
      referral_id: referralId,
      company_id: referredCompanyId,
      reward_type: "signup",
      token_amount: signupReward,
      description: "註冊獎勵",
    });

    await this.supabase.from("token_balance_changes").insert({
      company_id: referredCompanyId,
      change_type: "adjustment",
      amount: signupReward,
      balance_before: subscription.purchased_token_balance,
      balance_after: newBalance,
      reference_id: referralId,
      description: "推薦註冊獎勵",
    });
  }

  async processFirstPayment(
    referredCompanyId: string,
    paymentAmount: number,
  ): Promise<{ success: boolean }> {
    const { data: referral, error: referralError } = await this.supabase
      .from("referrals")
      .select("*")
      .eq("referred_company_id", referredCompanyId)
      .eq("status", "pending")
      .single<{
        id: string;
        referrer_company_id: string;
        referred_company_id: string;
      }>();

    if (referralError || !referral) {
      return { success: false };
    }

    const referrerRewardTokens = Math.floor(
      paymentAmount * this.REWARDS.FIRST_PAYMENT_REFERRER_PERCENT * 100,
    );

    const { data: referrerSubscription } = await this.supabase
      .from("company_subscriptions")
      .select("purchased_token_balance")
      .eq("company_id", referral.referrer_company_id)
      .eq("status", "active")
      .single<{ purchased_token_balance: number }>();

    if (referrerSubscription) {
      const newBalance =
        referrerSubscription.purchased_token_balance + referrerRewardTokens;

      await this.supabase
        .from("company_subscriptions")
        .update({ purchased_token_balance: newBalance })
        .eq("company_id", referral.referrer_company_id);

      await this.supabase.from("referral_rewards").insert({
        referral_id: referral.id,
        company_id: referral.referrer_company_id,
        reward_type: "first_payment",
        token_amount: referrerRewardTokens,
        cash_amount: paymentAmount,
        description: `推薦用戶首次付費 NT$ ${paymentAmount}`,
      });

      await this.supabase.from("token_balance_changes").insert({
        company_id: referral.referrer_company_id,
        change_type: "adjustment",
        amount: referrerRewardTokens,
        balance_before: referrerSubscription.purchased_token_balance,
        balance_after: newBalance,
        reference_id: referral.id,
        description: "推薦首購獎勵",
      });

      const { data: currentCodeData } = await this.supabase
        .from("referral_codes")
        .select("successful_referrals")
        .eq("company_id", referral.referrer_company_id)
        .single<{ successful_referrals: number }>();

      if (currentCodeData) {
        await this.supabase
          .from("referral_codes")
          .update({
            successful_referrals: currentCodeData.successful_referrals + 1,
          })
          .eq("company_id", referral.referrer_company_id);
      }
    }

    await this.supabase
      .from("referrals")
      .update({
        status: "qualified",
        first_payment_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    return { success: true };
  }

  async getMyReferrals(companyId: string): Promise<
    Array<{
      id: string;
      referredCompanyId: string;
      status: string;
      referredAt: string;
      firstPaymentAt: string | null;
    }>
  > {
    const { data, error } = await this.supabase
      .from("referrals")
      .select(
        "id, referred_company_id, status, registered_at, first_payment_at",
      )
      .eq("referrer_company_id", companyId)
      .order("registered_at", { ascending: false });

    if (error) {
      console.error("[ReferralService] 查詢推薦列表失敗:", error);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      referredCompanyId: r.referred_company_id,
      status: r.status,
      referredAt: r.registered_at || "",
      firstPaymentAt: r.first_payment_at,
    }));
  }

  async getMyRewards(companyId: string): Promise<ReferralReward[]> {
    const { data, error } = await this.supabase
      .from("referral_rewards")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ReferralService] 查詢獎勵記錄失敗:", error);
      return [];
    }

    type ReferralRewardRow = {
      id: string;
      referral_id: string;
      company_id: string;
      reward_type: string;
      token_amount: number | null;
      cash_amount: number | null;
      description: string | null;
      created_at: string | null;
    };

    return ((data || []) as ReferralRewardRow[]).map((r) => ({
      id: r.id,
      referralId: r.referral_id,
      companyId: r.company_id,
      rewardType: r.reward_type as "signup" | "first_payment" | "revenue_share",
      tokenAmount: r.token_amount,
      cashAmount: r.cash_amount ? Number(r.cash_amount) : null,
      description: r.description || "",
      createdAt: r.created_at || "",
    }));
  }

  getFirstPurchaseDiscount(): number {
    return this.REWARDS.FIRST_PURCHASE_DISCOUNT;
  }
}
