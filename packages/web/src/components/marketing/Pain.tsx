"use client";

import { Clock3, Compass, MegaphoneOff } from "lucide-react";
import { useTranslations } from "next-intl";

const painItems = [
  {
    key: "speed",
    icon: Clock3,
  },
  {
    key: "reach",
    icon: MegaphoneOff,
  },
  {
    key: "discovery",
    icon: Compass,
  },
] as const;

export function Pain() {
  const t = useTranslations("lp.pain");

  return (
    <section className="border-b border-border bg-background py-20 md:py-28">
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

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {painItems.map(({ key, icon: Icon }) => (
            <article
              key={key}
              data-testid="lp-pain-card"
              className="rounded-md border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-bg-elevated text-primary">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-balance text-h4 font-bold tracking-normal text-foreground">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 text-pretty text-body-sm leading-relaxed text-muted-foreground">
                {t(`items.${key}.body`)}
              </p>
              <p className="mt-5 text-body-sm font-semibold text-primary">
                {t(`items.${key}.value`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
