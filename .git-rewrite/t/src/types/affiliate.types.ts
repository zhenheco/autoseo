/**
 * 聯盟行銷系統類型定義
 */

// =====================================================
// 1. 聯盟夥伴
// =====================================================
export type AffiliateStatus = 'active' | 'inactive' | 'suspended' | 'terminated'

export interface Affiliate {
  id: string
  company_id: string
  affiliate_code: string

  // 基本資料
  full_name: string
  id_number: string
  phone: string
  email: string
  address: string

  // 銀行帳戶資訊
  bank_code: string | null
  bank_branch: string | null
  bank_account: string | null
  bank_account_name: string | null

  // 稅務資訊
  is_resident: boolean
  tax_rate: number
  tax_id_verified: boolean

  // 證件上傳
  id_document_url: string | null
  bank_document_url: string | null
  tax_document_url: string | null
  documents_verified: boolean
  documents_verified_at: string | null

  // 佣金統計
  total_referrals: number
  active_referrals: number
  pending_commission: number
  locked_commission: number
  withdrawn_commission: number
  lifetime_commission: number

  // 活躍狀態追蹤
  last_referral_at: string | null
  last_active_payment_at: string | null
  inactive_since: string | null

  // 狀態
  status: AffiliateStatus

  // 審核資訊
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null

  // 備註
  notes: string | null

  created_at: string
  updated_at: string
}

export interface AffiliateInsert {
  company_id: string
  affiliate_code: string
  full_name: string
  id_number: string
  phone: string
  email: string
  address: string
  is_resident?: boolean
  tax_rate?: number
  bank_code?: string
  bank_branch?: string
  bank_account?: string
  bank_account_name?: string
}

export interface AffiliateUpdate {
  full_name?: string
  phone?: string
  email?: string
  address?: string
  bank_code?: string
  bank_branch?: string
  bank_account?: string
  bank_account_name?: string
  id_document_url?: string
  bank_document_url?: string
  tax_document_url?: string
  status?: AffiliateStatus
  notes?: string
}

// =====================================================
// 2. 推薦記錄
// =====================================================
export interface AffiliateReferral {
  id: string
  affiliate_id: string
  referred_company_id: string
  affiliate_code: string

  // 追蹤資訊
  referral_source: string | null
  user_agent: string | null
  ip_address: string | null

  // 轉換追蹤
  registered_at: string
  first_payment_at: string | null
  first_payment_amount: number | null

  // 生命週期價值
  total_payments: number
  lifetime_value: number
  total_commission_generated: number

  // 活躍狀態
  last_payment_at: string | null
  is_active: boolean
  cancelled_at: string | null

  created_at: string
  updated_at: string
}

export interface AffiliateReferralInsert {
  affiliate_id: string
  referred_company_id: string
  affiliate_code: string
  referral_source?: string
  user_agent?: string
  ip_address?: string
}

// =====================================================
// 3. 佣金記錄
// =====================================================
export type CommissionStatus = 'locked' | 'available' | 'withdrawn' | 'cancelled'

export interface AffiliateCommission {
  id: string
  affiliate_id: string
  referral_id: string
  payment_order_id: string
  mandate_id: string | null

  // 訂單資訊
  order_amount: number
  commission_rate: number
  commission_amount: number

  // 扣繳稅款
  tax_rate: number
  tax_amount: number
  net_commission: number

  // 鎖定期管理
  earned_at: string
  unlock_at: string

  // 狀態
  status: CommissionStatus

  // 提領關聯
  withdrawal_id: string | null
  withdrawn_at: string | null

  // 取消原因
  cancelled_at: string | null
  cancel_reason: string | null

  created_at: string
  updated_at: string
}

export interface AffiliateCommissionInsert {
  affiliate_id: string
  referral_id: string
  payment_order_id: string
  mandate_id?: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  tax_rate: number
  tax_amount: number
  net_commission: number
  earned_at: string
  unlock_at: string
}

// =====================================================
// 4. 提領申請
// =====================================================
export type WithdrawalStatus =
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export interface AffiliateWithdrawal {
  id: string
  affiliate_id: string

  // 提領金額
  withdrawal_amount: number
  tax_amount: number
  net_amount: number

  // 銀行資訊快照
  bank_code: string
  bank_branch: string | null
  bank_account: string
  bank_account_name: string

  // 證件上傳
  requires_documents: boolean
  id_document_url: string | null
  bank_document_url: string | null
  tax_document_url: string | null

  // 審核狀態
  status: WithdrawalStatus

  // 審核資訊
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  admin_notes: string | null

  // 撥款資訊
  payout_method: 'bank_transfer' | 'newebpay'
  payout_batch_id: string | null
  payout_reference: string | null
  processed_at: string | null
  completed_at: string | null

  // 佣金明細
  commission_ids: string[] | null

  created_at: string
  updated_at: string
}

export interface AffiliateWithdrawalInsert {
  affiliate_id: string
  withdrawal_amount: number
  tax_amount: number
  net_amount: number
  bank_code: string
  bank_branch?: string
  bank_account: string
  bank_account_name: string
  requires_documents?: boolean
  id_document_url?: string
  bank_document_url?: string
  tax_document_url?: string
  commission_ids?: string[]
}

// =====================================================
// 5. 追蹤日誌
// =====================================================
export type TrackingEventType = 'click' | 'visit' | 'register' | 'payment'

export interface AffiliateTrackingLog {
  id: string
  affiliate_code: string
  event_type: TrackingEventType

  session_id: string | null
  ip_address: string | null
  user_agent: string | null
  referer: string | null

  company_id: string | null
  user_id: string | null

  metadata: Record<string, any> | null

  created_at: string
}

// =====================================================
// 6. 前端使用的組合類型
// =====================================================

// 聯盟夥伴儀表板統計
export interface AffiliateDashboardStats {
  totalReferrals: number
  activeReferrals: number
  pendingCommission: number
  lockedCommission: number
  withdrawnCommission: number
  lifetimeCommission: number
  conversionRate: number // 轉換率
  averageOrderValue: number // 平均訂單價值
  lastPaymentDate: string | null
}

// 推薦連結資訊
export interface AffiliateLink {
  code: string
  fullUrl: string
  qrCodeUrl: string
  clicks: number
  conversions: number
}

// 佣金明細（含推薦客戶資訊）
export interface CommissionWithDetails extends AffiliateCommission {
  referral: AffiliateReferral & {
    company_name: string
  }
}

// 提領申請（含佣金明細）
export interface WithdrawalWithCommissions extends AffiliateWithdrawal {
  commissions: CommissionWithDetails[]
}

// =====================================================
// 7. API 請求/響應類型
// =====================================================

// 申請成為聯盟夥伴
export interface ApplyAffiliateRequest {
  full_name: string
  id_number: string
  phone: string
  email: string
  address: string
  is_resident: boolean
  agree_terms: boolean
}

export interface ApplyAffiliateResponse {
  success: boolean
  affiliate_code?: string
  message?: string
}

// 生成推薦連結
export interface GenerateLinkResponse {
  code: string
  link: string
  qr_code: string
}

// 提領申請
export interface WithdrawRequest {
  amount: number
  bank_code: string
  bank_branch?: string
  bank_account: string
  bank_account_name: string
  id_document?: File
  bank_document?: File
  tax_document?: File
}

export interface WithdrawResponse {
  success: boolean
  withdrawal_id?: string
  message?: string
}

// 統計數據查詢
export interface AffiliateStatsQuery {
  start_date?: string
  end_date?: string
  group_by?: 'day' | 'week' | 'month'
}

export interface AffiliateStatsResponse {
  stats: AffiliateDashboardStats
  chart_data: {
    date: string
    referrals: number
    commission: number
  }[]
}

// =====================================================
// 8. 表單驗證類型
// =====================================================

export interface AffiliateFormErrors {
  full_name?: string
  id_number?: string
  phone?: string
  email?: string
  address?: string
  bank_code?: string
  bank_account?: string
  bank_account_name?: string
  agree_terms?: string
}

// =====================================================
// 9. 常數
// =====================================================

export const COMMISSION_RATE = 20 // 20%
export const LOCK_PERIOD_DAYS = 30 // 30天鎖定期
export const MIN_WITHDRAWAL_AMOUNT = 1000 // NT$1,000
export const INACTIVE_PERIOD_MONTHS = 3 // 3個月無活動

export const RESIDENT_TAX_RATE = 10 // 境內居住者 10%
export const NON_RESIDENT_TAX_RATE = 20 // 非境內居住者 20%
export const TAX_THRESHOLD = 20000 // 年度 NT$20,000 以上需扣繳

// 銀行代碼對照（台灣主要銀行）
export const BANK_CODES = {
  '004': '台灣銀行',
  '005': '土地銀行',
  '006': '合作金庫',
  '007': '第一銀行',
  '008': '華南銀行',
  '009': '彰化銀行',
  '011': '上海商銀',
  '012': '台北富邦',
  '013': '國泰世華',
  '017': '兆豐銀行',
  '021': '花旗銀行',
  '050': '台灣企銀',
  '103': '臺灣新光商銀',
  '108': '陽信銀行',
  '147': '三信商銀',
  '803': '聯邦銀行',
  '805': '遠東銀行',
  '806': '元大銀行',
  '807': '永豐銀行',
  '808': '玉山銀行',
  '809': '凱基銀行',
  '812': '台新銀行',
  '822': '中國信託',
} as const

export type BankCode = keyof typeof BANK_CODES
