import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader } from "@shared/ui/card";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: {
    absolute: "FAQ - 1waySEO",
  },
  description:
    "Frequently asked questions about 1waySEO for SHOPLINE merchants, including permissions, review flow, supported platforms, pricing, and support.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "FAQ - 1waySEO",
    description:
      "Answers for SHOPLINE merchants reviewing 1waySEO permissions, automation behavior, pricing, and support.",
    url: "/faq",
    siteName: "1waySEO",
    type: "website",
  },
};

const faqs = [
  {
    question: "1waySEO 做什麼？",
    answer:
      "1waySEO 是 AI SEO 自動化工具，協助 SHOPLINE 商家掃描商品、分類與頁面 SEO 問題，產生 meta title、meta description、圖片 alt text 與結構化修補建議。",
    english:
      "1waySEO audits merchant SEO data and generates AI-assisted optimization suggestions for products, collections, pages, and metadata.",
  },
  {
    question: "安裝後 1waySEO 會自動修改我商品的什麼資料？",
    answer:
      "1waySEO 只會在商家授權與操作範圍內讀寫 SEO 相關欄位，例如商品標題、描述、圖片替代文字與 SEO meta。高風險或需要確認的修補不會直接套用。",
    english:
      "The app only reads and writes SEO-related fields within the authorized merchant scope.",
  },
  {
    question: "我可以撤銷授權嗎？",
    answer:
      "可以。商家可在 SHOPLINE 後台或 1waySEO 服務內撤銷連線。撤銷後，OAuth tokens 會在 7 天內刪除，未來排程也會停止。",
    english:
      "Yes. Merchants can revoke authorization, after which tokens are deleted within 7 days.",
  },
  {
    question: "1waySEO 看得到我的客戶資料 / 訂單嗎？",
    answer:
      "不會。客戶個資、訂單、付款資料與客戶紀錄明確不在 1waySEO 的資料收集範圍內，我們不會讀取或保存這些資料。",
    english:
      "No. Customer PII, orders, payment data, and customer records are explicitly out of scope.",
  },
  {
    question: "修補建議可以人工 review 後再套用嗎？",
    answer:
      "可以。medium-risk 修補會進入審核佇列，商家可先 review，再決定是否套用。這讓 SEO 自動化保留人工控管。",
    english:
      "Yes. Medium-risk recommendations go into a review queue before being applied.",
  },
  {
    question: "支援哪些電商平台？",
    answer:
      "目前支援 SHOPLINE、WordPress，以及透過 Edge Worker 串接的自架站。SHOPLINE Public App 是本次上架審核的主要版本。",
    english:
      "Supported platforms include SHOPLINE, WordPress, and custom sites via Edge Worker integration.",
  },
  {
    question: "收費方式？",
    answer:
      "1waySEO 採訂閱制與使用量方案，依網站數、AI 生成量、健檢頻率與進階整合功能調整。實際方案會顯示於服務內的 subscription 或 billing 頁面。",
    english:
      "Pricing is subscription and usage based, depending on sites, AI generation volume, audit frequency, and integrations.",
  },
  {
    question: "客服聯絡？",
    answer:
      "若需要協助，請寄信至 ace@zhenheai.com，並附上您的商店名稱、SHOPLINE shop handle 與遇到的問題。",
    english:
      "For support, email ace@zhenheai.com with your store name, SHOPLINE shop handle, and issue details.",
  },
];

export default function FAQPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${faq.answer} ${faq.english}`,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
            FAQ
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            1waySEO 常見問題，協助 SHOPLINE
            商家了解權限、資料範圍、人工審核、平台支援與客服方式。
          </p>
        </header>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <Card key={faq.question} className="rounded-lg shadow-sm">
              <CardHeader>
                <h2 className="text-xl font-semibold leading-7">
                  {faq.question}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4 text-base leading-7 text-muted-foreground">
                <p>{faq.answer}</p>
                <p className="border-l-2 pl-4 text-sm leading-6">
                  English summary: {faq.english}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
