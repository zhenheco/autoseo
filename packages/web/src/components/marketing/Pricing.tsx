"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";
import { track } from "@/lib/analytics/events";
import { StatBadge } from "@/components/ui/stat-badge";

type BillingCycle = "monthly" | "yearly";
type PlanKey = "solo" | "pro";
type PlanId = `${PlanKey}_${BillingCycle}`;

export interface PricingProps {
  locale: string;
  countryCode?: string | null;
}

interface PricingPlan {
  key: PlanKey;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavings: number;
  approximateTwd: Record<BillingCycle, string>;
  popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    key: "solo",
    monthlyPrice: 39,
    yearlyPrice: 374,
    yearlySavings: 94,
    approximateTwd: {
      monthly: "1,250",
      yearly: "12,000",
    },
  },
  {
    key: "pro",
    monthlyPrice: 99,
    yearlyPrice: 950,
    yearlySavings: 238,
    approximateTwd: {
      monthly: "3,180",
      yearly: "30,400",
    },
    popular: true,
  },
];

function getPlanId(plan: PlanKey, billingCycle: BillingCycle): PlanId {
  return `${plan}_${billingCycle}`;
}

export function Pricing({ locale, countryCode }: PricingProps) {
  const t = useTranslations("lp.pricing");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [isTaiwanVisitor, setIsTaiwanVisitor] = useState(
    countryCode?.toUpperCase() === "TW" || locale === "zh-TW",
  );

  useEffect(() => {
    track({
      name: "pricing_view",
      properties: { locale },
    });
  }, [locale]);

  useEffect(() => {
    if (
      isTaiwanVisitor ||
      typeof fetch !== "function" ||
      process.env.NODE_ENV === "test"
    ) {
      return;
    }

    let isActive = true;

    async function detectTaiwanVisitor() {
      try {
        const response = await fetch("/api/geo");
        if (!response.ok) return;

        const data = (await response.json()) as { country?: string | null };
        if (isActive && data.country?.toUpperCase() === "TW") {
          setIsTaiwanVisitor(true);
        }
      } catch {
        // Geo detection is best-effort; pricing stays usable without it.
      }
    }

    void detectTaiwanVisitor();

    return () => {
      isActive = false;
    };
  }, [isTaiwanVisitor]);

  const activePlanIds = useMemo(
    () =>
      pricingPlans.reduce(
        (acc, plan) => {
          acc[plan.key] = getPlanId(plan.key, billingCycle);
          return acc;
        },
        {} as Record<PlanKey, PlanId>,
      ),
    [billingCycle],
  );

  function trackCtaClick(planId: PlanId) {
    track({
      name: "cta_click",
      properties: {
        ctaId: `pricing_${planId}`,
        locale,
      },
    });
  }

  return (
    <section
      id="pricing"
      className="border-b border-border bg-background py-20 md:py-28"
    >
      <div className="container-section">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
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

          <div
            aria-label={t("billingToggleLabel")}
            className="inline-flex w-fit rounded-md border border-border bg-bg-elevated p-1"
            role="group"
          >
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                aria-pressed={billingCycle === cycle}
                className={`rounded-md px-4 py-2 text-body-sm font-semibold transition-colors ${
                  billingCycle === cycle
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setBillingCycle(cycle)}
              >
                {t(`billing.${cycle}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {pricingPlans.map((plan) => {
            const planId = activePlanIds[plan.key];
            const price =
              billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const features = t.raw(`plans.${plan.key}.features`) as string[];

            return (
              <article
                key={plan.key}
                data-testid={`pricing-card-${plan.key}`}
                className={`relative flex min-h-full flex-col rounded-md border bg-card p-6 shadow-sm ${
                  plan.popular ? "border-primary/50" : "border-border"
                }`}
              >
                {plan.popular ? (
                  <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-tiny font-semibold text-primary-foreground">
                    <Star aria-hidden="true" className="h-3 w-3" />
                    {t("popular")}
                  </div>
                ) : null}

                <div className="pr-28">
                  <h3 className="text-h3 font-bold tracking-normal text-foreground">
                    {t(`plans.${plan.key}.name`)}
                  </h3>
                  <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">
                    {t(`plans.${plan.key}.description`)}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2">
                  <span className="text-h1 font-bold tracking-normal text-foreground">
                    ${price}
                  </span>
                  <span className="pb-2 text-body-sm font-medium text-muted-foreground">
                    {t(`period.${billingCycle}`)}
                  </span>
                  {isTaiwanVisitor ? (
                    <span className="pb-2 text-body-sm text-muted-foreground">
                      {t("approxTwd", {
                        amount: plan.approximateTwd[billingCycle],
                      })}
                    </span>
                  ) : null}
                </div>

                {billingCycle === "yearly" ? (
                  <div className="mt-4">
                    <StatBadge amount={`$${plan.yearlySavings}/yr`} />
                  </div>
                ) : null}

                <ul className="mt-6 space-y-3">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-3 text-body-sm leading-relaxed text-foreground"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  className="mt-8 h-12 w-full rounded-md text-body font-semibold"
                >
                  <Link
                    data-testid={`pricing-cta-${plan.key}`}
                    href={`/signup?plan=${planId}`}
                    onClick={() => trackCtaClick(planId)}
                  >
                    {t("cta")}
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
