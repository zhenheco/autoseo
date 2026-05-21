import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

const CONTACT_EMAIL = "ace@zhenheai.com";

export const metadata: Metadata = {
  title: {
    absolute: "Privacy Policy - 1waySEO",
  },
  description:
    "1waySEO Privacy Policy for SHOPLINE merchants, including data collection, usage, retention, security, and user rights.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy - 1waySEO",
    description:
      "How 1waySEO protects SHOPLINE merchant data and limits collection to SEO automation needs.",
    url: "/privacy",
    siteName: "1waySEO",
    type: "website",
  },
};

const sections = [
  {
    title: "1. 生效日期 / Effective Date",
    body: ["本政策生效日期為 2026-05-21。", "Effective date: 2026-05-21."],
  },
  {
    title: "2. 公司資訊 / Company",
    body: [
      "振禾有限公司 (Zhenhe Co., Ltd.) 提供 1waySEO 服務。",
      `Email: ${CONTACT_EMAIL}`,
      "Location: Taiwan",
    ],
  },
  {
    title: "3. 我們向 SHOPLINE 商家收集的資料 / Data We Collect",
    body: ["我們只收集提供 SEO 自動化、健檢、修補與週報所需的商家資料。"],
    list: [
      "商店中繼資料：shop handle、store name、聯絡資訊。",
      "商品、分類、頁面資料：標題、描述、圖片、SEO meta，用於讀取與寫入 SEO 修補。",
      "OAuth tokens：以 Supabase pgsodium api_keys key 進行靜態加密。",
      "健檢報告：URL、掃描資料、產生的修補建議與紀錄。",
    ],
    english:
      "We collect store metadata, product/collection/page SEO data, encrypted OAuth tokens, and audit report data required to operate the service.",
  },
  {
    title: "4. 我們不收集的資料 / Data We Do Not Collect",
    body: [
      "1waySEO 不收集客戶個資、訂單、客戶紀錄、付款資料或任何 SHOPLINE 顧客交易內容；這些資料明確不在服務範圍內。",
      "We do not collect customer PII, orders, customer records, payment data, or customer transaction details.",
    ],
  },
  {
    title: "5. 資料使用方式 / How We Use Data",
    list: [
      "透過 Cloudflare AI Gateway 串接 Claude / Gemini，產生 SEO meta tags、標題與描述建議。",
      "保存健檢歷史，供商家追蹤改善進度與接收 weekly digest emails。",
      "僅在商家明確連接後，交叉分析 Google Search Console、GA4、Microsoft Clarity 等資料。",
    ],
    english:
      "We use merchant data to generate SEO improvements, maintain audit history, send weekly digests, and analyze connected analytics sources only with explicit merchant authorization.",
  },
  {
    title: "6. 第三方服務 / Third Parties",
    body: ["我們使用下列第三方服務處理必要的基礎設施與 AI 生成工作："],
    list: [
      "Supabase：資料儲存，區域包含 EU / SG。",
      "Vercel：網站與應用 hosting。",
      "Cloudflare：Workers、KV、AI Gateway、Turnstile。",
      "Cf-email service：交易型郵件寄送。",
      "Claude API / Gemini API：LLM SEO 生成；prompts 不依各供應商政策保留。",
    ],
    english:
      "Third-party processors support storage, hosting, edge infrastructure, transactional email, and LLM SEO generation.",
  },
  {
    title: "7. 保存期限 / Retention",
    list: [
      "Active connection data：訂閱有效期間保存。",
      "Audit history：採 12 個月 rolling retention。",
      "Revoked connection：授權撤銷後 7 天內刪除 tokens。",
    ],
    english:
      "Connection data is retained while subscriptions are active, audit history is retained for 12 rolling months, and revoked tokens are deleted within 7 days.",
  },
  {
    title: "8. 使用者權利 / User Rights",
    body: [
      `依 GDPR / CCPA，您可要求 access、rectification、deletion、portability 或 object。請寄信至 ${CONTACT_EMAIL}，我們會在 30 天內回覆。`,
      `Under GDPR / CCPA, you may request access, rectification, deletion, portability, or objection by emailing ${CONTACT_EMAIL}. We respond within 30 days.`,
    ],
  },
  {
    title: "9. 安全措施 / Security",
    list: [
      "TLS in transit：傳輸過程使用 TLS。",
      "Encryption at rest：Supabase pgsodium 加密保存敏感憑證。",
      "No raw secrets in logs：logs 不寫入 raw secrets、tokens 或 private keys。",
      "Principle of least privilege：服務權限採最小必要原則。",
    ],
    english:
      "We use TLS in transit, encryption at rest, secret-safe logging practices, and least-privilege access controls.",
  },
  {
    title: "10. 兒童隱私 / Children",
    body: [
      "本服務不面向 16 歲以下兒童，也不刻意收集兒童個人資料。",
      "The service is not directed at children under 16.",
    ],
  },
  {
    title: "11. 政策變更 / Changes",
    body: [
      "若本政策有重大變更，我們會以 email 通知商家，並同步更新本頁。",
      "Material changes will be notified by email and reflected on this page.",
    ],
  },
  {
    title: "12. 聯絡方式 / Contact",
    body: [
      `Email: ${CONTACT_EMAIL}`,
      "Company: 振禾有限公司 (Zhenhe Co., Ltd.)",
      "Location: Taiwan",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <Button asChild variant="ghost" className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            回到首頁
          </Link>
        </Button>

        <header className="mb-10 border-b pb-8">
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            SHOPLINE Public App Review
          </p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            1waySEO 隱私權政策，說明我們如何處理 SHOPLINE 商家的 SEO
            自動化資料、憑證、安全措施與資料權利。
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.title} className="rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl leading-7">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-base leading-7 text-muted-foreground">
                {section.body?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.list ? (
                  <ul className="list-disc space-y-2 pl-6">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {section.english ? (
                  <p className="border-l-2 pl-4 text-sm leading-6">
                    English summary: {section.english}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
