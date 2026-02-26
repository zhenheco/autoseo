"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Gift,
  CheckCircle2,
  CreditCard,
  ArrowRight,
  Zap,
  Sparkles,
} from "lucide-react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import {
  createCardStyle,
  createHeadingStyle,
  gradientTextStyles,
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
      className="relative py-32 bg-slate-950 overflow-hidden"
    >
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-mp-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-mp-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Story Intro - Cost Comparison */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="max-w-4xl mx-auto mb-32"
        >
          <div className="text-center space-y-6 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <Zap className="w-4 h-4 text-mp-accent" />
              {t("story.pricing.intro")}
            </div>
            <h2
              className={createHeadingStyle(
                "hero",
                "text-4xl md:text-6xl text-white font-bold",
              )}
            >
              {t("chooseYourPlan")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Before Card */}
            <motion.div
              variants={fadeUpVariants}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <div className="w-20 h-20 border-4 border-slate-500 rounded-full flex items-center justify-center text-4xl font-black">
                  ?
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-tighter">
                  {t("story.pricing.before")}
                </span>
                <div className="text-4xl md:text-5xl font-black text-slate-400 line-through decoration-mp-primary/50 decoration-4">
                  {t("story.pricing.beforeAmount")}
                </div>
              </div>
              <p className="text-slate-500 text-lg leading-relaxed italic">
                {t("painPoints.expensiveWritersDesc")}
              </p>
            </motion.div>

            {/* After Card */}
            <motion.div
              variants={fadeUpVariants}
              className="bg-gradient-to-br from-mp-primary/10 to-mp-accent/10 backdrop-blur-xl border border-mp-primary/20 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
                <Sparkles className="w-16 h-16 text-mp-primary" />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-bold text-mp-primary uppercase tracking-tighter">
                  {t("story.pricing.after")}
                </span>
                <div className="text-4xl md:text-5xl font-black text-white">
                  {t("story.pricing.afterAmount")}
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-mp-success/20 border border-mp-success/30 rounded-full text-mp-success font-black text-sm">
                {t("story.pricing.saving")}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Plan Selection Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-16 space-y-8"
        >
          {/* Billing Toggle */}
          <div className="relative inline-flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10 shadow-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                layoutId="active-pill"
                className="absolute inset-y-1.5 rounded-xl bg-gradient-to-r from-mp-primary to-mp-accent"
                animate={{
                  left: billingCycle === "monthly" ? "6px" : "50%",
                  right: billingCycle === "monthly" ? "50%" : "6px",
                }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            </AnimatePresence>
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-8 py-3 rounded-xl text-sm font-bold transition-colors duration-200 ${
                billingCycle === "monthly"
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t("monthlyBilling")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-8 py-3 rounded-xl text-sm font-bold transition-colors duration-200 flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t("yearlyBilling")}
              <span className="px-1.5 py-0.5 text-[10px] bg-mp-success/20 text-mp-success rounded border border-mp-success/30">
                {tSub("yearlyBonus")}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto mb-32">
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
                variants={fadeUpVariants}
                initial="hidden"
                whileInView="visible"
                viewport={defaultViewport}
                transition={{ delay: index * 0.1 }}
                className={`relative flex flex-col ${isPopular ? "lg:-mt-4 lg:mb-4" : ""}`}
              >
                {/* Popular Highlight */}
                {isPopular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-mp-primary to-mp-accent text-white px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-xl">
                      {t("mostPopular")}
                    </div>
                  </div>
                )}

                <div
                  className={`flex-1 bg-slate-900/50 backdrop-blur-2xl border rounded-[3rem] p-10 flex flex-col justify-between transition-all duration-500 hover:shadow-3xl ${
                    isPopular
                      ? "border-mp-primary/40 shadow-mp-primary/10"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="space-y-10">
                    {/* Plan Info */}
                    <div className="space-y-4">
                      {storyLabel && (
                        <span className="text-[10px] font-black text-mp-primary uppercase tracking-[0.3em] block">
                          {storyLabel}
                        </span>
                      )}
                      <h3 className="text-3xl font-bold text-white tracking-tight">
                        {getPlanName(plan)}
                      </h3>

                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white tracking-tighter">
                          NT${price?.toLocaleString()}
                        </span>
                        <span className="text-slate-500 font-bold text-sm uppercase">
                          /{billingCycle === "monthly" ? t("month") : t("year")}
                        </span>
                      </div>

                      {billingCycle === "yearly" && (
                        <div className="text-mp-success font-bold text-xs uppercase tracking-tighter">
                          {t("equivalentMonthly")} NT$
                          {Math.round((price || 0) / 12).toLocaleString()} /{" "}
                          {t("month")}
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <div className="space-y-5">
                      <div className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-white font-black text-xl flex items-center gap-2">
                          <FileText className="w-5 h-5 text-mp-primary" />
                          {plan.articles_per_month?.toLocaleString()}{" "}
                          {t("articles")}
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                          {tSub("monthlyQuota")}
                        </p>

                        {billingCycle === "yearly" && yearlyBonus > 0 && (
                          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-mp-success">
                            <Gift className="w-4 h-4" />
                            {t("bonusArticles")} {yearlyBonus} {t("articles")}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 pt-4">
                        {[
                          "allAIModels",
                          "wordpressIntegration",
                          "autoImageGen",
                          "scheduledPublish",
                        ].map((f) => (
                          <div
                            key={f}
                            className="flex items-center gap-3 group/feat"
                          >
                            <div className="w-5 h-5 rounded-full bg-mp-success/10 border border-mp-success/20 flex items-center justify-center group-hover/feat:scale-110 transition-transform">
                              <CheckCircle2 className="w-3 h-3 text-mp-success" />
                            </div>
                            <span className="text-slate-400 text-sm font-medium group-hover:text-slate-200 transition-colors">
                              {t(f)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-12">
                    <Link
                      href="/signup"
                      className={`w-full inline-flex items-center justify-center gap-3 px-8 py-5 rounded-[2rem] font-black text-base transition-all duration-300 group/btn ${
                        isPopular
                          ? "bg-gradient-to-r from-mp-primary to-mp-accent text-white shadow-2xl shadow-mp-primary/20 hover:scale-[1.02] hover:shadow-mp-primary/40"
                          : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {t("startUsing")}
                      <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Packages Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="max-w-5xl mx-auto pt-20 border-t border-white/5"
        >
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mp-accent/10 border border-mp-accent/20 text-xs font-bold text-mp-accent uppercase tracking-[0.2em]">
              <CreditCard className="w-4 h-4" />
              {t("articlePackage")}
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-white">
              {t("needMoreArticles")}
            </h3>
            <p className="text-slate-500 font-medium">
              {t("packageDescArticle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {articlePackages?.map((pkg) => {
              const isPopular = pkg.slug === "pack_5";
              return (
                <div
                  key={pkg.id}
                  className={`relative bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border transition-all duration-300 hover:-translate-y-1 ${
                    isPopular
                      ? "border-mp-accent/50 shadow-2xl shadow-mp-accent/5"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="text-center space-y-6">
                    <div className="space-y-1">
                      <span className="text-3xl font-black text-white">
                        {pkg.articles?.toLocaleString()} {t("articles")}
                      </span>
                      {pkg.description && (
                        <p className="text-slate-500 text-xs font-bold">
                          {pkg.description}
                        </p>
                      )}
                    </div>
                    <div className="text-2xl font-black text-mp-accent tracking-tighter">
                      NT${pkg.price?.toLocaleString()}
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-14 rounded-2xl border-white/10 text-white hover:bg-white/5 hover:text-white font-bold"
                    >
                      <Link href="/login">{t("buy")}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={defaultViewport}
          className="text-center text-xs font-bold text-slate-600 uppercase tracking-[0.3em] mt-20"
        >
          {t("story.pricing.freeNote")}
        </motion.p>
      </div>
    </section>
  );
}
