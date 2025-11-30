export interface ReferralCode {
  id: string;
  company_id: string;
  code: string;
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  total_clicks: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_company_id: string;
  referred_company_id: string;
  referral_code: string;
  status: "pending" | "qualified" | "rewarded";
  registered_at: string;
  first_payment_at: string | null;
  rewarded_at: string | null;
  created_at: string;
}

export interface AffiliateTier {
  id: number;
  tier_level: number;
  tier_name: string;
  tier_name_en: string;
  min_referrals: number;
  max_referrals: number | null;
  commission_rate: number;
  created_at: string;
}

export interface Affiliate {
  id: string;
  company_id: string;
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  address: string | null;
  bank_code: string | null;
  bank_branch: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  is_resident: boolean;
  tax_rate: number;
  current_tier: number;
  qualified_referrals: number;
  commission_rate: number;
  pending_commission: number;
  available_commission: number;
  withdrawn_commission: number;
  lifetime_commission: number;
  status: "active" | "inactive" | "suspended" | "terminated";
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  referral_id: string;
  payment_order_id: string | null;
  order_amount: number;
  order_type: string;
  tier_level: number;
  commission_rate: number;
  commission_amount: number;
  tax_rate: number;
  tax_amount: number;
  net_commission: number;
  earned_at: string;
  unlock_at: string;
  status: "locked" | "available" | "withdrawn" | "cancelled";
  withdrawal_id: string | null;
  withdrawn_at: string | null;
  created_at: string;
}

export interface AffiliateWithdrawal {
  id: string;
  affiliate_id: string;
  withdrawal_amount: number;
  tax_amount: number;
  net_amount: number;
  bank_code: string;
  bank_branch: string | null;
  bank_account: string;
  bank_account_name: string;
  status:
    | "pending"
    | "reviewing"
    | "approved"
    | "processing"
    | "completed"
    | "rejected"
    | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  completed_at: string | null;
  commission_ids: string[] | null;
  created_at: string;
}

export interface ReferralTokenReward {
  id: string;
  referral_id: string;
  referrer_company_id: string;
  referrer_tokens: number;
  referrer_credited_at: string | null;
  referred_company_id: string;
  referred_tokens: number;
  referred_credited_at: string | null;
  created_at: string;
}

export interface ReferralTrackingLog {
  id: string;
  referral_code: string;
  event_type: "click" | "register" | "payment";
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  landing_page: string | null;
  company_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AffiliateTierHistory {
  id: string;
  affiliate_id: string;
  previous_tier: number | null;
  new_tier: number;
  previous_rate: number | null;
  new_rate: number;
  qualified_referrals: number;
  trigger_reason: string;
  created_at: string;
}

export interface ReferralStats {
  referralCode: string;
  referralUrl: string;
  totalClicks: number;
  totalReferrals: number;
  successfulReferrals: number;
  conversionRate: number;
  totalTokensEarned: number;
}

export interface AffiliateStats {
  currentTier: AffiliateTier;
  qualifiedReferrals: number;
  nextTier: AffiliateTier | null;
  referralsToNextTier: number;
  pendingCommission: number;
  availableCommission: number;
  withdrawnCommission: number;
  lifetimeCommission: number;
}

export interface AffiliateApplyForm {
  full_name: string;
  id_number: string;
  phone: string;
  email: string;
  address?: string;
  bank_code?: string;
  bank_branch?: string;
  bank_account?: string;
  bank_account_name?: string;
  is_resident: boolean;
}

export const REFERRAL_TOKEN_REWARD = 10000;

export const AFFILIATE_TIERS: AffiliateTier[] = [
  {
    id: 1,
    tier_level: 1,
    tier_name: "銅牌",
    tier_name_en: "Bronze",
    min_referrals: 0,
    max_referrals: 5,
    commission_rate: 15,
    created_at: "",
  },
  {
    id: 2,
    tier_level: 2,
    tier_name: "銀牌",
    tier_name_en: "Silver",
    min_referrals: 6,
    max_referrals: 15,
    commission_rate: 20,
    created_at: "",
  },
  {
    id: 3,
    tier_level: 3,
    tier_name: "金牌",
    tier_name_en: "Gold",
    min_referrals: 16,
    max_referrals: 30,
    commission_rate: 25,
    created_at: "",
  },
  {
    id: 4,
    tier_level: 4,
    tier_name: "白金",
    tier_name_en: "Platinum",
    min_referrals: 31,
    max_referrals: null,
    commission_rate: 30,
    created_at: "",
  },
];

export const COMMISSION_LOCK_DAYS = 30;
export const MIN_WITHDRAWAL_AMOUNT = 1000;
export const RESIDENT_TAX_RATE = 10;
export const NON_RESIDENT_TAX_RATE = 20;
