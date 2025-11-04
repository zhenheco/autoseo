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
 * 1. Starter (NT$599 月費) → starter slug → basic tier
 * 2. Professional (NT$2,499 月費) → professional slug → pro tier
 * 3. Business (NT$5,999 月費) → business slug → pro tier
 * 4. Agency (NT$11,999 月費) → agency slug → enterprise tier
 *
 * 注意：
 * - 階層順序與實際定價一致
 * - Professional 和 Business 雖然都是 pro tier，但 Business 階層較高
 * - 系統使用方案 slug 進行比較和升級判斷
 */
export const TIER_HIERARCHY: Record<string, number> = {
  // Plan slugs (subscription_plans.slug) - 修正順序
  'starter': 1,
  'professional': 2,  // 從 3 改為 2
  'business': 3,      // 從 2 改為 3
  'agency': 4,

  // Company tiers (companies.subscription_tier) - same hierarchy values
  'basic': 1,        // maps to starter
  'pro': 2,          // maps to professional/business (取較低值以允許同 tier 升級)
  'enterprise': 4,   // maps to agency
}

/**
 * 計費週期類型
 */
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime'

/**
 * 檢查目標計費週期是否比當前週期短
 *
 * @param current - 當前計費週期
 * @param target - 目標計費週期
 * @returns true 表示目標週期比當前週期短，false 表示相同或更長
 *
 * @example
 * isBillingPeriodShorter('yearly', 'monthly') // true (年→月 是縮短)
 * isBillingPeriodShorter('monthly', 'yearly') // false (月→年 是延長)
 * isBillingPeriodShorter('lifetime', 'yearly') // true (終身→年 是縮短)
 */
function isBillingPeriodShorter(
  current: BillingPeriod,
  target: BillingPeriod
): boolean {
  const periodValue: Record<BillingPeriod, number> = {
    'monthly': 1,
    'yearly': 2,
    'lifetime': 3
  }
  return periodValue[target] < periodValue[current]
}

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

  // 終身方案特殊規則
  if (currentBillingPeriod === 'lifetime') {
    // 允許升級到更高階層的終身方案
    if (targetTierLevel > currentTierLevel && targetBillingPeriod === 'lifetime') {
      return true
    }
    // 其他情況都不允許（降級或縮短週期）
    return false
  }

  // 升級到更高階層 → 檢查計費週期
  if (targetTierLevel > currentTierLevel) {
    // 計費週期不能縮短
    if (isBillingPeriodShorter(currentBillingPeriod, targetBillingPeriod)) {
      return false
    }
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

  // 終身方案特殊處理
  if (currentBillingPeriod === 'lifetime') {
    // 如果目標階層 > 當前階層但不是終身
    if (targetTierLevel > currentTierLevel && targetBillingPeriod !== 'lifetime') {
      return '終身方案不能變更為月繳或年繳'
    }
    // 如果目標階層 < 當前階層
    if (targetTierLevel < currentTierLevel) {
      return '無法降級到低階層方案'
    }
    // 如果目標階層 = 當前階層
    if (targetTierLevel === currentTierLevel) {
      return '目前方案'
    }
    return '終身方案無法變更'
  }

  // 降級
  if (targetTierLevel < currentTierLevel) {
    return '無法降級到低階層方案'
  }

  // 跨階層升級但縮短計費週期
  if (targetTierLevel > currentTierLevel) {
    if (isBillingPeriodShorter(currentBillingPeriod, targetBillingPeriod)) {
      return '跨階層升級不能縮短計費週期'
    }
    return null
  }

  // 同階層
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
