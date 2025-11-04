/**
 * 訂閱升級規則驗證函式庫
 *
 * 此模組提供統一的升級規則驗證邏輯，供前端和後端共用。
 *
 * 升級規則：
 *
 * 同階層升級：
 * - 月繳 → 年繳 ✅
 * - 月繳 → 終身 ✅
 * - 年繳 → 終身 ✅
 * - 年繳 → 月繳 ❌ (無法縮短計費週期)
 * - 終身 → 任何 ❌ (終身方案無法變更)
 *
 * 不同階層升級：
 * - 只能升級到更高階層 (Free → Starter → Business → Professional → Agency)
 * - 升級時可選擇任何計費週期
 * - 無法降級到低階層
 */

/**
 * 方案階層定義（支援 subscription_plans.slug 和 companies.subscription_tier）
 * 數字越大表示階層越高
 *
 * 實際方案階層（由低到高）：
 * 1. Starter (starter slug → basic tier)
 * 2. Business (business slug → pro tier)
 * 3. Professional (professional slug → pro tier)
 * 4. Agency (agency slug → enterprise tier)
 *
 * 注意：
 * - Professional 和 Business 都映射到 pro tier（同階層）
 * - 系統使用方案 slug 進行比較和升級判斷
 */
export const TIER_HIERARCHY: Record<string, number> = {
  // Plan slugs (subscription_plans.slug)
  'starter': 1,
  'business': 2,
  'professional': 3,
  'agency': 4,

  // Company tiers (companies.subscription_tier) - same hierarchy values
  'free': 0,         // free tier (no active subscription)
  'basic': 1,        // maps to starter
  'pro': 2,          // maps to business/professional (取較低值以允許同 tier 升級)
  'enterprise': 4,   // maps to agency
}

/**
 * 計費週期類型
 */
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime'

/**
 * 驗證訂閱方案升級是否符合業務規則
 *
 * @param currentTierSlug - 當前方案的 slug（來自 subscription_plans.slug），若為新用戶則為 null
 * @param currentBillingPeriod - 當前計費週期
 * @param targetPlanSlug - 目標方案的 slug
 * @param targetBillingPeriod - 目標計費週期
 * @returns true 表示允許升級，false 表示不允許
 *
 * @example
 * // 新用戶可以訂閱任何方案
 * canUpgrade(null, 'monthly', 'starter', 'monthly') // true
 *
 * @example
 * // 同階層：月繳可升級到年繳
 * canUpgrade('agency', 'monthly', 'agency', 'yearly') // true
 *
 * @example
 * // 同階層：年繳不能降級到月繳
 * canUpgrade('agency', 'yearly', 'agency', 'monthly') // false
 *
 * @example
 * // 不同階層：可以升級到更高階層
 * canUpgrade('starter', 'monthly', 'business', 'yearly') // true
 *
 * @example
 * // 不同階層：無法降級到低階層
 * canUpgrade('business', 'monthly', 'starter', 'monthly') // false
 *
 * @example
 * // 終身方案無法變更
 * canUpgrade('agency', 'lifetime', 'agency', 'yearly') // false
 */
export function canUpgrade(
  currentTierSlug: string | null,
  currentBillingPeriod: BillingPeriod,
  targetPlanSlug: string,
  targetBillingPeriod: BillingPeriod
): boolean {
  // 新用戶（沒有當前方案）→ 允許任何升級
  if (!currentTierSlug) {
    return true
  }

  const currentTierLevel = TIER_HIERARCHY[currentTierSlug] ?? 0
  const targetTierLevel = TIER_HIERARCHY[targetPlanSlug] ?? 0

  // 終身方案 → 不允許任何變更
  if (currentBillingPeriod === 'lifetime') {
    return false
  }

  // 升級到更高階層 → 允許（任何計費週期）
  if (targetTierLevel > currentTierLevel) {
    return true
  }

  // 同階層 → 只允許延長計費週期
  if (targetTierLevel === currentTierLevel) {
    // 月繳 → 年繳或終身 ✅
    if (currentBillingPeriod === 'monthly' &&
        (targetBillingPeriod === 'yearly' || targetBillingPeriod === 'lifetime')) {
      return true
    }
    // 年繳 → 終身 ✅
    if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'lifetime') {
      return true
    }
    return false
  }

  // 降級到低階層 → 不允許
  if (targetTierLevel < currentTierLevel) {
    return false
  }

  return false
}

/**
 * 取得升級不可行的原因（用於錯誤訊息）
 *
 * @param currentTierSlug - 當前方案的 slug
 * @param currentBillingPeriod - 當前計費週期
 * @param targetPlanSlug - 目標方案的 slug
 * @param targetBillingPeriod - 目標計費週期
 * @returns 不可升級的原因，若可升級則返回 null
 */
export function getUpgradeBlockReason(
  currentTierSlug: string | null,
  currentBillingPeriod: BillingPeriod,
  targetPlanSlug: string,
  targetBillingPeriod: BillingPeriod
): string | null {
  if (!currentTierSlug) {
    return null
  }

  const currentTierLevel = TIER_HIERARCHY[currentTierSlug] ?? 0
  const targetTierLevel = TIER_HIERARCHY[targetPlanSlug] ?? 0

  if (currentBillingPeriod === 'lifetime') {
    return '終身方案無法變更'
  }

  if (targetTierLevel < currentTierLevel) {
    return '無法降級到低階層方案'
  }

  if (targetTierLevel === currentTierLevel) {
    if (currentBillingPeriod === 'yearly' && targetBillingPeriod === 'monthly') {
      return '年繳無法變更為月繳'
    }
    if (currentBillingPeriod === targetBillingPeriod) {
      return '目前方案'
    }
    return '無法縮短計費週期'
  }

  return null
}
