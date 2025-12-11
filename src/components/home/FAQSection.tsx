"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, HelpCircle } from "lucide-react";
import { BackgroundGrid } from "@/components/ui/background-effects";
import { GradientText } from "@/components/ui/shimmer-text";

const faqKeys = [
  "whatIsCredits",
  "creditsPerArticle",
  "creditsAccumulate",
  "getMoreCredits",
  "paymentMethods",
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const t = useTranslations("faq");

  return (
    <section className="relative py-20 bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-indigo-950">
      <BackgroundGrid variant="dark" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-violet-600 dark:text-cyber-violet-400">
            <HelpCircle className="h-4 w-4" />
            <span>{t("title")}</span>
          </div>
          <h2 className="font-bold mb-4">
            <GradientText
              as="span"
              gradient="cyan-violet-magenta"
              className="text-4xl md:text-5xl"
            >
              {t("subtitle")}
            </GradientText>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqKeys.map((key, index) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all duration-300 bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none ${
                openIndex === index
                  ? "border-cyber-violet-400/50"
                  : "border-slate-200 dark:border-white/10 hover:border-cyber-violet-500/30"
              }`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {t(`questions.${key}.question`)}
                  </h3>
                  <ChevronDown
                    className={`h-5 w-5 text-cyber-violet-400 transition-transform duration-300 ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index
                      ? "max-h-48 opacity-100 mt-3"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t(`questions.${key}.answer`)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
