"use client";

import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { HeroStory } from "@/components/home/HeroStory";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { TurningPoint } from "@/components/home/TurningPoint";
import { Results } from "@/components/home/Results";
import { SocialProof } from "@/components/home/SocialProof";
import { ThreeSteps } from "@/components/home/ThreeSteps";
import { PricingStory } from "@/components/home/PricingStory";
import { ClosingCTA } from "@/components/home/ClosingCTA";
import { FAQSection } from "@/components/home/FAQSection";
import { useTranslations } from "next-intl";
import { PricingProps } from "@/types/pricing";

export function HomeClient({ plans, articlePackages }: PricingProps) {
  const t = useTranslations("home");

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden">
        {/* S1: 共感開場 — 深夜加班的小美 */}
        <HeroStory />

        {/* S2: 功能展示 — Bento Grid Layout */}
        <FeatureGrid />

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
        <footer className="relative py-16 bg-mp-bg bg-noise border-t border-mp-primary/10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mp-primary/50 to-transparent" />
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-col items-center md:items-start gap-4">
                <div className="text-mp-text-secondary text-sm">
                  © 2024 1WaySEO. All rights reserved.
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-mp-success/10 border border-mp-success/30 rounded-full text-xs text-mp-success font-medium">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  由 AI 技術驅動
                </div>
              </div>
              <div className="flex gap-8 text-sm text-mp-text-secondary">
                {[
                  { href: "/blog", label: t("blog") },
                  { href: "/terms", label: t("terms") },
                  { href: "/privacy", label: t("privacy") },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="hover:text-mp-text transition-colors duration-200 relative group"
                  >
                    {label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-mp-primary transition-all duration-300 group-hover:w-full" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
