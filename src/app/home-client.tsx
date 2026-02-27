"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { HeroStory } from "@/components/home/HeroStory";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { TurningPoint } from "@/components/home/TurningPoint";
import { Results } from "@/components/home/Results";
import { SocialProof } from "@/components/home/SocialProof";
import { ThreeSteps } from "@/components/home/ThreeSteps";
import { PricingStory } from "@/components/home/PricingStory";
import { FAQSection } from "@/components/home/FAQSection";
import { ClosingCTA } from "@/components/home/ClosingCTA";
import { useTranslations } from "next-intl";
import { PricingProps } from "@/types/pricing";

export function HomeClient({ plans, articlePackages }: PricingProps) {
  const t = useTranslations("home");

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden selection:bg-indigo-500/30">
        <HeroStory />
        <FeatureGrid />
        <TurningPoint />
        <ThreeSteps />
        <Results />
        <SocialProof />
        <PricingStory plans={plans} articlePackages={articlePackages} />
        <FAQSection />
        <ClosingCTA />

        {/* Footer */}
        <footer className="relative py-24 bg-slate-950 border-t border-slate-800/50 overflow-hidden">
          {/* Subtle Grid */}
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] bg-repeat pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10 max-w-7xl">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-16 lg:gap-8">
              {/* Brand Section */}
              <div className="flex flex-col items-start gap-6 max-w-sm">
                <div className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg">
                    1
                  </div>
                  1WaySEO
                </div>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  {t("heroDescription")}
                </p>
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {t("aiPoweredWorkflow")}
                </div>
              </div>

              {/* Links Sections */}
              <div className="grid grid-cols-2 gap-16 lg:gap-24">
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                    {t("resources")}
                  </h4>
                  <ul className="space-y-4 text-sm font-medium text-slate-400">
                    {[{ href: "/blog", label: t("blog") }].map(
                      ({ href, label }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            className="hover:text-indigo-400 transition-colors"
                          >
                            {label}
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">
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
                          className="hover:text-indigo-400 transition-colors"
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
            <div className="mt-20 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-slate-500 text-xs font-medium tracking-wide">
                {t("allRightsReserved")}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-slate-500 text-xs font-medium tracking-wide flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500 inline-block" />{" "}
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
