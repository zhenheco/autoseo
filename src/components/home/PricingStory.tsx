"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Gift, CheckCircle2, CreditCard } from "lucide-react";
import { fadeUpVariants, defaultViewport } from "@/lib/animations";
import {
  createCardStyle,
  createHeadingStyle,
  createTextStyle,
  gradientTextStyles,
  badgeStyles,
  buttonStyles,
} from "@/lib/styles";
import { PricingProps, ArticlePlan } from "@/types/pricing";

const PLAN_STORY_KEYS: Record<string, string> = {
  starter: "story.pricing.tryFirst",
  pro: "story.pricing.serious",
  business: "story.pricing.team",
};

export function PricingStory({ plans, articlePackages }: PricingProps) {
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
      className="relative py-24 bg-mp-bg bg-noise overflow-hidden"
    >
      {/* Ambient background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-mp-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-mp-accent/8 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-16"
        >
          <h2 className={createHeadingStyle("hero", "mb-6")}>
            選擇最適合您的
            <span className={`block ${gradientTextStyles.primary}`}>方案</span>
          </h2>
          <p
            className={createTextStyle(
              "secondary",
              "",
              "text-xl max-w-2xl mx-auto mb-12",
            )}
          >
            靈活的定價方案，滿足個人創作者到企業團隊的各種需求
          </p>

          {/* Enhanced Billing Toggle */}
          <div className="relative inline-flex items-center gap-1 p-1 rounded-2xl bg-gradient-to-r from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl border border-mp-primary/20 shadow-lg mb-8">
            <motion.div
              className="absolute inset-y-1 rounded-xl bg-gradient-to-r from-mp-primary to-mp-accent transition-all duration-300 ease-out"
              animate={{
                left: billingCycle === "monthly" ? "4px" : "50%",
                right: billingCycle === "monthly" ? "50%" : "4px",
              }}
            />
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-6 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                billingCycle === "monthly"
                  ? "text-white"
                  : "text-mp-text-secondary hover:text-mp-text"
              }`}
            >
              月付方案
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-6 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "text-white"
                  : "text-mp-text-secondary hover:text-mp-text"
              }`}
            >
              年付方案
              <span className="px-2 py-1 text-xs font-bold bg-mp-success/20 text-mp-success rounded-lg border border-mp-success/30">
                省更多
              </span>
            </button>
          </div>

          {/* Savings Badge */}
          {billingCycle === "yearly" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-mp-success/10 border border-mp-success/30 rounded-full text-sm text-mp-success font-semibold mb-8"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              年付最高可省 17%
            </motion.div>
          )}
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                className={`group relative ${isPopular ? "lg:scale-110" : ""}`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-mp-primary to-mp-accent blur-lg opacity-75" />
                      <div className="relative bg-gradient-to-r from-mp-primary to-mp-accent text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                        最受歡迎
                      </div>
                    </div>
                  </div>
                )}

                {/* Card */}
                <div
                  className={`relative bg-gradient-to-br from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl rounded-3xl p-8 h-full border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                    isPopular
                      ? "border-mp-primary/40 shadow-xl shadow-mp-primary/10"
                      : "border-mp-primary/20 hover:border-mp-primary/30 hover:shadow-mp-primary/5"
                  }`}
                >
                  {/* Plan Name */}
                  <div className="mb-8">
                    {storyLabel && (
                      <p className="text-xs text-mp-accent font-medium mb-2 uppercase tracking-wide">
                        {storyLabel}
                      </p>
                    )}
                    <h3 className="text-2xl font-bold font-geist text-mp-text mb-4">
                      {getPlanName(plan)}
                    </h3>

                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-bold text-mp-text font-geist">
                        ${price?.toLocaleString()}
                      </span>
                      <div className="flex flex-col text-sm text-mp-text-secondary">
                        <span>/{billingCycle === "yearly" ? "年" : "月"}</span>
                        {billingCycle === "yearly" && (
                          <span className="text-xs">
                            約 ${Math.round((price || 0) / 12).toLocaleString()}
                            /月
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Article Count */}
                  <div
                    className={`rounded-2xl p-4 mb-6 border ${
                      isPopular
                        ? "bg-mp-primary/10 border-mp-primary/30"
                        : "bg-mp-accent/10 border-mp-accent/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`p-2 rounded-lg ${
                          isPopular ? "bg-mp-primary/20" : "bg-mp-accent/20"
                        }`}
                      >
                        <FileText
                          className={`h-5 w-5 ${
                            isPopular ? "text-mp-primary" : "text-mp-accent"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-mp-text">
                          {plan.articles_per_month?.toLocaleString()} 篇文章
                        </div>
                        <div className="text-sm text-mp-text-secondary">
                          每月額度
                        </div>
                      </div>
                    </div>

                    {billingCycle === "yearly" && yearlyBonus > 0 && (
                      <div className="flex items-center gap-2 text-sm text-mp-success">
                        <Gift className="h-4 w-4" />
                        <span className="font-medium">
                          年付送 {yearlyBonus} 篇額外文章
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    {[
                      "全部 AI 模型",
                      "WordPress 整合",
                      "自動圖片生成",
                      "排程發布",
                      "50+ 語系支援",
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 bg-mp-success/20 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-mp-success" />
                        </div>
                        <span className="text-sm text-mp-text-secondary">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <Link
                    href="/signup"
                    className={`group/btn relative w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                      isPopular
                        ? "bg-gradient-to-r from-mp-primary to-mp-accent text-white hover:shadow-xl hover:shadow-mp-primary/25 hover:-translate-y-0.5"
                        : "border border-mp-primary/50 text-mp-text hover:bg-mp-primary/10 hover:border-mp-primary"
                    }`}
                  >
                    開始使用
                    <svg
                      className="w-4 h-4 transition-transform group-hover/btn:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                    {isPopular && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-mp-primary/20 to-mp-accent/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
                    )}
                  </Link>
                </div>
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
