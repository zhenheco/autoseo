"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { HeroStory } from "@/components/home/HeroStory";
import { PainPoints } from "@/components/home/PainPoints";
import { TurningPoint } from "@/components/home/TurningPoint";
import { Results } from "@/components/home/Results";
import { SocialProof } from "@/components/home/SocialProof";
import { ThreeSteps } from "@/components/home/ThreeSteps";
import { PricingStory } from "@/components/home/PricingStory";
import { ClosingCTA } from "@/components/home/ClosingCTA";
import { FAQSection } from "@/components/home/FAQSection";
import { useTranslations } from "next-intl";

/** 篇數制方案資料類型 */
interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
  features: unknown;
}

/** 文章加購包資料類型 */
interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
}

interface HomeClientProps {
  plans: ArticlePlan[];
  articlePackages: ArticlePackage[];
}

export function HomeClient({ plans, articlePackages }: HomeClientProps) {
  const t = useTranslations("home");

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden">
        {/* S1: 共感開場 — 深夜加班的小美 */}
        <HeroStory />

        {/* S2: 痛點深化 — 你試過的那些方法 */}
        <PainPoints />

        {/* S3: 轉折 — 那個星期一早上 */}
        <TurningPoint />

        {/* S4: 成果展現 — 三個月後的小美 */}
        <Results />

        {/* S5: 社會證明 — 對話截圖風格 */}
        <SocialProof />

        {/* S6: 三步驟功能介紹 */}
        <ThreeSteps />

        {/* S7: 故事化價格區塊 */}
        <PricingStory plans={plans} articlePackages={articlePackages} />

        {/* FAQ */}
        <FAQSection />

        {/* S8: 收尾 — 你的故事從這裡開始 */}
        <ClosingCTA />

        {/* Footer */}
        <footer className="relative py-8 bg-white dark:bg-slate-950">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-slate-700 dark:text-slate-500 text-sm">
                © 2024 1WaySEO. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
                <Link
                  href="/blog"
                  className="hover:text-amber-500 transition-colors"
                >
                  {t("blog")}
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-amber-500 transition-colors"
                >
                  {t("terms")}
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-amber-500 transition-colors"
                >
                  {t("privacy")}
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
