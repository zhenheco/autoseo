import { createAdminClient } from "@/lib/supabase/server";
import {
  type Affiliate,
  type AffiliateTier,
  type AffiliateCommission,
  type AffiliateStats,
  type AffiliateApplyForm,
  AFFILIATE_TIERS,
} from "@/types/referral.types";

export async function getAffiliate(
  companyId: string,
): Promise<Affiliate | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Affiliate;
}

export async function applyForAffiliate(
  companyId: string,
  form: AffiliateApplyForm,
): Promise<{ success: boolean; error?: string; affiliate?: Affiliate }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("affiliates")
    .select("id, status")
    .eq("company_id", companyId)
    .single();

  if (existing) {
    if (existing.status === "active") {
      return { success: false, error: "already_affiliate" };
    }
    if (existing.status === "suspended" || existing.status === "terminated") {
      return { success: false, error: "account_blocked" };
    }
  }

  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("plan_id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .single();

  if (!subscription) {
    return { success: false, error: "no_subscription" };
  }

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("slug")
    .eq("id", subscription.plan_id)
    .single();

  if (!plan || plan.slug === "free") {
    return { success: false, error: "paid_plan_required" };
  }

  const taxRate = form.is_resident ? 10 : 20;

  const { data: tierData } = await supabase
    .from("affiliate_tiers")
    .select("*")
    .eq("tier_level", 1)
    .single();

  const initialTier = tierData || { tier_level: 1, commission_rate: 15 };

  const { data: affiliate, error } = await supabase
    .from("affiliates")
    .insert({
      company_id: companyId,
      full_name: form.full_name,
      id_number: form.id_number,
      phone: form.phone,
      email: form.email,
      address: form.address || null,
      bank_code: form.bank_code || null,
      bank_branch: form.bank_branch || null,
      bank_account: form.bank_account || null,
      bank_account_name: form.bank_account_name || null,
      is_resident: form.is_resident,
      tax_rate: taxRate,
      current_tier: initialTier.tier_level,
      commission_rate: initialTier.commission_rate,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create affiliate:", error);
    return { success: false, error: "creation_failed" };
  }

  return { success: true, affiliate: affiliate as Affiliate };
}

export async function getAffiliateStats(
  companyId: string,
): Promise<AffiliateStats | null> {
  const supabase = createAdminClient();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!affiliate) {
    return null;
  }

  const { data: tiers } = await supabase
    .from("affiliate_tiers")
    .select("*")
    .order("tier_level", { ascending: true });

  const effectiveTiers = tiers && tiers.length > 0 ? tiers : AFFILIATE_TIERS;

  const currentTier =
    effectiveTiers.find((t) => t.tier_level === affiliate.current_tier) ||
    effectiveTiers[0];
  const nextTier =
    effectiveTiers.find((t) => t.tier_level === affiliate.current_tier + 1) ||
    null;

  const referralsToNextTier = nextTier
    ? Math.max(0, nextTier.min_referrals - affiliate.qualified_referrals)
    : 0;

  return {
    currentTier: currentTier as AffiliateTier,
    qualifiedReferrals: affiliate.qualified_referrals,
    nextTier: nextTier as AffiliateTier | null,
    referralsToNextTier,
    pendingCommission: affiliate.pending_commission,
    availableCommission: affiliate.available_commission,
    withdrawnCommission: affiliate.withdrawn_commission,
    lifetimeCommission: affiliate.lifetime_commission,
  };
}

export async function getAffiliateCommissions(
  affiliateId: string,
  status?: string,
): Promise<AffiliateCommission[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("affiliate_commissions")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("earned_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data } = await query;

  return (data || []) as AffiliateCommission[];
}

export async function processAffiliateCommission(
  referralId: string,
  paymentAmount: number,
  orderType: string,
  paymentOrderId?: string,
): Promise<{ success: boolean; commissionAmount?: number }> {
  const supabase = createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("*, referral_codes!inner(company_id)")
    .eq("id", referralId)
    .single();

  if (!referral || referral.reward_type !== "commission") {
    return { success: false };
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("*")
    .eq("company_id", referral.referrer_company_id)
    .eq("status", "active")
    .single();

  if (!affiliate) {
    return { success: false };
  }

  const commissionRate = affiliate.commission_rate / 100;
  const grossCommission = paymentAmount * commissionRate;
  const taxRate = affiliate.tax_rate / 100;
  const taxAmount = grossCommission * taxRate;
  const netCommission = grossCommission - taxAmount;

  const earnedAt = new Date();
  const unlockAt = new Date();
  unlockAt.setDate(unlockAt.getDate() + 30);

  const { error: commissionError } = await supabase
    .from("affiliate_commissions")
    .insert({
      affiliate_id: affiliate.id,
      referral_id: referralId,
      payment_order_id: paymentOrderId || null,
      order_amount: paymentAmount,
      order_type: orderType,
      tier_level: affiliate.current_tier,
      commission_rate: affiliate.commission_rate,
      commission_amount: grossCommission,
      tax_rate: affiliate.tax_rate,
      tax_amount: taxAmount,
      net_commission: netCommission,
      earned_at: earnedAt.toISOString(),
      unlock_at: unlockAt.toISOString(),
      status: "locked",
    });

  if (commissionError) {
    console.error("Failed to create commission:", commissionError);
    return { success: false };
  }

  await supabase
    .from("affiliates")
    .update({
      pending_commission: affiliate.pending_commission + netCommission,
      lifetime_commission: affiliate.lifetime_commission + netCommission,
    })
    .eq("id", affiliate.id);

  await supabase
    .from("referrals")
    .update({
      total_payments: referral.total_payments + 1,
      lifetime_value: referral.lifetime_value + paymentAmount,
      total_commission_generated:
        referral.total_commission_generated + netCommission,
      last_payment_at: new Date().toISOString(),
    })
    .eq("id", referralId);

  await supabase.rpc("update_affiliate_tier", { p_affiliate_id: affiliate.id });

  return { success: true, commissionAmount: netCommission };
}

export async function getAffiliateTiers(): Promise<AffiliateTier[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("affiliate_tiers")
    .select("*")
    .order("tier_level", { ascending: true });

  return (data || []) as AffiliateTier[];
}

export async function updateAffiliateProfile(
  affiliateId: string,
  updates: Partial<
    Pick<
      Affiliate,
      | "bank_code"
      | "bank_branch"
      | "bank_account"
      | "bank_account_name"
      | "address"
      | "phone"
      | "email"
    >
  >,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("affiliates")
    .update(updates)
    .eq("id", affiliateId);

  if (error) {
    return { success: false, error: "update_failed" };
  }

  return { success: true };
}
