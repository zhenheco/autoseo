"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 追蹤推薦連結點擊的 Hook
 *
 * 當頁面載入時，如果 URL 包含 ?ref= 參數，會自動呼叫追蹤 API
 * 使用 sessionStorage 和 server-side cookie 雙重防止重複追蹤
 */
export function useAffiliateTracking() {
  const searchParams = useSearchParams();
  const hasTracked = useRef(false);

  useEffect(() => {
    // 只追蹤一次（component lifecycle 內）
    if (hasTracked.current) return;

    const ref = searchParams.get("ref");

    // 只有當 ref 參數存在且格式正確時才追蹤
    if (!ref || !/^[A-Z0-9]{8}$/.test(ref)) return;

    // 檢查 sessionStorage 防止同一 tab 重複追蹤
    const sessionKey = `affiliate_tracked_${ref}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(sessionKey)) {
      return;
    }

    hasTracked.current = true;

    // 收集追蹤資料
    const trackingData = {
      sessionId: crypto.randomUUID(),
      landingUrl: window.location.href,
      utmSource: searchParams.get("utm_source") || undefined,
      utmMedium: searchParams.get("utm_medium") || undefined,
      utmCampaign: searchParams.get("utm_campaign") || undefined,
    };

    // Fire and forget - 不阻塞渲染
    fetch("/api/affiliate/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trackingData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.tracked) {
          // 追蹤成功，設置 sessionStorage 防止重複
          sessionStorage.setItem(sessionKey, "1");
        }
      })
      .catch((err) => {
        console.warn("[Affiliate] Click tracking failed:", err);
      });
  }, [searchParams]);
}
