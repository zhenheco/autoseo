import { createAdminClient } from "@/lib/supabase/server";
import type {
  ReferralCode,
  Referral,
  ReferralStats,
  ReferralTokenReward,
  REFERRAL_TOKEN_REWARD,
} from "@/types/referral.types";

export async function generateReferralCode(
  companyId: string,
): Promise<ReferralCode | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (existing) {
    return {
      ...existing,
      referral_code: existing.code,
    } as ReferralCode;
  }

  const { data, error } = await supabase.rpc("generate_referral_code");

  if (error || !data) {
    console.error("Failed to generate referral code:", error);
    return null;
  }

  const { data: newCode, error: insertError } = await supabase
    .from("referral_codes")
    .insert({
      company_id: companyId,
      code: data,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert referral code:", insertError);
    return null;
  }

  return {
    ...newCode,
    referral_code: newCode.code,
  } as ReferralCode;
}

export async function getReferralCode(
  companyId: string,
): Promise<ReferralCode | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error) {
    return null;
  }

  return {
    ...data,
    referral_code: data.code,
  } as ReferralCode;
}

export async function validateReferralCode(
  code: string,
): Promise<{ valid: boolean; companyId?: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("referral_codes")
    .select("company_id")
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) {
    return { valid: false };
  }

  return { valid: true, companyId: data.company_id };
}

export async function recordReferralClick(
  code: string,
  metadata?: {
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    referer?: string;
    landingPage?: string;
  },
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from("referral_tracking_logs").insert({
    referral_code: code.toUpperCase(),
    event_type: "click",
    session_id: metadata?.sessionId,
    ip_address: metadata?.ipAddress,
    user_agent: metadata?.userAgent,
    referer: metadata?.referer,
    landing_page: metadata?.landingPage,
  });

  await supabase.rpc("increment_referral_clicks", {
    p_code: code.toUpperCase(),
  });
}

export async function createReferralRelationship(
  referrerCode: string,
  referredCompanyId: string,
): Promise<Referral | null> {
  const supabase = createAdminClient();

  const { data: existingReferral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_company_id", referredCompanyId)
    .single();

  if (existingReferral) {
    return existingReferral as Referral;
  }

  const validation = await validateReferralCode(referrerCode);
  if (!validation.valid || !validation.companyId) {
    return null;
  }

  if (validation.companyId === referredCompanyId) {
    return null;
  }

  const { data, error } = await supabase
    .from("referrals")
    .insert({
      referrer_company_id: validation.companyId,
      referred_company_id: referredCompanyId,
      referral_code: referrerCode.toUpperCase(),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create referral relationship:", error);
    return null;
  }

  await supabase.rpc("increment_referral_count", {
    p_code: referrerCode.toUpperCase(),
  });

  await supabase.from("referral_tracking_logs").insert({
    referral_code: referrerCode.toUpperCase(),
    event_type: "register",
    company_id: referredCompanyId,
  });

  return data as Referral;
}

export async function getReferralStats(
  companyId: string,
): Promise<ReferralStats | null> {
  const supabase = createAdminClient();

  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!referralCode) {
    return null;
  }

  const { data: tokenRewards } = await supabase
    .from("referral_token_rewards")
    .select("referrer_tokens")
    .eq("referrer_company_id", companyId)
    .not("referrer_credited_at", "is", null);

  const totalTokensEarned =
    tokenRewards?.reduce((sum, r) => sum + (r.referrer_tokens || 0), 0) || 0;

  const conversionRate =
    referralCode.total_referrals > 0
      ? (referralCode.successful_referrals / referralCode.total_referrals) * 100
      : 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";

  return {
    referralCode: referralCode.code,
    referralUrl: `${baseUrl}/r/${referralCode.code}`,
    totalClicks: referralCode.total_clicks || 0,
    totalReferrals: referralCode.total_referrals,
    successfulReferrals: referralCode.successful_referrals,
    conversionRate: Math.round(conversionRate * 100) / 100,
    totalTokensEarned,
  };
}

export async function getReferralHistory(
  companyId: string,
): Promise<Referral[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_company_id", companyId)
    .order("created_at", { ascending: false });

  return (data || []) as Referral[];
}

export async function processFirstPaymentReward(
  referredCompanyId: string,
  paymentAmount: number,
): Promise<{ success: boolean; rewardType?: "tokens" | "commission" }> {
  const supabase = createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_company_id", referredCompanyId)
    .eq("status", "pending")
    .single();

  if (!referral) {
    return { success: false };
  }

  const referrerCompanyId = referral.referrer_company_id;

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, status")
    .eq("company_id", referrerCompanyId)
    .eq("status", "active")
    .single();

  const rewardType: "tokens" | "commission" = affiliate
    ? "commission"
    : "tokens";

  const { error: updateError } = await supabase
    .from("referrals")
    .update({
      status: "qualified",
      first_payment_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  if (updateError) {
    console.error("Failed to update referral status:", updateError);
    return { success: false };
  }

  await supabase.rpc("increment_successful_referrals", {
    p_code: referral.referral_code,
  });

  await supabase.from("referral_tracking_logs").insert({
    referral_code: referral.referral_code,
    event_type: "payment",
    company_id: referredCompanyId,
    metadata: { amount: paymentAmount, reward_type: rewardType },
  });

  if (rewardType === "tokens") {
    await processTokenReward(referral.id, referrerCompanyId, referredCompanyId);
  }

  return { success: true, rewardType };
}

async function processTokenReward(
  referralId: string,
  referrerCompanyId: string,
  referredCompanyId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const tokenAmount = 10000;

  const { data: existingReward } = await supabase
    .from("referral_token_rewards")
    .select("id")
    .eq("referral_id", referralId)
    .single();

  if (existingReward) {
    return;
  }

  await supabase.from("referral_token_rewards").insert({
    referral_id: referralId,
    referrer_company_id: referrerCompanyId,
    referrer_tokens: tokenAmount,
    referred_company_id: referredCompanyId,
    referred_tokens: tokenAmount,
  });

  await supabase.rpc("add_company_tokens", {
    p_company_id: referrerCompanyId,
    p_tokens: tokenAmount,
    p_reason: "referral_reward",
  });

  await supabase
    .from("referral_token_rewards")
    .update({ referrer_credited_at: new Date().toISOString() })
    .eq("referral_id", referralId);

  await supabase.rpc("add_company_tokens", {
    p_company_id: referredCompanyId,
    p_tokens: tokenAmount,
    p_reason: "referred_reward",
  });

  await supabase
    .from("referral_token_rewards")
    .update({ referred_credited_at: new Date().toISOString() })
    .eq("referral_id", referralId);

  await supabase
    .from("referrals")
    .update({
      status: "rewarded",
      rewarded_at: new Date().toISOString(),
    })
    .eq("id", referralId);
}

export async function getMyReferrer(companyId: string): Promise<{
  hasReferrer: boolean;
  referrerCode?: string;
  status?: string;
  tokensReceived?: number;
} | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("referrals")
    .select("referral_code, status")
    .eq("referred_company_id", companyId)
    .single();

  if (!data) {
    return { hasReferrer: false };
  }

  let tokensReceived = 0;
  if (data.status === "rewarded") {
    const { data: reward } = await supabase
      .from("referral_token_rewards")
      .select("referred_tokens")
      .eq("referred_company_id", companyId)
      .not("referred_credited_at", "is", null)
      .single();

    tokensReceived = reward?.referred_tokens || 0;
  }

  return {
    hasReferrer: true,
    referrerCode: data.referral_code,
    status: data.status,
    tokensReceived,
  };
}

export async function setReferralCode(
  companyId: string,
  referralCode: string,
): Promise<{ success: boolean; error?: string }> {
  const validation = await validateReferralCode(referralCode);

  if (!validation.valid) {
    return { success: false, error: "invalid_code" };
  }

  if (validation.companyId === companyId) {
    return { success: false, error: "self_referral" };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_company_id", companyId)
    .single();

  if (existing) {
    return { success: false, error: "already_referred" };
  }

  const { data: hasPaid } = await supabase
    .from("payment_orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "success")
    .limit(1)
    .single();

  if (hasPaid) {
    return { success: false, error: "already_paid" };
  }

  const referral = await createReferralRelationship(referralCode, companyId);

  if (!referral) {
    return { success: false, error: "creation_failed" };
  }

  return { success: true };
}
