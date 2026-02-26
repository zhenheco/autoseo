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
        {/* S1: Hero - Light */}
        <HeroStory />

        {/* S2: Features - Dark */}
        <FeatureGrid />

        {/* S3: Turning Point - Light */}
        <TurningPoint />

        {/* S4: Results - Dark */}
        <Results />

        {/* S5: Social Proof - Light */}
        <SocialProof />

        {/* S6: Three Steps - Dark */}
        <ThreeSteps />

        {/* S7: Pricing - Light */}
        <PricingStory plans={plans} articlePackages={articlePackages} />

        {/* FAQ - Dark */}
        <FAQSection />

        {/* S8: Closing - Light */}
        <ClosingCTA />

        {/* Footer - Dark */}
        <footer className="relative py-24 bg-slate-900 border-t border-slate-800 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start gap-16 md:gap-8">
              {/* Brand Section */}
              <div className="flex flex-col items-start gap-6 max-w-sm">
                <div className="text-2xl font-black text-white tracking-tighter flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm">
                    1
                  </div>
                  1WaySEO
                </div>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  {t("heroDescription")}
                </p>
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] text-green-400 font-black uppercase tracking-widest shadow-inner">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
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
                  <ul className="space-y-4 text-sm font-medium text-slate-400">
                    {[{ href: "/blog", label: t("blog") }].map(
                      ({ href, label }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="hover:text-blue-400 transition-colors"
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
                  <ul className="space-y-4 text-sm font-medium text-slate-400">
                    {[
                      { href: "/terms", label: t("terms") },
                      { href: "/privacy", label: t("privacy") },
                    ].map(({ href, label }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className="hover:text-blue-400 transition-colors"
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
            <div className="mt-20 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {t("allRightsReserved")}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
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
