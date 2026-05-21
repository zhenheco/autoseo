import Script from "next/script";

/**
 * GA4 基礎腳本組件
 * 使用 afterInteractive，避免第三方分析腳本阻塞 LP 首屏渲染。
 */

const GA_MEASUREMENT_ID = "G-XB62S72WFN";

export function GA4Script() {
  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init-basic" strategy="afterInteractive">
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
