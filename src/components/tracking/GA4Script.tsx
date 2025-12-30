import Script from "next/script";

/**
 * GA4 基礎腳本組件
 * 使用 beforeInteractive 策略確保腳本在 head 中盡早載入
 * 這是 Google 官方建議的安裝方式
 */

const GA_MEASUREMENT_ID = "G-XB62S72WFN";

export function GA4Script() {
  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="beforeInteractive"
      />
      <Script id="gtag-init-basic" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
