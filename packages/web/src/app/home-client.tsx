"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { Navbar } from "@/components/layout/navbar";
import { Hero as LegacyHero } from "@/components/home/hero";
import { Hero as MarketingHero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pain } from "@/components/marketing/Pain";
import { Pricing } from "@/components/marketing/Pricing";
import { SocialProof } from "@/components/marketing/SocialProof";
import { ContrastAnchor } from "@/components/home/contrast-anchor";
import { RevealDemo } from "@/components/home/reveal-demo";
import { LogoWall } from "@/components/home/logo-wall";
import { ScenarioCards } from "@/components/home/scenario-cards";
import { PricingSection } from "@/components/home/pricing-section";
import { ClosingCTANew } from "@/components/home/closing-cta-new";
import { FooterSection } from "@/components/home/footer-section";
import { getAnalyticsLocale, track } from "@/lib/analytics/events";
import { PricingProps } from "@/types/pricing";

const isLpV2Enabled = process.env.NEXT_PUBLIC_LP_V2_ENABLED === "true";

export function HomeClient({ plans, articlePackages }: PricingProps) {
  const trackedPageView = useRef(false);
  const locale = useLocale();

  useEffect(() => {
    if (trackedPageView.current) return;
    trackedPageView.current = true;

    track({
      name: "lp_view",
      properties: {
        locale: getAnalyticsLocale(),
        referer: document.referrer || undefined,
      },
    });
  }, []);

  return (
    <div className="bg-background min-h-screen text-foreground">
      <Navbar />
      <main>
        {isLpV2Enabled ? (
          <>
            <MarketingHero locale={locale} />
            <Pain />
            <HowItWorks />
            <Features />
            <SocialProof />
            <Pricing locale={locale} />
            <FAQ />
            <FinalCTA />
          </>
        ) : (
          <LegacyHero />
        )}
        <ContrastAnchor />
        <RevealDemo />
        <LogoWall />
        <ScenarioCards />
        {!isLpV2Enabled ? (
          <PricingSection plans={plans} articlePackages={articlePackages} />
        ) : null}
        <ClosingCTANew />
      </main>
      <FooterSection />
    </div>
  );
}
