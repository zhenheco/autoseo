import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { IntlProvider } from "@/providers/IntlProvider";
import { CookieConsentProvider } from "@/components/consent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "1waySEO - AI 驅動的 SEO 寫文平台",
  description: "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XB62S72WFN"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XB62S72WFN');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <CookieConsentProvider>
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
