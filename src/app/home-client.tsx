"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import {
  BackgroundGrid,
  FloatingOrbs,
  ParticleField,
  AuroraBackground,
  CyberGlow,
} from "@/components/ui/background-effects";
import { ShimmerText, GradientText } from "@/components/ui/shimmer-text";
import { GlowButtonLink } from "@/components/ui/glow-button";
import {
  Sparkles,
  Zap,
  Users,
  Globe,
  FileText,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Rocket,
  Target,
  Search,
  PenTool,
  Image,
  Link as LinkIcon,
  Calendar,
  Infinity,
  CreditCard,
  Brain,
  Clock,
  DollarSign,
  Gift,
} from "lucide-react";
import { TestimonialsCarousel } from "@/components/home/TestimonialsCarousel";
import { CostComparison } from "@/components/home/CostComparison";
import { FAQSection } from "@/components/home/FAQSection";
import { useTranslations } from "next-intl";

/** 篇數制方案資料類型 */
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

/** 文章加購包資料類型 */
interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
}

interface HomeClientProps {
  plans: ArticlePlan[];
  articlePackages: ArticlePackage[];
}

// Feature icon mapping
const FEATURE_ICONS = {
  keywordResearch: Search,
  webResearch: Globe,
  competitorAnalysis: BarChart3,
  structureGeneration: FileText,
  aiWriting: PenTool,
  imageGeneration: Image,
  linkOptimization: LinkIcon,
  aiSearchOptimization: Sparkles,
  autoPublish: Calendar,
} as const;

const FEATURE_KEYS = [
  "keywordResearch",
  "webResearch",
  "competitorAnalysis",
  "structureGeneration",
  "aiWriting",
  "imageGeneration",
  "linkOptimization",
  "aiSearchOptimization",
  "autoPublish",
] as const;

const STAT_ICONS = {
  users: Users,
  costSaving: DollarSign,
  articleTime: Clock,
} as const;

const STATS = [
  { key: "users", value: "500+", suffix: "" },
  { key: "costSaving", value: "95", suffix: "%" },
  { key: "articleTime", value: "10", suffix: "" },
] as const;

const AI_MODEL_KEYS = ["gpt5", "claude45", "gemini3"] as const;

export function HomeClient({ plans, articlePackages }: HomeClientProps) {
  const t = useTranslations("home");
  const tSub = useTranslations("subscription");

  // 計費週期狀態（預設年繳）
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "yearly",
  );

  // 獲取翻譯後的方案名稱
  const getPlanName = (plan: ArticlePlan) => {
    const slug = plan.slug || "";
    const translatedName = tSub.raw(`plans.${slug}`);
    return typeof translatedName === "string" ? translatedName : plan.name;
  };

  // 計算年繳加贈的篇數（原始額度 × 200%）
  const getYearlyBonus = (plan: ArticlePlan) => {
    return plan.articles_per_month * 2;
  };

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-24 bg-white dark:bg-slate-800">
          <AuroraBackground />
          <CyberGlow position="top" color="mixed" />
          <BackgroundGrid variant="dark" />
          <ParticleField count={20} variant="mixed" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
                <Zap className="h-4 w-4" />
                <span>{t("heroTagline")}</span>
              </div>

              <h1 className="mb-6 font-bold tracking-tight">
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl block">
                  {t("heroTitle1")}
                </span>
                <ShimmerText
                  as="span"
                  className="text-4xl md:text-6xl block mt-2 font-extrabold"
                >
                  {t("heroTitle2")}
                </ShimmerText>
              </h1>

              <p className="mx-auto mb-8 max-w-3xl text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                {t("heroDescription")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <GlowButtonLink
                  href="/login"
                  size="lg"
                  variant="primary"
                  glowColor="violet"
                  className="w-full sm:w-auto text-lg px-8 py-6 gap-2"
                >
                  <Rocket className="h-5 w-5" />
                  {t("freeStart")}
                  <ArrowRight className="h-5 w-5" />
                </GlowButtonLink>
              </div>

              <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyber-cyan-400" />
                  <span className="text-slate-900 dark:text-white font-medium">
                    {t("freeCredits")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyber-cyan-400" />
                  <span>{t("noCreditCard")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyber-cyan-400" />
                  <span>{t("canGenerate")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="relative py-12 bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-indigo-950">
          <div className="container relative z-10 mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {STATS.map((stat, index) => {
                const Icon = STAT_ICONS[stat.key as keyof typeof STAT_ICONS];
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-transparent dark:glass shadow-lg dark:shadow-none border border-slate-200 dark:border-white/10 rounded-xl p-6 text-center hover:border-cyber-violet-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyber-cyan-500/20 to-cyber-violet-500/20 dark:bg-cyber-violet-500/20 mb-4 ring-2 ring-cyber-violet-500/20">
                      <Icon className="h-6 w-6 text-cyber-violet-600 dark:text-cyber-cyan-400" />
                    </div>
                    <GradientText
                      as="span"
                      gradient="cyan-violet-magenta"
                      className="text-3xl md:text-4xl font-bold block"
                    >
                      {stat.value}
                      {stat.suffix && (
                        <span className="text-2xl">{stat.suffix}</span>
                      )}
                    </GradientText>
                    <div className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                      {t(`stats.${stat.key}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Cost Comparison */}
        <CostComparison />

        {/* AI Technology Section */}
        <section className="relative py-20 bg-white dark:bg-slate-800">
          <FloatingOrbs />
          <BackgroundGrid variant="dark" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
                <Brain className="h-4 w-4" />
                <span>{t("aiTech")}</span>
              </div>
              <h2 className="font-bold mb-4">
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
                  {t("integrate")}
                </span>
                <GradientText
                  as="span"
                  gradient="cyan-violet-magenta"
                  className="text-4xl md:text-5xl ml-2"
                >
                  {t("topAIModels")}
                </GradientText>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                {t("aiModelsDesc")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {AI_MODEL_KEYS.map((modelKey, index) => (
                <Card
                  key={index}
                  className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-cyber-violet-500/20 text-center hover:border-cyber-violet-500/50 transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <GradientText
                      as="span"
                      gradient="cyan-violet"
                      className="text-lg font-bold block mb-1"
                    >
                      {t(`aiModels.${modelKey}`)}
                    </GradientText>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {t(`aiModels.${modelKey}Desc`)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="relative py-20 bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-indigo-950"
        >
          <BackgroundGrid variant="dark" />
          <CyberGlow position="center" color="violet" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="text-center mb-16">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
                <Target className="h-4 w-4" />
                <span>{t("completeWorkflow")}</span>
              </div>
              <h2 className="font-bold mb-4">
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
                  {t("fromResearchTo")}
                </span>
                <GradientText
                  as="span"
                  gradient="cyan-violet-magenta"
                  className="text-4xl md:text-5xl"
                >
                  {t("fullAutomation")}
                </GradientText>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
                {t("nineFeatures")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURE_KEYS.map((featureKey, index) => {
                const Icon = FEATURE_ICONS[featureKey];
                return (
                  <Card
                    key={index}
                    className="bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-white/10 hover:border-cyber-violet-500/50 hover:-translate-y-2 transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyber-cyan-700 to-cyber-violet-700 shadow-lg shadow-cyber-violet-500/25">
                        <Icon className="h-6 w-6 text-white drop-shadow-sm" />
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                        {t(`features.${featureKey}`)}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        {t(`features.${featureKey}Desc`)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="relative py-20 bg-white dark:bg-slate-800">
          <BackgroundGrid variant="dark" />
          <div className="container relative z-10 mx-auto px-4">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
                <Users className="h-4 w-4" />
                <span>{t("customerTestimonials")}</span>
              </div>
              <h2 className="font-bold mb-4">
                <GradientText
                  as="span"
                  gradient="cyan-violet-magenta"
                  className="text-4xl md:text-5xl"
                >
                  {t("users")}
                </GradientText>
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl ml-2">
                  {t("saySomething")}
                </span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                {t("seeHow")}
              </p>
            </div>

            <TestimonialsCarousel />
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="pricing"
          className="relative py-20 bg-white dark:bg-gradient-to-b dark:from-indigo-950 dark:to-slate-900"
        >
          <BackgroundGrid variant="dark" />
          <CyberGlow position="top" color="magenta" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-transparent px-4 py-2 text-sm font-medium text-cyber-magenta-600 dark:text-cyber-magenta-400">
                <Sparkles className="h-4 w-4" />
                <span>{t("pricingPlan")}</span>
              </div>
              <h2 className="font-bold mb-4">
                <GradientText
                  as="span"
                  gradient="violet-magenta"
                  className="text-4xl md:text-5xl"
                >
                  {t("subscriptionPlans") || "訂閱方案"}
                </GradientText>
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl ml-2">
                  {t("chooseYourPlan") || "選擇適合您的方案"}
                </span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                {t("subscriptionDesc") ||
                  "每月自動重置文章額度，讓您持續產出高品質內容"}
              </p>

              {/* 月繳/年繳切換器 */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-800/50 shadow-md border border-slate-200 dark:border-white/10 p-1 mb-8">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    billingCycle === "monthly"
                      ? "bg-slate-900 dark:bg-cyber-violet-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {t("monthlyBilling") || "月繳"}
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 text-white"
                >
                  {t("yearlyBilling") || "年繳"}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      billingCycle === "yearly"
                        ? "bg-yellow-400 text-slate-900"
                        : "bg-yellow-400/80 text-slate-900"
                    }`}
                  >
                    {t("yearlyBonus") || "多送200%"}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
              {plans?.map((plan) => {
                const isPopular = plan.slug === "pro";
                const price =
                  billingCycle === "yearly"
                    ? plan.yearly_price
                    : plan.monthly_price;
                const yearlyBonus = getYearlyBonus(plan);

                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col h-full transition-all duration-300 ${
                      isPopular
                        ? "bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl text-slate-900 dark:text-white border-cyber-violet-500 shadow-lg dark:shadow-cyber-violet-500/30 scale-105"
                        : "bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-white/10 hover:border-cyber-violet-500/50"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        {t("mostPopular")}
                      </div>
                    )}
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="mb-3">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {getPlanName(plan)}
                        </h3>
                      </div>
                      <div className="mb-5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-slate-900 dark:text-white">
                            NT${price?.toLocaleString()}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            /
                            {billingCycle === "yearly"
                              ? t("year") || "年"
                              : t("month") || "月"}
                          </span>
                        </div>
                        {billingCycle === "yearly" && (
                          <div className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                            {t("equivalentMonthly") || "約"} NT$
                            {Math.round((price || 0) / 12).toLocaleString()}/
                            {t("month") || "月"}
                          </div>
                        )}
                      </div>

                      {/* 每月篇數 */}
                      <div className="rounded-lg p-3 mb-4 bg-slate-100 dark:bg-white/5">
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-cyber-violet-500" />
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {t("monthly") || "每月"}{" "}
                            {plan.articles_per_month?.toLocaleString()}{" "}
                            {t("articles") || "篇"}
                          </span>
                        </div>
                        {billingCycle === "yearly" && yearlyBonus > 0 && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-sm text-cyber-magenta-500 dark:text-cyber-magenta-400">
                            <Gift className="h-4 w-4" />
                            <span className="font-medium">
                              {t("bonusArticles") || "每月加贈"} {yearlyBonus}{" "}
                              {t("articles") || "篇"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <ul className="space-y-2 text-sm mb-4 text-slate-700 dark:text-slate-300">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                            {t("allAIModels")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                            {t("wordpressIntegration")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                            {t("autoImageGen")}
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                            {t("scheduledPublish")}
                          </li>
                        </ul>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        className={`w-full mt-auto font-bold ${
                          isPopular
                            ? "bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 text-white hover:from-cyber-violet-500 hover:to-cyber-magenta-500"
                            : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-gradient-to-r dark:from-cyber-violet-600 dark:to-cyber-magenta-600 dark:hover:from-cyber-violet-500 dark:hover:to-cyber-magenta-500"
                        } shadow-lg`}
                      >
                        <Link href="/login">{t("startUsing")}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 加購包區塊 */}
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border border-slate-200 dark:border-cyber-cyan-500/30 px-4 py-2 text-sm font-medium text-cyber-cyan-600 dark:text-cyber-cyan-400">
                  <CreditCard className="h-4 w-4" />
                  <span>{t("articlePackage") || "文章加購包"}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                  {t("needMoreArticles") || "需要更多文章額度？"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("packageDescArticle") ||
                    "加購額度永久有效，不受訂閱週期限制"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto items-stretch">
                {articlePackages?.map((pkg) => {
                  const isPopular = pkg.slug === "pack_5";
                  return (
                    <Card
                      key={pkg.id}
                      className={`relative bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none ${
                        isPopular
                          ? "border-cyber-cyan-400/50"
                          : "border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {isPopular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                          {t("greatValue")}
                        </span>
                      )}
                      <CardContent className="p-6 text-center">
                        <GradientText
                          as="span"
                          gradient="cyan-violet"
                          className="text-lg font-bold block mb-1"
                        >
                          {pkg.articles?.toLocaleString()}{" "}
                          {t("articles") || "篇"}
                        </GradientText>
                        {pkg.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {pkg.description}
                          </p>
                        )}
                        <div className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                          NT${pkg.price?.toLocaleString()}
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="w-full border-cyber-violet-500 text-cyber-violet-600 dark:text-cyber-violet-400 hover:bg-cyber-violet-500/10 hover:border-cyber-violet-400"
                        >
                          <Link href="/login">{t("buy")}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <FAQSection />

        {/* Final CTA Section */}
        <section className="relative py-20 bg-white dark:bg-slate-800 overflow-hidden">
          <AuroraBackground showRadialGradient={false} />
          <CyberGlow position="center" color="mixed" />
          <FloatingOrbs />

          <div className="container relative z-10 mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="font-bold mb-6">
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
                  {t("readyTo")}
                </span>
                <ShimmerText as="span" className="text-4xl md:text-5xl mx-2">
                  {t("upgradeStrategy")}
                </ShimmerText>
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl">
                  {t("questionMark")}
                </span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                {t("registerNow")}
              </p>
              <GlowButtonLink
                href="/login"
                size="lg"
                variant="primary"
                glowColor="mixed"
                className="text-lg px-10 py-7 gap-2 group"
              >
                <Rocket className="h-5 w-5" />
                {t("freeStartUsing")}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </GlowButtonLink>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative py-8 bg-white dark:bg-slate-950">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-violet-500/50 to-transparent" />

          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-slate-700 dark:text-slate-500 text-sm">
                © 2024 1WaySEO. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
                <Link
                  href="/blog"
                  className="hover:text-cyber-cyan-400 transition-colors"
                >
                  {t("blog")}
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-cyber-cyan-400 transition-colors"
                >
                  {t("terms")}
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-cyber-cyan-400 transition-colors"
                >
                  {t("privacy")}
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
