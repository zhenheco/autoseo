import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { IntlProvider } from "@/providers/IntlProvider";
import { CookieConsentProvider } from "@/components/consent";
import { GoogleAnalytics } from "@/components/tracking/GoogleAnalytics";
import { GA4Script } from "@/components/tracking/GA4Script";
import { AffiliateTracker } from "@/components/tracking/affiliate-tracker";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://1wayseo.com"),
  title: {
    default: "1waySEO - AI 驅動的 SEO 寫文平台",
    template: "%s | 1waySEO",
  },
  description: "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構",
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
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://1wayseo.com",
    siteName: "1waySEO",
    title: "1waySEO - AI 驅動的 SEO 寫文平台",
    description: "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構",
  },
  twitter: {
    card: "summary_large_image",
    title: "1waySEO - AI 驅動的 SEO 寫文平台",
    description: "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構",
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
      <body className={inter.className}>
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
            </IntlProvider>
          </CookieConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
