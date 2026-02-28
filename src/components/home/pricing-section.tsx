"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { PricingProps, ArticlePlan, ArticlePackage } from "@/types/pricing";

/** Fallback mock plans when Supabase data is empty */
const FALLBACK_PLANS = [
  {
    name: "Free",
    slug: "free",
    price: "0",
    period: "forever",
    descKey: "freeDesc",
    featureKeys: [
      "freeFeature1",
      "freeFeature2",
      "freeFeature3",
      "freeFeature4",
    ],
    ctaKey: "getStarted",
    popular: false,
  },
  {
    name: "Starter",
    slug: "starter",
    price: "9.9",
    period: "monthly",
    descKey: "starterDesc",
    featureKeys: [
      "starterFeature1",
      "starterFeature2",
      "starterFeature3",
      "starterFeature4",
      "starterFeature5",
    ],
    ctaKey: "startTrial",
    popular: false,
  },
  {
    name: "Pro",
    slug: "pro",
    price: "29.9",
    period: "monthly",
    descKey: "proDesc",
    featureKeys: [
      "proFeature1",
      "proFeature2",
      "proFeature3",
      "proFeature4",
      "proFeature5",
      "proFeature6",
    ],
    ctaKey: "scaleWithPro",
    popular: true,
  },
];

const FALLBACK_ARTICLE_PACKS = [
  { nameKey: "sPack", articles: 10, price: 19 },
  { nameKey: "mPack", articles: 30, price: 49 },
  { nameKey: "lPack", articles: 80, price: 99 },
];

function FallbackPricingCards({ t }: { t: (key: string) => string }) {
  return (
    <div className="container-section grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
      {FALLBACK_PLANS.map((plan, i) => (
        <motion.div
          key={plan.slug}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className={`relative p-8 rounded-3xl border ${
            plan.popular
              ? "border-primary/50 shadow-[0_0_50px_-12px_rgba(99,102,241,0.2)]"
              : "border-foreground/5 bg-card"
          } overflow-hidden flex flex-col`}
        >
          {plan.popular && (
            <div className="absolute inset-0 p-[1px] -z-10 rounded-3xl overflow-hidden">
              <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#6366F1_0%,#10B981_50%,#6366F1_100%)]" />
            </div>
          )}

          {plan.popular && (
            <div className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-6">
              {t("bestValue")}
            </div>
          )}

          {!plan.popular && (
            <div className="text-text-dim text-xs font-bold mb-6 uppercase tracking-wider">
              {t(plan.slug)}
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl md:text-5xl font-bold">
                ${plan.price}
              </span>
              <span className="text-text-dim font-medium">
                /{t(plan.period)}
              </span>
            </div>
            <p className="mt-4 text-text-sub text-sm leading-relaxed">
              {t(plan.descKey)}
            </p>
          </div>

          <div className="space-y-4 mb-8 flex-1">
            {plan.featureKeys.map((fk) => (
              <div key={fk} className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? "bg-primary/20" : "bg-foreground/5"}`}
                >
                  <Check
                    className={`w-3 h-3 ${plan.popular ? "text-primary" : "text-text-dim"}`}
                  />
                </div>
                <span className="text-sm text-text-sub">{t(fk)}</span>
              </div>
            ))}
          </div>

          <Link href="/auth/login">
            <Button
              className={`w-full py-6 rounded-xl font-bold transition-all duration-300 ${
                plan.popular
                  ? "bg-primary hover:bg-primary/90 text-white"
                  : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              {t(plan.ctaKey)}
            </Button>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function RealPricingCards({
  plans,
  billingCycle,
  t,
  tSub,
}: {
  plans: ArticlePlan[];
  billingCycle: "monthly" | "yearly";
  t: (key: string) => string;
  tSub: ReturnType<typeof useTranslations>;
}) {
  const getPlanName = (plan: ArticlePlan) => {
    const slug = plan.slug || "";
    const translatedName = tSub.raw(`plans.${slug}`);
    return typeof translatedName === "string" ? translatedName : plan.name;
  };

  const commonFeatures = [
    "allAIModels",
    "wordpressIntegration",
    "autoImageGen",
    "scheduledPublish",
  ];

  return (
    <div className="container-section grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
      {plans.map((plan, i) => {
        const isPopular = plan.slug === "pro";
        const price =
          billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
        const period =
          billingCycle === "monthly" ? tSub("month") : tSub("year");

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`relative p-8 rounded-3xl border ${
              isPopular
                ? "border-primary/50 shadow-[0_0_50px_-12px_rgba(99,102,241,0.2)]"
                : "border-foreground/5 bg-card"
            } overflow-hidden flex flex-col`}
          >
            {isPopular && (
              <div className="absolute inset-0 p-[1px] -z-10 rounded-3xl overflow-hidden">
                <div className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#6366F1_0%,#10B981_50%,#6366F1_100%)]" />
              </div>
            )}

            {isPopular && (
              <div className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-6">
                {t("bestValue")}
              </div>
            )}

            {!isPopular && (
              <div className="text-text-dim text-xs font-bold mb-6 uppercase tracking-wider">
                {getPlanName(plan)}
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl md:text-5xl font-bold">
                  NT${price?.toLocaleString()}
                </span>
                <span className="text-text-dim font-medium">/ {period}</span>
              </div>
              <p className="mt-2 text-text-sub text-sm">
                {plan.articles_per_month} {tSub("articles")} / {tSub("month")}
              </p>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              {commonFeatures.map((fk) => (
                <div key={fk} className="flex items-center gap-3">
                  <div
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isPopular ? "bg-primary/20" : "bg-foreground/5"}`}
                  >
                    <Check
                      className={`w-3 h-3 ${isPopular ? "text-primary" : "text-text-dim"}`}
                    />
                  </div>
                  <span className="text-sm text-text-sub">{tSub(fk)}</span>
                </div>
              ))}
            </div>

            <Link href="/auth/login">
              <Button
                className={`w-full py-6 rounded-xl font-bold transition-all duration-300 ${
                  isPopular
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                {tSub("subscribe")}
              </Button>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

function ArticlePackageCards({
  articlePackages,
  t,
  tHome,
}: {
  articlePackages: ArticlePackage[];
  t: ReturnType<typeof useTranslations>;
  tHome: (key: string) => string;
}) {
  return (
    <div className="container-section">
      <div className="p-8 md:p-12 rounded-[2rem] border border-foreground/5 bg-gradient-to-br from-card to-background relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
          <Zap className="w-64 h-64 text-secondary" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          <div className="max-w-md">
            <h3 className="text-3xl font-bold mb-4">
              {tHome("needMoreArticles")}
            </h3>
            <p className="text-text-sub">{tHome("packageDescArticle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
            {articlePackages.map((pkg) => (
              <motion.div
                key={pkg.id}
                whileHover={{ y: -5 }}
                className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 text-center hover:border-secondary/50 transition-colors"
              >
                <div className="text-text-dim text-xs font-bold mb-2">
                  {pkg.name}
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {pkg.articles}{" "}
                  <span className="text-sm font-normal text-text-dim">
                    {t("articles")}
                  </span>
                </div>
                <div className="text-secondary font-bold">
                  NT${pkg.price?.toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PricingSection({ plans, articlePackages }: PricingProps) {
  const t = useTranslations("home.v5.pricing");
  const tV6 = useTranslations("home.v6.pricing");
  const tHome = useTranslations("home");
  const tSub = useTranslations("subscription");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );

  const hasRealPlans = plans && plans.length > 0;
  const hasPackages = articlePackages && articlePackages.length > 0;

  return (
    <section className="section-padding relative overflow-hidden" id="pricing">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-primary/5 blur-[160px] rounded-full -z-10" />

      <div className="container-section mb-16 text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
        >
          {tV6("headline")}
        </motion.h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {tV6("subheadline")}
        </p>

        {/* Billing toggle for real plans */}
        {hasRealPlans && (
          <div className="mt-8 inline-flex items-center p-1 rounded-lg bg-foreground/5 border border-foreground/10">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors duration-300 ${
                billingCycle === "monthly"
                  ? "bg-primary text-white"
                  : "text-text-sub"
              }`}
            >
              {tSub("monthlyBilling")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors duration-300 flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-primary text-white"
                  : "text-text-sub"
              }`}
            >
              {tSub("yearlyBilling")}
              <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-white">
                {tSub("yearlyBonus")}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      {hasRealPlans ? (
        <RealPricingCards
          plans={plans}
          billingCycle={billingCycle}
          t={t}
          tSub={tSub}
        />
      ) : (
        <FallbackPricingCards t={t} />
      )}

      {/* Article Packages or Fallback Article Packs */}
      {hasPackages ? (
        <ArticlePackageCards
          articlePackages={articlePackages}
          t={tSub}
          tHome={tHome}
        />
      ) : (
        <div className="container-section">
          <div className="p-8 md:p-12 rounded-[2rem] border border-foreground/5 bg-gradient-to-br from-card to-background relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
              <Zap className="w-64 h-64 text-secondary" />
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
              <div className="max-w-md">
                <div className="flex items-center gap-2 text-secondary font-bold text-sm uppercase tracking-widest mb-4">
                  <Zap className="w-4 h-4 fill-secondary" />
                  <span>{t("energyRefill")}</span>
                </div>
                <h3 className="text-3xl font-bold mb-4">
                  {t("runningOutTitle")}
                </h3>
                <p className="text-text-sub">{t("runningOutDesc")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
                {FALLBACK_ARTICLE_PACKS.map((pack) => (
                  <motion.div
                    key={pack.nameKey}
                    whileHover={{ y: -5 }}
                    className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 text-center hover:border-secondary/50 transition-colors"
                  >
                    <div className="text-text-dim text-xs font-bold mb-2">
                      {t(pack.nameKey)}
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {pack.articles}{" "}
                      <span className="text-sm font-normal text-text-dim">
                        {t("articles")}
                      </span>
                    </div>
                    <div className="text-secondary font-bold">
                      ${pack.price}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
