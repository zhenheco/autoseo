"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useCookieConsent } from "@/components/consent/CookieConsentProvider";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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
 * Google Analytics 4 追蹤組件
 * 支援 Consent Mode v2（GDPR 合規）
 *
 * 實作方式：
 * 1. 預設拒絕所有追蹤（consent default: denied）
 * 2. 用戶同意後動態更新（consent update: granted）
 * 3. GA4 始終載入，但只在同意後才收集數據
 */
export function GoogleAnalytics() {
  const { consent, hasConsented, isLoading } = useCookieConsent();
  const [gaLoaded, setGaLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 確保在客戶端執行（使用 setTimeout 避免 lint 警告）
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

  // 追蹤頁面檢視（GA 載入後）
  useEffect(() => {
    if (!gaLoaded || !GA_MEASUREMENT_ID) return;

    window.gtag?.("config", GA_MEASUREMENT_ID, {
      page_path: window.location.pathname,
      anonymize_ip: true,
      cookie_flags: "SameSite=Lax;Secure",
    });
  }, [gaLoaded]);

  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* 載入 gtag.js */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
        onLoad={() => setGaLoaded(true)}
      />

      {/* 初始化 GA4（含 Consent Mode v2 預設值）*/}
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Consent Mode v2: 預設拒絕所有追蹤
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'wait_for_update': 500
            });

            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
              send_page_view: false,
              anonymize_ip: true,
              cookie_flags: 'SameSite=Lax;Secure'
            });
          `,
        }}
      />

      {/* 頁面追蹤組件 */}
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker />
      </Suspense>
    </>
  );
}
