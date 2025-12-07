/**
 * 推薦系統反詐騙機制型別定義
 */

// =====================================================
// 可疑類型
// =====================================================
export type SuspicionType =
  | "same_device" // 同裝置多帳號
  | "referral_loop" // 推薦環路 (A->B->C->A)
  | "rapid_referrals" // 短時間大量推薦
  | "quick_cancel"; // 推薦後快速取消訂閱

// =====================================================
// 嚴重程度
// =====================================================
export type SeverityLevel =
  | "low" // 2 個帳號同裝置
  | "medium" // 3-4 個帳號同裝置 或 一般可疑模式
  | "high" // 5+ 個帳號同裝置 或 嚴重可疑模式
  | "critical"; // 同裝置且在推薦鏈中

// =====================================================
// 審核狀態
// =====================================================
export type ReviewStatus =
  | "pending" // 待審核
  | "reviewing" // 審核中
  | "confirmed_fraud" // 確認詐騙
  | "false_positive" // 誤判（正常）
  | "dismissed"; // 已忽略

// =====================================================
// 採取的行動
// =====================================================
export type ActionTaken =
  | "none" // 無
  | "reward_cancelled" // 取消獎勵
  | "account_suspended" // 帳號暫停
  | "account_terminated"; // 帳號終止

// =====================================================
// 裝置指紋
// =====================================================
export interface DeviceFingerprint {
  id: string;
  fingerprint_hash: string;
  fingerprint_components: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  total_accounts: number;
  created_at: string;
}

// =====================================================
// 裝置指紋與帳號關聯
// =====================================================
export interface DeviceFingerprintAccount {
  id: string;
  fingerprint_id: string;
  company_id: string;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

// =====================================================
// 可疑推薦記錄
// =====================================================
export interface SuspiciousReferral {
  id: string;
  referral_id: string | null;
  referrer_company_id: string;
  referred_company_id: string | null;
  suspicion_type: SuspicionType;
  severity: SeverityLevel;
  evidence: SuspicionEvidence;
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  action_taken: ActionTaken | null;
  action_taken_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// 證據結構
// =====================================================
export interface SuspicionEvidence {
  // 同裝置偵測
  fingerprint_hash?: string;
  related_accounts?: string[];
  account_count?: number;

  // 推薦環路偵測
  loop_chain?: string[];
  loop_length?: number;

  // 快速推薦偵測
  referral_count?: number;
  time_window_hours?: number;

  // 快速取消偵測
  cancel_count?: number;
  cancel_within_days?: number;

  // 額外資訊
  detection_time?: string;
  ip_address?: string;
  user_agent?: string;
}

// =====================================================
// 詐騙檢查結果
// =====================================================
export interface FraudCheckResult {
  isSuspicious: boolean;
  suspicions: FraudSuspicion[];
}

export interface FraudSuspicion {
  type: SuspicionType;
  severity: SeverityLevel;
  evidence: SuspicionEvidence;
}

// =====================================================
// 同裝置偵測結果
// =====================================================
export interface SameDeviceCheckResult {
  isSuspicious: boolean;
  accountCount: number;
  relatedAccounts: string[];
  severity: SeverityLevel;
  fingerprintHash: string;
}

// =====================================================
// 推薦環路偵測結果
// =====================================================
export interface ReferralLoopCheckResult {
  isLoop: boolean;
  loopChain: string[];
  loopLength: number;
}

// =====================================================
// 異常模式偵測結果
// =====================================================
export interface AbnormalPatternCheckResult {
  rapidReferrals: boolean;
  quickCancellations: boolean;
  referralCount?: number;
  cancelCount?: number;
  details: Record<string, unknown>;
}

// =====================================================
// API 請求/回應
// =====================================================
export interface SuspiciousReferralListRequest {
  status?: ReviewStatus;
  suspicion_type?: SuspicionType;
  severity?: SeverityLevel;
  page?: number;
  limit?: number;
}

export interface SuspiciousReferralListResponse {
  data: SuspiciousReferralWithDetails[];
  total: number;
  page: number;
  limit: number;
}

export interface SuspiciousReferralWithDetails extends SuspiciousReferral {
  referrer_company?: {
    id: string;
    name: string;
  };
  referred_company?: {
    id: string;
    name: string;
  } | null;
  referral?: {
    id: string;
    referral_code: string;
    status: string;
  } | null;
}

export interface UpdateSuspiciousReferralRequest {
  status: ReviewStatus;
  review_notes?: string;
  action_taken?: ActionTaken;
}

// =====================================================
// 指紋收集請求
// =====================================================
export interface FingerprintSubmitRequest {
  fingerprint_hash: string;
  fingerprint_components?: Record<string, unknown>;
  referral_code?: string;
  event_type: "click" | "register" | "login";
}
