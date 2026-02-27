"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { FileText, Gift, CheckCircle2, ArrowRight, Star } from "lucide-react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { PricingProps, ArticlePlan } from "@/types/pricing";

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

  return (
    <section
      id="pricing"
      className="relative py-32 bg-slate-50 overflow-hidden"
    >
      <div className="container relative z-10 mx-auto px-4 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          className="text-center mb-16 space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 text-sm font-bold text-blue-700 uppercase tracking-widest">
            {t("pricingPlan")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight">
            {t("chooseYourPlan")}
          </h2>
          <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
            {t("subscriptionDesc")}
          </p>

          {/* Billing Toggle */}
          <div className="relative inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                layoutId="active-pill-pricing"
                className="absolute inset-y-1.5 rounded-xl bg-slate-900"
                animate={{
                  left: billingCycle === "monthly" ? "6px" : "50%",
                  right: billingCycle === "monthly" ? "50%" : "6px",
                }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            </AnimatePresence>
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 px-8 py-3 rounded-xl text-sm font-bold transition-colors duration-200 w-32 ${
                billingCycle === "monthly"
                  ? "text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("monthlyBilling")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 px-8 py-3 rounded-xl text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-2 w-48 ${
                billingCycle === "yearly"
                  ? "text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("yearlyBilling")}
              <span
                className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider ${
                  billingCycle === "yearly"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {tSub("yearlyBonus")}
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plans Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24"
        >
          {plans?.map((plan, index) => {
            const isPopular = plan.slug === "pro";
            const price =
              billingCycle === "yearly"
                ? plan.yearly_price
                : plan.monthly_price;
            const yearlyBonus = plan.articles_per_month * 2;

            return (
              <motion.div
                key={plan.id}
                variants={fadeUpVariants}
                className={`relative flex flex-col rounded-[2.5rem] bg-white border p-8 xl:p-10 transition-all duration-300 hover:shadow-xl ${
                  isPopular
                    ? "border-indigo-500 shadow-indigo-500/10 shadow-2xl md:-mt-4 md:mb-4 z-10"
                    : "border-slate-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 fill-white" />
                    {t("mostPopular")}
                  </div>
                )}

                <div className="flex-1 space-y-8">
                  <div className="space-y-4 text-center">
                    <h3 className="text-2xl font-bold text-slate-900">
                      {getPlanName(plan)}
                    </h3>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-5xl font-black text-slate-900 tracking-tighter">
                        NT${price?.toLocaleString()}
                      </span>
                      <span className="text-slate-500 font-bold mb-1">
                        /{billingCycle === "monthly" ? t("month") : t("year")}
                      </span>
                    </div>
                    {billingCycle === "yearly" && (
                      <div className="text-emerald-600 font-bold text-sm">
                        {t("equivalentMonthly")} NT$
                        {Math.round((price || 0) / 12).toLocaleString()} /{" "}
                        {t("month")}
                      </div>
                    )}
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="text-slate-900 font-black text-2xl flex items-center gap-2">
                      <FileText className="w-6 h-6 text-indigo-600" />
                      {plan.articles_per_month?.toLocaleString()}{" "}
                      {t("articles")}
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                      {tSub("monthlyQuota")}
                    </p>
                    {billingCycle === "yearly" && yearlyBonus > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mt-2">
                        <Gift className="w-3.5 h-3.5" />
                        {t("bonusArticles")} {yearlyBonus} {t("articles")}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-4">
                    {[
                      "allAIModels",
                      "wordpressIntegration",
                      "autoImageGen",
                      "scheduledPublish",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <span className="text-slate-600 font-medium">
                          {t(f)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-10">
                  <Link
                    href="/signup"
                    className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-base transition-all duration-300 ${
                      isPopular
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-xl"
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    }`}
                  >
                    {t("startUsing")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Packages Section */}
        {articlePackages && articlePackages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={defaultViewport}
            className="max-w-5xl mx-auto pt-20 border-t border-slate-200"
          >
            <div className="text-center space-y-4 mb-12">
              <h3 className="text-3xl font-bold text-slate-900">
                {t("needMoreArticles")}
              </h3>
              <p className="text-slate-500 font-medium">
                {t("packageDescArticle")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {articlePackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-indigo-300 transition-colors duration-300 flex flex-col items-center text-center shadow-sm"
                >
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {pkg.articles?.toLocaleString()} {t("articles")}
                  </div>
                  <div className="text-xl font-bold text-indigo-600 mb-6">
                    NT${pkg.price?.toLocaleString()}
                  </div>
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold transition-colors"
                  >
                    {t("buy")}
                  </Link>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
