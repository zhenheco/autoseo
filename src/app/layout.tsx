import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { IntlProvider } from "@/providers/IntlProvider";
import { CookieConsentProvider } from "@/components/consent";
import { GoogleAnalytics } from "@/components/tracking/GoogleAnalytics";
import { GA4Script } from "@/components/tracking/GA4Script";
import { AffiliateTracker } from "@/components/tracking/affiliate-tracker";
import { fontVariables } from "@/lib/fonts";
import {
  OrganizationSchema,
  WebSiteSchema,
} from "@/components/seo/SchemaMarkup";

// SEO 常數定義
const SITE_CONFIG = {
  name: "1waySEO",
  url: "https://1wayseo.com",
  title: "1waySEO - AI 驅動的 SEO 寫文平台",
  description:
    "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構，支援繁體中文、英文、日文等多語系介面。",
  logo: "https://1wayseo.com/logo.svg",
  ogImage: "https://1wayseo.com/og-home.jpg",
} as const;

const SOCIAL_LINKS = [
  "https://facebook.com/1wayseo",
  "https://twitter.com/1wayseo",
  "https://linkedin.com/company/1wayseo",
] as const;

const SUPPORTED_LANGUAGES = {
  "zh-TW": "zh_TW",
  "en-US": "en_US",
  "ja-JP": "ja_JP",
} as const;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: SITE_CONFIG.title,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    "SEO工具",
    "AI寫作",
    "內容行銷",
    "關鍵字優化",
    "文章生成",
    "多語系SEO",
    "AI content generation",
    "SEOツール",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_CONFIG.url,
    languages: Object.fromEntries([
      ...Object.keys(SUPPORTED_LANGUAGES).map((lang) => [
        lang,
        `${SITE_CONFIG.url}/${lang}`,
      ]),
      ["x-default", SITE_CONFIG.url],
    ]),
  },
  openGraph: {
    type: "website",
    locale: SUPPORTED_LANGUAGES["zh-TW"],
    alternateLocale: Object.values(SUPPORTED_LANGUAGES).filter(
      (locale) => locale !== "zh_TW",
    ),
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description.substring(0, 160), // OG description 建議限制
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_CONFIG.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description.substring(0, 120), // Twitter description 更短
    images: [SITE_CONFIG.ogImage],
  },
  other: {
    "content-language": "zh-TW",
    "accept-language": Object.keys(SUPPORTED_LANGUAGES).join(","),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      {/* GA4 腳本 - 使用 beforeInteractive 確保在 head 中盡早載入 */}
      <GA4Script />
      <body className={fontVariables}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <CookieConsentProvider>
            <GoogleAnalytics />
            <Suspense fallback={null}>
              <AffiliateTracker />
            </Suspense>
            <IntlProvider>
              {children}
              <Toaster richColors position="top-right" />
              {/* 全站結構化數據 */}
              <OrganizationSchema
                name={SITE_CONFIG.name}
                url={SITE_CONFIG.url}
                logo={SITE_CONFIG.logo}
                description={`AI 驅動的 SEO 寫文平台，提供智能文章生成服務`}
                sameAs={[...SOCIAL_LINKS]}
              />
              <WebSiteSchema
                name={SITE_CONFIG.name}
                url={SITE_CONFIG.url}
                description={SITE_CONFIG.description}
                searchUrl={`${SITE_CONFIG.url}/search`}
              />
            </IntlProvider>
          </CookieConsentProvider>
        </ThemeProvider>
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
