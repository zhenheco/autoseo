"use client";

import { useAffiliateTracking } from "@/hooks/use-affiliate-tracking";

/**
 * Affiliate 追蹤元件
 *
 * 放在 Root Layout 中，用於追蹤推薦連結點擊
 * 必須用 Suspense 包裝，因為使用了 useSearchParams
 */
export function AffiliateTracker() {
  useAffiliateTracking();
  return null;
}
