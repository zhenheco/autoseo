export interface ReferralCode {
  id: string;
  company_id: string;
  code: string;
  referral_code?: string;
  total_clicks: number | null;
  total_referrals: number | null;
  successful_referrals: number | null;
  created_at: string | null;
}

export interface Referral {
  id: string;
  referrer_company_id: string;
  referred_company_id: string;
  referral_code: string;
  status: "pending" | "qualified" | "rewarded" | null;
  registered_at: string | null;
  first_payment_at: string | null;
  first_payment_amount: number | null;
  reward_type: string | null;
  tokens_rewarded: number | null;
  total_payments: number | null;
  lifetime_value: number | null;
  total_commission_generated: number | null;
  last_payment_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  referred_email?: string | null;
}

export interface AffiliateTier {
  id: number;
  tier_level: number;
  tier_name: string;
  tier_name_en: string;
  min_referrals: number;
  max_referrals: number | null;
  commission_rate: number;
  created_at: string | null;
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
  is_resident: boolean | null;
  tax_rate: number | null;
  current_tier: number | null;
  qualified_referrals: number | null;
  commission_rate: number | null;
  pending_commission: number | null;
  available_commission: number | null;
  withdrawn_commission: number | null;
  lifetime_commission: number | null;
  status: "active" | "inactive" | "suspended" | "terminated" | null;
  created_at: string | null;
  updated_at: string | null;
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
  earned_at: string | null;
  unlock_at: string;
  status: "locked" | "available" | "withdrawn" | "cancelled" | null;
  withdrawal_id: string | null;
  withdrawn_at: string | null;
  created_at: string | null;
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
    | "cancelled"
    | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  completed_at: string | null;
  commission_ids: unknown[] | null;
  created_at: string | null;
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
  created_at: string | null;
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
  created_at: string | null;
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
  created_at: string | null;
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

export const REFERRAL_CREDIT_REWARD = 10000;

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

export const COMMISSION_RATE = 20;
export const LOCK_PERIOD_DAYS = 30;
export const COMMISSION_LOCK_DAYS = 30;
export const MIN_WITHDRAWAL_AMOUNT = 1000;
export const RESIDENT_TAX_RATE = 10;
export const NON_RESIDENT_TAX_RATE = 20;

export const BANK_CODES = {
  "004": "台灣銀行",
  "005": "土地銀行",
  "006": "合作金庫",
  "007": "第一銀行",
  "008": "華南銀行",
  "009": "彰化銀行",
  "011": "上海商銀",
  "012": "台北富邦",
  "013": "國泰世華",
  "017": "兆豐銀行",
  "021": "花旗銀行",
  "050": "台灣企銀",
  "103": "臺灣新光商銀",
  "108": "陽信銀行",
  "147": "三信商銀",
  "803": "聯邦銀行",
  "805": "遠東銀行",
  "806": "元大銀行",
  "807": "永豐銀行",
  "808": "玉山銀行",
  "809": "凱基銀行",
  "812": "台新銀行",
  "822": "中國信託",
} as const;

export type BankCode = keyof typeof BANK_CODES;
