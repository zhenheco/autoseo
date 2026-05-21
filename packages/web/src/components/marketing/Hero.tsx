"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";
import { track } from "@/lib/analytics/events";

export interface HeroProps {
  locale: string;
}

const HERO_IMAGE_SRC = "/marketing/lp-hero-placeholder.avif";
const PRIMARY_CTA_HREF = "/signup?plan=solo_monthly";
const SECONDARY_CTA_HREF = "/pricing";

export function Hero({ locale }: HeroProps) {
  const t = useTranslations("lp.hero");

  const trackCtaClick = (ctaId: "hero_primary" | "hero_secondary") => {
    track({
      name: "cta_click",
      properties: {
        ctaId,
        locale,
      },
    });
  };

  return (
    <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,hsl(var(--bg-canvas))_0%,hsl(var(--bg-elevated))_52%,hsl(var(--bg-accent))_100%)]">
      <div className="container-section grid min-h-[calc(100svh-4rem)] items-center gap-12 pb-16 pt-24 md:gap-16 md:pb-24 md:pt-32 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
        <div className="max-w-3xl">
          <h1 className="max-w-4xl text-balance text-display font-bold tracking-normal text-foreground">
            {t("headline")}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-body leading-relaxed text-muted-foreground">
            {t("subheadline")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-md px-6 text-body font-semibold shadow-primary-glow"
            >
              <Link
                href={PRIMARY_CTA_HREF}
                onClick={() => trackCtaClick("hero_primary")}
              >
                {t("primaryCta")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-md border-border bg-background/80 px-6 text-body font-semibold text-foreground hover:bg-background"
            >
              <Link
                href={SECONDARY_CTA_HREF}
                onClick={() => trackCtaClick("hero_secondary")}
              >
                <BarChart3 aria-hidden="true" className="h-4 w-4" />
                {t("secondaryCta")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-xl">
            <Image
              src={HERO_IMAGE_SRC}
              alt="1wayseo content flywheel dashboard preview"
              width={1600}
              height={1000}
              sizes="(min-width: 1024px) 52vw, (min-width: 768px) 88vw, 100vw"
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
