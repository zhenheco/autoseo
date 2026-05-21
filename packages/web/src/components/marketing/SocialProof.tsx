"use client";

import { Quote, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export function SocialProof() {
  const t = useTranslations("lp.social");

  return (
    <section className="border-b border-border bg-bg-elevated py-20 md:py-28">
      <div className="container-section">
        <div className="max-w-3xl">
          <p className="text-body-sm font-semibold uppercase text-primary">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-balance text-h2 font-bold tracking-normal text-foreground">
            {t("headline")}
          </h2>
          <p className="mt-4 text-pretty text-body leading-relaxed text-muted-foreground">
            {t("subheadline")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex min-h-40 items-center gap-4 rounded-md border border-primary/25 bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg-elevated text-primary">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </div>
            <p className="text-balance text-h4 font-bold tracking-normal text-foreground">
              {t("banner")}
            </p>
          </div>

          <article
            data-testid="lp-founder-story"
            className="rounded-md border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-bg-elevated text-primary">
              <Quote aria-hidden="true" className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-balance text-h4 font-bold tracking-normal text-foreground">
              {t("story.title")}
            </h3>
            <p className="mt-3 text-pretty text-body leading-relaxed text-muted-foreground">
              {t("story.body")}
            </p>
            <p className="mt-5 text-body-sm font-semibold text-primary">
              {t("story.attribution")}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
