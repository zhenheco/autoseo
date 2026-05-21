"use client";

import { FileText, Images, Send, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

const steps = [
  {
    key: "discover",
    icon: TrendingUp,
  },
  {
    key: "generate",
    icon: FileText,
  },
  {
    key: "cards",
    icon: Images,
  },
  {
    key: "publish",
    icon: Send,
  },
] as const;

function Connector() {
  const motionPreference = useReducedMotion();
  const shouldReduceMotion =
    motionPreference ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const className =
    "pointer-events-none absolute left-6 top-[4.5rem] h-[calc(100%+1rem)] w-px origin-top rounded-full bg-primary/60 md:left-[calc(100%+0.5rem)] md:top-10 md:h-px md:w-[calc(100%-1rem)] md:origin-left";

  if (shouldReduceMotion) {
    return (
      <span
        aria-hidden="true"
        className={className}
        data-motion="reduced"
        data-testid="lp-how-connector"
      />
    );
  }

  return (
    <motion.span
      aria-hidden="true"
      className={className}
      data-motion="animated"
      data-testid="lp-how-connector"
      initial={{ scaleX: 0, scaleY: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.65 }}
      whileInView={{ scaleX: 1, scaleY: 1 }}
    />
  );
}

export function HowItWorks() {
  const t = useTranslations("lp.how");

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

        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              data-testid="lp-how-step"
              className="relative snap-start"
            >
              <div className="relative z-10 h-full rounded-md border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-body-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-elevated text-primary">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-5 text-balance text-h4 font-bold tracking-normal text-foreground">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-3 text-pretty text-body-sm leading-relaxed text-muted-foreground">
                  {t(`steps.${key}.description`)}
                </p>
              </div>
              {index < steps.length - 1 ? <Connector /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
