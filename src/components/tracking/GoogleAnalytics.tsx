"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
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
 * 根據 Cookie 同意狀態條件載入 gtag.js
 */
export function GoogleAnalytics() {
  const { consent, hasConsented, isLoading } = useCookieConsent();

  // 只在用戶同意分析 Cookie 且有 Measurement ID 時載入
  const shouldLoad =
    !isLoading && hasConsented && consent.analytics && GA_MEASUREMENT_ID;

  if (!shouldLoad) {
    return null;
  }

  return (
    <>
      {/* 載入 gtag.js */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />

      {/* 初始化 gtag */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
            cookie_flags: 'SameSite=Lax;Secure',
          });
        `}
      </Script>

      {/* 頁面追蹤組件 */}
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker />
      </Suspense>
    </>
  );
}
