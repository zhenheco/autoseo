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
        <footer className="relative py-24 bg-slate-950 border-t border-white/5 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-mp-primary/30 to-transparent" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start gap-16 md:gap-8">
              {/* Brand Section */}
              <div className="flex flex-col items-start gap-6 max-w-sm">
                <div className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mp-primary to-mp-accent flex items-center justify-center text-sm">
                    1
                  </div>
                  1WaySEO
                </div>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  {t("heroDescription")}
                </p>
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] text-mp-success font-black uppercase tracking-widest shadow-inner">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mp-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-mp-success"></span>
                  </span>
                  {t("aiPoweredWorkflow")}
                </div>
              </div>

              {/* Links Sections */}
              <div className="grid grid-cols-2 md:grid-cols-2 gap-12 md:gap-24">
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                    {t("resources")}
                  </h4>
                  <ul className="space-y-4 text-sm font-medium text-slate-500">
                    {[{ href: "/blog", label: t("blog") }].map(
                      ({ href, label }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="hover:text-mp-primary transition-colors"
                          >
                            {label}
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                    {t("legal")}
                  </h4>
                  <ul className="space-y-4 text-sm font-medium text-slate-500">
                    {[
                      { href: "/terms", label: t("terms") },
                      { href: "/privacy", label: t("privacy") },
                    ].map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="hover:text-mp-primary transition-colors"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                {t("allRightsReserved")}
              </div>
              <div className="flex items-center gap-6">
                {/* Social placeholders if needed */}
                <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                <div className="text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">
                  {t("madeInTaiwan")}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
