"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useCookieConsent } from "@/components/consent/CookieConsentProvider";

// GA4 Measurement ID - 與 GA4Script.tsx 保持一致
const GA_MEASUREMENT_ID = "G-XB62S72WFN";

// 擴展 Window 類型
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 頁面追蹤內部組件
 * 使用 useSearchParams 需要包在 Suspense 中
 */
function GoogleAnalyticsTracker() {
  const { consent, hasConsented } = useCookieConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 只在用戶同意且有 Measurement ID 時追蹤
  const shouldTrack = hasConsented && consent.analytics && GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!shouldTrack) return;

    // 頁面變更時追蹤
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");

    window.gtag?.("event", "page_view", {
      page_path: url,
      page_title: document.title,
    });
  }, [pathname, searchParams, shouldTrack]);

  return null;
}

/**
 * Google Analytics 4 Consent Mode 管理組件
 *
 * 注意：GA4 腳本由 GA4Script.tsx 載入（使用 beforeInteractive）
 * 此組件僅負責：
 * 1. 根據用戶 Cookie 同意狀態更新 GA4 Consent Mode
 * 2. 追蹤頁面檢視
 */
export function GoogleAnalytics() {
  const { consent, hasConsented, isLoading } = useCookieConsent();
  const [mounted, setMounted] = useState(false);

  // 確保在客戶端執行
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // 根據用戶同意狀態更新 GA4 Consent
  useEffect(() => {
    if (!mounted || !GA_MEASUREMENT_ID || typeof window === "undefined") return;
    if (!window.gtag) return;

    // 當 consent 狀態變更時，更新 GA4
    if (!isLoading) {
      const analyticsGranted = hasConsented && consent.analytics;
      const marketingGranted = hasConsented && consent.marketing;

      window.gtag("consent", "update", {
        analytics_storage: analyticsGranted ? "granted" : "denied",
        ad_storage: marketingGranted ? "granted" : "denied",
        ad_user_data: marketingGranted ? "granted" : "denied",
        ad_personalization: marketingGranted ? "granted" : "denied",
      });
    }
  }, [mounted, isLoading, hasConsented, consent.analytics, consent.marketing]);

  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsTracker />
    </Suspense>
  );
}
