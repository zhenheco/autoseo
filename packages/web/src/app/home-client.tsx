"use client";

import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/home/hero";
import { ContrastAnchor } from "@/components/home/contrast-anchor";
import { RevealDemo } from "@/components/home/reveal-demo";
import { LogoWall } from "@/components/home/logo-wall";
import { ScenarioCards } from "@/components/home/scenario-cards";
import { PricingSection } from "@/components/home/pricing-section";
import { ClosingCTANew } from "@/components/home/closing-cta-new";
import { FooterSection } from "@/components/home/footer-section";
import { PricingProps } from "@/types/pricing";

export function HomeClient({ plans, articlePackages }: PricingProps) {
  return (
    <div className="bg-background min-h-screen text-foreground">
      <Navbar />
      <main>
        <Hero />
        <ContrastAnchor />
        <RevealDemo />
        <LogoWall />
        <ScenarioCards />
        <PricingSection plans={plans} articlePackages={articlePackages} />
        <ClosingCTANew />
      </main>
      <FooterSection />
    </div>
  );
}
