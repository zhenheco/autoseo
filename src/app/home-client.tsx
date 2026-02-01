"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/layout/navbar";
import {
  BackgroundGrid,
  FloatingOrbs,
  AuroraBackground,
  CyberGlow,
} from "@/components/ui/background-effects";
import { ShimmerText, GradientText } from "@/components/ui/shimmer-text";
import { GlowButtonLink } from "@/components/ui/glow-button";
import {
  Sparkles,
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
  articles: FileText,
  satisfaction: Target,
  costSaving: DollarSign,
} as const;

// 更有說服力的統計數據
const STATS = [
  { key: "users", value: "500+", suffix: "", descKey: "enterpriseUsers" },
  { key: "articles", value: "50,000+", suffix: "", descKey: "articlesGenerated" },
  { key: "satisfaction", value: "4.9", suffix: "/5", descKey: "satisfactionRating" },
  { key: "costSaving", value: "95", suffix: "%", descKey: "costSavingLabel" },
] as const;

const AI_MODEL_KEYS = ["gpt5", "claude45", "gemini3"] as const;

// 痛點資料
const PAIN_POINTS = [
  {
    icon: DollarSign,
    titleKey: "expensiveWriters",
    descKey: "expensiveWritersDesc",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  {
    icon: Clock,
    titleKey: "slowWriting",
    descKey: "slowWritingDesc",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    icon: BarChart3,
    titleKey: "unstableResults",
    descKey: "unstableResultsDesc",
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
] as const;

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
        {/* Hero Section - 強化價值主張 */}
        <section className="relative py-20 sm:py-32 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <AuroraBackground />
          <CyberGlow position="top" color="mixed" />
          <BackgroundGrid variant="dark" />

          <div className="container relative z-10 mx-auto px-4">
            <div className="mx-auto max-w-5xl text-center">
              {/* 社會認證徽章 */}
              <div className="mb-8 inline-flex items-center gap-3 rounded-full bg-white dark:bg-slate-800/80 shadow-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-white text-xs font-bold">
                    A
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-white text-xs font-bold">
                    B
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-500 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-white text-xs font-bold">
                    C
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t("hero.socialProof")}
                </span>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-4 h-4 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
              </div>

              {/* 主標題 - 更強的價值主張 */}
              <h1 className="mb-6 font-bold tracking-tight">
                <span className="text-slate-600 dark:text-slate-400 text-lg md:text-xl block mb-2">
                  {t("hero.subtitle")}
                </span>
                <ShimmerText
                  as="span"
                  className="text-4xl md:text-6xl lg:text-7xl block font-extrabold leading-tight"
                >
                  {t("hero.mainTitle")}
                </ShimmerText>
                <span className="text-2xl md:text-3xl text-slate-800 dark:text-slate-200 block mt-3 font-semibold">
                  {t("hero.valueProposition")}
                </span>
              </h1>

              {/* 副標題 - 具體效益 */}
              <p className="mx-auto mb-10 max-w-3xl text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("hero.description")}
                <span className="text-slate-900 dark:text-white font-medium">
                  {t("hero.descriptionHighlight")}
                </span>
                {t("hero.descriptionSuffix")}
              </p>

              {/* CTA 按鈕組 */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                <GlowButtonLink
                  href="/login"
                  size="lg"
                  variant="primary"
                  glowColor="violet"
                  className="w-full sm:w-auto text-lg px-10 py-7 gap-3 font-bold"
                >
                  <Rocket className="h-6 w-6" />
                  {t("cta.freeTrial")}
                  <ArrowRight className="h-5 w-5" />
                </GlowButtonLink>
              </div>

              {/* 信任指標 */}
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>
                    <strong className="text-slate-900 dark:text-white">
                      {t("trustIndicators.freeArticles")}
                    </strong>{" "}
                    {t("trustIndicators.articleQuota")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>{t("trustIndicators.noCreditCard")}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>{t("trustIndicators.startIn30Sec")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points Section - 痛點區塊 */}
        <section className="relative py-16 bg-slate-50 dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                {t("painPoints.title")}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {PAIN_POINTS.map((pain, index) => {
                const Icon = pain.icon;
                return (
                  <Card
                    key={index}
                    className={`${pain.bgColor} border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                  >
                    <CardContent className="p-6">
                      <Icon className={`h-10 w-10 ${pain.color} mb-4`} />
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        {t(`painPoints.${pain.titleKey}`)}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">
                        {t(`painPoints.${pain.descKey}`)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 解決方案引導 */}
            <div className="text-center mt-12">
              <div className="inline-flex items-center gap-2 text-lg font-semibold text-blue-600 dark:text-blue-400">
                <ArrowRight className="h-5 w-5" />
                {t("painPoints.solution")}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar - 強化社會認證 */}
        <section className="relative py-16 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyber-violet-500/10 via-transparent to-transparent" />
          <div className="container relative z-10 mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                {t("statsBar.title")}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {STATS.map((stat, index) => {
                const Icon = STAT_ICONS[stat.key as keyof typeof STAT_ICONS];
                return (
                  <div
                    key={index}
                    className="relative group text-center p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyber-violet-500/50 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyber-cyan-500/5 to-cyber-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyber-cyan-500/20 to-cyber-violet-500/20 mb-4 ring-2 ring-white/10 group-hover:ring-cyber-violet-500/30 transition-all">
                        <Icon className="h-6 w-6 text-cyber-cyan-400" />
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                        {stat.value}
                        {stat.suffix && (
                          <span className="text-xl text-cyber-cyan-400">
                            {stat.suffix}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-400">
                        {t(`statsData.${stat.descKey}`)}
                      </div>
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
                      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-violet-500/30">
                        <Icon className="h-6 w-6 text-white" />
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
                  {t("subscriptionPlans")}
                </GradientText>
                <span className="text-slate-900 dark:text-white text-xl md:text-2xl ml-2">
                  {t("chooseYourPlan")}
                </span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                {t("subscriptionDesc")}
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
                  {t("monthlyBilling")}
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 text-white"
                >
                  {t("yearlyBilling")}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      billingCycle === "yearly"
                        ? "bg-yellow-400 text-slate-900"
                        : "bg-yellow-400/80 text-slate-900"
                    }`}
                  >
                    {t("yearlyBonus")}
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
                              ? t("year")
                              : t("month")}
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

                      {/* 每月篇數 */}
                      <div className="rounded-lg p-3 mb-4 bg-slate-100 dark:bg-white/5">
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-cyber-violet-500" />
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {t("monthly")}{" "}
                            {plan.articles_per_month?.toLocaleString()}{" "}
                            {t("articles")}
                          </span>
                        </div>
                        {billingCycle === "yearly" && yearlyBonus > 0 && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-sm text-cyber-magenta-500 dark:text-cyber-magenta-400">
                            <Gift className="h-4 w-4" />
                            <span className="font-medium">
                              {t("bonusArticles")} {yearlyBonus}{" "}
                              {t("articles")}
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
                  <span>{t("articlePackage")}</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                  {t("needMoreArticles")}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("packageDescArticle")}
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
                          {t("articles")}
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

        {/* Final CTA Section - 強化轉換 */}
        <section className="relative py-24 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <AuroraBackground showRadialGradient={false} />
          <CyberGlow position="center" color="mixed" />
          <FloatingOrbs />

          <div className="container relative z-10 mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              {/* 緊迫性標籤 */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                <Gift className="h-4 w-4" />
                <span>{t("finalCta.limitedOffer")}</span>
              </div>

              <h2 className="font-bold mb-6">
                <span className="text-slate-700 dark:text-slate-300 text-lg md:text-xl block mb-2">
                  {t("finalCta.hesitating")}
                </span>
                <ShimmerText
                  as="span"
                  className="text-3xl md:text-5xl block leading-tight"
                >
                  {t("finalCta.letAiHelp")}
                </ShimmerText>
              </h2>

              <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg max-w-2xl mx-auto">
                {t("finalCta.description")} <strong className="text-slate-900 dark:text-white">{t("finalCta.freeArticlesStrong")}</strong>
                {t("finalCta.descriptionSuffix")}
              </p>

              {/* CTA 按鈕組 */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <GlowButtonLink
                  href="/login"
                  size="lg"
                  variant="primary"
                  glowColor="mixed"
                  className="text-lg px-10 py-7 gap-3 group font-bold"
                >
                  <Rocket className="h-6 w-6" />
                  {t("cta.freeTrialShort")}
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </GlowButtonLink>
              </div>

              {/* 信任保證 */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{t("finalCta.freeArticles")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{t("finalCta.noBindCreditCard")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{t("finalCta.cancelAnytime")}</span>
                </div>
              </div>
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
