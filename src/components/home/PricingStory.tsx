"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check, ArrowRight, Star } from "lucide-react";
import {
  fadeUpVariants,
  defaultViewport,
  containerVariants,
} from "@/lib/animations";
import { PricingProps, ArticlePlan } from "@/types/pricing";

const PlanToggle = ({ billingCycle, setBillingCycle, t, tSub }: any) => (
  <div className="relative inline-flex items-center p-1 rounded-btn bg-bg-subtle border border-border">
    <div
      className="absolute inset-y-1 rounded-lg bg-card shadow-sm transition-transform duration-300"
      style={{
        width: "calc(50% - 4px)",
        transform:
          billingCycle === "yearly"
            ? "translateX(calc(100% - 4px))"
            : "translateX(0)",
      }}
    />
    <button
      onClick={() => setBillingCycle("monthly")}
      className="relative z-10 px-6 py-2 rounded-lg text-sm font-semibold transition-colors duration-300"
    >
      {t("monthlyBilling")}
    </button>
    <button
      onClick={() => setBillingCycle("yearly")}
      className="relative z-10 px-6 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 flex items-center gap-2"
    >
      {t("yearlyBilling")}
      <span className="px-2 py-0.5 text-xs rounded-full bg-success text-white">
        {tSub("yearlyBonus")}
      </span>
    </button>
  </div>
);

const PlanCard = ({
  plan,
  billingCycle,
  isPopular,
  t,
  tSub,
  getPlanName,
}: any) => {
  const price =
    billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
  const period = billingCycle === "monthly" ? t("month") : t("year");

  const baseClasses =
    "relative flex flex-col p-8 border border-border rounded-card shadow-sm transition-all duration-300";
  const popularClasses =
    "bg-primary text-white md:-translate-y-4 shadow-xl border-primary";
  const standardClasses = "bg-card";

  return (
    <div
      className={`${baseClasses} ${isPopular ? popularClasses : standardClasses}`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cta text-cta-foreground px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
          <Star className="w-3 h-3" />
          {t("mostPopular")}
        </div>
      )}

      <h3
        className={`text-xl font-bold mb-2 text-center ${isPopular ? "text-white" : "text-text-main"}`}
      >
        {getPlanName(plan)}
      </h3>

      <div className="text-center mb-8">
        <span
          className={`text-5xl font-bold tracking-tight ${isPopular && "text-white"}`}
        >
          NT${price?.toLocaleString()}
        </span>
        <span
          className={`${isPopular ? "text-primary-foreground/70" : "text-text-muted"}`}
        >
          {" "}
          / {period}
        </span>
      </div>

      <ul className="space-y-3 flex-1 mb-8">
        {[
          "allAIModels",
          "wordpressIntegration",
          "autoImageGen",
          "scheduledPublish",
        ].map((f) => (
          <li key={f} className="flex items-center gap-3">
            <Check
              className={`w-5 h-5 ${isPopular ? "text-green-300" : "text-success"}`}
            />
            <span
              className={`${isPopular ? "text-primary-foreground/90" : "text-text-subtle"}`}
            >
              {t(f)}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-btn font-bold text-base transition-colors duration-300 ${
          isPopular
            ? "bg-cta text-cta-foreground hover:bg-cta-hover"
            : "btn-primary"
        }`}
      >
        {t("startUsing")}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
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

  return (
    <section id="pricing" className="bg-bg-subtle section-padding">
      <div className="container-section">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          variants={containerVariants}
          className="text-center mb-12 space-y-4"
        >
          <motion.div
            variants={fadeUpVariants}
            className="inline-flex items-center bg-accent text-primary-dark text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            {t("pricingPlan")}
          </motion.div>
          <motion.h2
            variants={fadeUpVariants}
            className="text-3xl md:text-4xl font-bold text-text-main"
          >
            {t("chooseYourPlan")}
          </motion.h2>
          <motion.p
            variants={fadeUpVariants}
            className="text-lg md:text-xl text-text-subtle max-w-2xl mx-auto"
          >
            {t("subscriptionDesc")}
          </motion.p>
          <motion.div variants={fadeUpVariants} className="pt-4">
            <PlanToggle {...{ billingCycle, setBillingCycle, t, tSub }} />
          </motion.div>
        </motion.div>

        {/* Plans Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center"
        >
          {plans?.map((plan) => (
            <motion.div key={plan.id} variants={fadeUpVariants}>
              <PlanCard
                plan={plan}
                billingCycle={billingCycle}
                isPopular={plan.slug === "pro"}
                t={t}
                tSub={tSub}
                getPlanName={getPlanName}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Packages Section */}
        {articlePackages && articlePackages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={defaultViewport}
            className="max-w-4xl mx-auto pt-20 mt-20 border-t border-border"
          >
            <div className="text-center space-y-2 mb-10">
              <h3 className="text-3xl font-bold text-text-main">
                {t("needMoreArticles")}
              </h3>
              <p className="text-text-subtle text-lg">
                {t("packageDescArticle")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {articlePackages.map((pkg) => (
                <div key={pkg.id} className="card-base p-6 text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {pkg.articles?.toLocaleString()} {t("articles")}
                  </div>
                  <div className="text-xl font-semibold text-text-main mb-4">
                    NT${pkg.price?.toLocaleString()}
                  </div>
                  <Link href="/login" className="w-full btn-secondary">
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
