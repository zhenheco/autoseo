"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "什麼是 Credits？",
    answer:
      "Credits 是 1waySEO 的使用點數，用於衡量 AI 運算消耗。生成一篇文章大約需要 3,000-5,000 Credits，具體取決於文章長度和所選 AI 模型。",
  },
  {
    question: "一篇文章需要多少 Credits？",
    answer:
      "一般 2,000 字的 SEO 文章約需 3,000-4,000 Credits，包含關鍵字研究、競爭分析、文章生成和圖片生成。長篇文章（5,000+ 字）可能需要 5,000-8,000 Credits。",
  },
  {
    question: "終身方案真的是永久的嗎？",
    answer:
      "是的！終身方案一次付費後，您將永久享有每月自動重置的 Credits 配額。只要 1waySEO 服務持續運營，您的方案就永遠有效。",
  },
  {
    question: "每月配額用不完會累積嗎？",
    answer:
      "每月配額會在每月 1 日自動重置，不會累積到下個月。但您額外購買的 Credit 包則是永久有效，不會過期。",
  },
  {
    question: "可以隨時升級方案嗎？",
    answer:
      "可以！您可以隨時升級到更高級的終身方案，只需支付差額即可。升級後會立即生效，新的每月配額將從下個計費週期開始。",
  },
  {
    question: "支援哪些付款方式？",
    answer:
      "我們支援信用卡（Visa、MasterCard、JCB）、網路 ATM 轉帳等多種付款方式，透過藍新金流安全處理。",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <HelpCircle className="h-4 w-4" />
            <span>常見問題</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            還有疑問嗎？
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            以下是用戶最常詢問的問題
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-all ${
                openIndex === index ? "border-primary" : "border-border"
              }`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </div>
                {openIndex === index && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
