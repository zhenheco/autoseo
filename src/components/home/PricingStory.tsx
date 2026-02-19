"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Gift,
  CheckCircle2,
  CreditCard,
  ArrowRight,
} from "lucide-react";

interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
  features: unknown;
}

interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
}

interface PricingStoryProps {
  plans: ArticlePlan[];
  articlePackages: ArticlePackage[];
}

const PLAN_STORY_KEYS: Record<string, string> = {
  starter: "story.pricing.tryFirst",
  pro: "story.pricing.serious",
  business: "story.pricing.team",
};

export function PricingStory({ plans, articlePackages }: PricingStoryProps) {
  const t = useTranslations("home");
  const tSub = useTranslations("subscription");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );

  const getPlanName = (plan: ArticlePlan) => {
    const slug = plan.slug || "";
    const translatedName = tSub.raw(`plans.${slug}`);
    return typeof translatedName === "string" ? translatedName : plan.name;
  };

  const getYearlyBonus = (plan: ArticlePlan) => plan.articles_per_month * 2;

  const getPlanStoryLabel = (slug: string) => {
    const key = PLAN_STORY_KEYS[slug];
    return key ? t(key) : "";
  };

  return (
    <section
      id="pricing"
      className="py-20 px-4 bg-gradient-to-b from-white to-amber-50/30 dark:from-slate-900 dark:to-slate-800"
    >
      <div className="max-w-5xl mx-auto">
        {/* Story intro */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-6">
            {t("story.pricing.intro")}
          </h2>

          <div className="flex items-center justify-center gap-4 md:gap-8 mb-4">
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("story.pricing.before")}
              </p>
              <p className="text-2xl font-bold text-red-500 line-through">
                {t("story.pricing.beforeAmount")}
              </p>
            </div>
            <ArrowRight className="h-6 w-6 text-amber-500" />
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("story.pricing.after")}
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {t("story.pricing.afterAmount")}
              </p>
            </div>
          </div>

          <p className="text-slate-500 dark:text-slate-400 italic mb-8">
            {t("story.pricing.saving")}
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-800/50 shadow-md border border-slate-200 dark:border-slate-700 p-1 mb-8">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-amber-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("monthlyBilling")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {t("yearlyBilling")}
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400 text-slate-900">
                {t("yearlyBonus")}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {plans?.map((plan, index) => {
            const isPopular = plan.slug === "pro";
            const price =
              billingCycle === "yearly"
                ? plan.yearly_price
                : plan.monthly_price;
            const yearlyBonus = getYearlyBonus(plan);
            const storyLabel = getPlanStoryLabel(plan.slug);

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card
                  className={`relative flex flex-col h-full transition-all duration-300 ${
                    isPopular
                      ? "border-amber-400 shadow-lg shadow-amber-500/10 scale-105 bg-white dark:bg-slate-800"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-amber-300"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      {t("mostPopular")}
                    </div>
                  )}
                  <CardContent className="p-6 flex flex-col h-full">
                    {storyLabel && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                        {storyLabel}
                      </p>
                    )}
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                      {getPlanName(plan)}
                    </h3>
                    <div className="mb-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-800 dark:text-white">
                          NT${price?.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          /{billingCycle === "yearly" ? t("year") : t("month")}
                        </span>
                      </div>
                      {billingCycle === "yearly" && (
                        <div className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                          {t("equivalentMonthly")} NT$
                          {Math.round((price || 0) / 12).toLocaleString()}/
                          {t("month")}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg p-3 mb-4 bg-amber-50 dark:bg-amber-900/10">
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-5 w-5 text-amber-500" />
                        <span className="text-lg font-bold text-slate-800 dark:text-white">
                          {t("monthly")}{" "}
                          {plan.articles_per_month?.toLocaleString()}{" "}
                          {t("articles")}
                        </span>
                      </div>
                      {billingCycle === "yearly" && yearlyBonus > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-sm text-orange-600 dark:text-orange-400">
                          <Gift className="h-4 w-4" />
                          <span className="font-medium">
                            {t("bonusArticles")} {yearlyBonus} {t("articles")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <ul className="space-y-2 text-sm mb-4 text-slate-600 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                          {t("allAIModels")}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                          {t("wordpressIntegration")}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                          {t("autoImageGen")}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                          {t("scheduledPublish")}
                        </li>
                      </ul>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className={`w-full mt-auto font-bold shadow-lg ${
                        isPopular
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400"
                          : "bg-slate-800 text-white hover:bg-slate-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                      }`}
                    >
                      <Link href="/login">{t("startUsing")}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Article packages */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              <CreditCard className="h-4 w-4" />
              <span>{t("articlePackage")}</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">
              {t("needMoreArticles")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("packageDescArticle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {articlePackages?.map((pkg) => {
              const isPopular = pkg.slug === "pack_5";
              return (
                <Card
                  key={pkg.id}
                  className={`relative bg-white dark:bg-slate-800/50 ${
                    isPopular
                      ? "border-amber-400/50"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      {t("greatValue")}
                    </span>
                  )}
                  <CardContent className="p-6 text-center">
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block mb-1">
                      {pkg.articles?.toLocaleString()} {t("articles")}
                    </span>
                    {pkg.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {pkg.description}
                      </p>
                    )}
                    <div className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                      NT${pkg.price?.toLocaleString()}
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-500"
                    >
                      <Link href="/login">{t("buy")}</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Free note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-slate-400 mt-8"
        >
          {t("story.pricing.freeNote")}
        </motion.p>
      </div>
    </section>
  );
}
