import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BackgroundGrid,
  HeroGlow,
  FloatingOrbs,
  ParticleField,
} from "@/components/ui/background-effects";
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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { TestimonialsCarousel } from "@/components/home/TestimonialsCarousel";
import { CostComparison } from "@/components/home/CostComparison";
import { FAQSection } from "@/components/home/FAQSection";

const features = [
  {
    icon: Search,
    title: "智能關鍵字研究",
    description: "AI 自動分析高價值關鍵字，找出最佳排名機會",
  },
  {
    icon: Globe,
    title: "網路資料調查",
    description: "自動爬取分析相關網路資訊，確保內容深度與準確性",
  },
  {
    icon: BarChart3,
    title: "競業分析",
    description: "深度分析競爭對手內容策略，找出差異化優勢",
  },
  {
    icon: FileText,
    title: "智能架構生成",
    description: "依照關鍵字與搜尋結果自動決定最佳文章字數與架構",
  },
  {
    icon: PenTool,
    title: "AI 寫作引擎",
    description: "整合所有研究資料，生成高品質 SEO 優化文章",
  },
  {
    icon: Image,
    title: "圖片自動生成",
    description: "AI 自動生成相關配圖，增強內容視覺吸引力",
  },
  {
    icon: LinkIcon,
    title: "內外部連結優化",
    description: "智能建議內外部連結策略，提升網站權重",
  },
  {
    icon: Sparkles,
    title: "AI 檢索優化",
    description: "針對 AI 搜尋引擎優化，提升 SGE 曝光機會",
  },
  {
    icon: Calendar,
    title: "自動發文排程",
    description: "一鍵發布 WordPress，支援排程自動化發文",
  },
];

const aiModels = [
  { name: "GPT-5", description: "OpenAI 最新旗艦模型" },
  { name: "Claude 4.5", description: "Anthropic 高性能模型" },
  { name: "Gemini 3 Pro", description: "Google 多模態模型" },
];

const stats = [
  {
    icon: Users,
    value: "500+",
    label: "已服務用戶",
    suffix: "",
  },
  {
    icon: DollarSign,
    value: "95",
    label: "節省內容成本",
    suffix: "%",
  },
  {
    icon: Clock,
    value: "10",
    label: "分鐘完成一篇文章",
    suffix: "分鐘",
  },
];

export default async function Home() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select<"*", Database["public"]["Tables"]["subscription_plans"]["Row"]>("*")
    .eq("is_lifetime", true)
    .neq("slug", "free")
    .order("lifetime_price", { ascending: true });

  const { data: tokenPackages } = await supabase
    .from("token_packages")
    .select<"*", Database["public"]["Tables"]["token_packages"]["Row"]>("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Hero Section - Dark */}
      <section className="relative py-16 sm:py-24 bg-dark-section">
        <HeroGlow />
        <BackgroundGrid variant="dark" />
        <ParticleField count={20} variant="mixed" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass-dark px-4 py-2 text-sm font-medium text-tech-blue-400">
              <Zap className="h-4 w-4" />
              <span>AI 驅動的 SEO 內容平台</span>
            </div>

            <h1 className="mb-6 font-bold tracking-tight">
              <span className="text-text-dark-primary text-xl md:text-2xl block">
                讓 AI 為您打造
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400 text-4xl md:text-6xl block mt-2">
                完美的 SEO 內容
              </span>
            </h1>

            <p className="mx-auto mb-8 max-w-3xl text-lg text-text-dark-secondary leading-relaxed">
              1waySEO 結合 GPT、Claude、Gemini 等最先進 AI 技術，
              <br className="hidden md:block" />
              從關鍵字研究到文章發布，全自動化 SEO 內容生產流程。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto glow-blue text-lg px-8 py-6 bg-tech-blue-600 hover:bg-tech-blue-500 text-white"
              >
                <Link href="/login" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  免費開始
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-text-dark-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-tech-blue-400" />
                <span className="text-text-dark-primary font-medium">
                  免費 10K Credits
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-tech-blue-400" />
                <span>無需信用卡</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-tech-blue-400" />
                <span>可生成 2-3 篇文章</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar - Dark (continues from Hero) */}
      <section className="relative py-12 bg-dark-section-secondary">
        <div className="container relative z-10 mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="glass-dark rounded-xl p-6 text-center hover:glow-blue-subtle transition-all duration-300"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-tech-blue-500/20 mb-4">
                    <Icon className="h-6 w-6 text-tech-blue-400" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400">
                    {stat.value}
                    {stat.suffix && stat.suffix !== "分鐘" && (
                      <span className="text-2xl">{stat.suffix}</span>
                    )}
                  </div>
                  <div className="text-text-dark-secondary text-sm mt-1">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cost Comparison - Light */}
      <CostComparison />

      {/* AI Technology Section - Dark */}
      <section className="relative py-20 bg-dark-section">
        <FloatingOrbs />
        <BackgroundGrid variant="dark" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-dark px-4 py-2 text-sm font-medium text-tech-blue-400">
              <Brain className="h-4 w-4" />
              <span>AI 技術</span>
            </div>
            <h2 className="font-bold mb-4">
              <span className="text-text-dark-primary text-xl md:text-2xl">
                整合
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400 text-4xl md:text-5xl ml-2">
                頂尖 AI 模型
              </span>
            </h2>
            <p className="text-text-dark-secondary max-w-2xl mx-auto">
              根據需求自動選擇最適合的 AI 模型，確保最佳品質
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {aiModels.map((model, index) => (
              <Card
                key={index}
                className="glass-dark border-tech-blue-500/20 text-center hover:border-tech-blue-500/50 hover:glow-blue-subtle transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400 mb-1">
                    {model.name}
                  </div>
                  <div className="text-xs text-text-dark-secondary">
                    {model.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Light */}
      <section id="features" className="relative py-20 bg-light-section">
        <BackgroundGrid variant="light" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-tech-blue-100 px-4 py-2 text-sm font-medium text-tech-blue-700">
              <Target className="h-4 w-4" />
              <span>完整工作流程</span>
            </div>
            <h2 className="font-bold mb-4">
              <span className="text-text-light-primary text-xl md:text-2xl">
                從研究到發布，
              </span>
              <span className="text-tech-blue-600 text-4xl md:text-5xl">
                全自動化
              </span>
            </h2>
            <p className="text-text-light-secondary max-w-3xl mx-auto">
              9 大核心功能讓您的 SEO 內容策略完全自動化
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="glass-light border-tech-blue-200/50 hover:border-tech-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-white/80"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-tech-blue-500 to-purple-500">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-text-light-primary">
                      {feature.title}
                    </h3>
                    <p className="text-text-light-secondary text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section - Dark */}
      <section className="relative py-20 bg-dark-section">
        <BackgroundGrid variant="dark" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full glass-dark px-4 py-2 text-sm font-medium text-tech-blue-400">
              <Users className="h-4 w-4" />
              <span>客戶見證</span>
            </div>
            <h2 className="font-bold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400 text-4xl md:text-5xl">
                用戶
              </span>
              <span className="text-text-dark-primary text-xl md:text-2xl ml-2">
                怎麼說
              </span>
            </h2>
            <p className="text-text-dark-secondary">
              看看他們如何使用 1waySEO 改變內容策略
            </p>
          </div>

          <TestimonialsCarousel />
        </div>
      </section>

      {/* Pricing Section - Light */}
      <section id="pricing" className="relative py-20 bg-light-section">
        <BackgroundGrid variant="light" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-tech-blue-100 px-4 py-2 text-sm font-medium text-tech-blue-700">
              <Infinity className="h-4 w-4" />
              <span>定價方案</span>
            </div>
            <h2 className="font-bold mb-4">
              <span className="text-tech-blue-600 text-4xl md:text-5xl">
                終身買斷
              </span>
              <span className="text-text-light-primary text-xl md:text-2xl ml-2">
                ，永久使用
              </span>
            </h2>
            <p className="text-text-light-secondary max-w-2xl mx-auto mb-6">
              一次付費，每月自動獲得 Credits 配額，無需訂閱費用
            </p>
            <div className="inline-flex items-center gap-3 rounded-full bg-green-50 border border-green-200 px-6 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                免費方案：註冊即送 10K Credits（一次性）
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-16">
            {plans?.map((plan) => {
              const isPopular = plan.slug.includes("professional");
              const originalPrice = Math.round(
                (plan.lifetime_price || 0) * 1.5,
              );

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col h-full transition-all duration-300 ${
                    isPopular
                      ? "bg-gradient-to-b from-tech-blue-600 to-tech-blue-700 text-white border-tech-blue-500 shadow-lg scale-105"
                      : "bg-white border-2 border-slate-200 hover:border-tech-blue-400 shadow-md"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                      最熱門
                    </div>
                  )}
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="mb-2">
                      <h3
                        className={`text-lg font-bold ${isPopular ? "text-white" : "text-slate-900"}`}
                      >
                        {plan.name}
                      </h3>
                    </div>
                    <div className="mb-4">
                      <div
                        className={`text-sm line-through ${isPopular ? "text-white/60" : "text-slate-400"}`}
                      >
                        NT${originalPrice.toLocaleString()}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-bold ${isPopular ? "text-white" : "text-slate-900"}`}
                        >
                          NT${plan.lifetime_price?.toLocaleString()}
                        </span>
                        <span
                          className={`text-xs ${isPopular ? "text-white/70" : "text-slate-500"}`}
                        >
                          終身
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <ul
                        className={`space-y-2 text-sm mb-4 ${isPopular ? "text-white" : "text-slate-700"}`}
                      >
                        <li className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 flex-shrink-0 ${isPopular ? "text-white" : "text-tech-blue-500"}`}
                          />
                          每月 {plan.base_tokens?.toLocaleString()} Credits
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 flex-shrink-0 ${isPopular ? "text-white" : "text-tech-blue-500"}`}
                          />
                          所有 AI 模型
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 flex-shrink-0 ${isPopular ? "text-white" : "text-tech-blue-500"}`}
                          />
                          WordPress 整合
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 flex-shrink-0 ${isPopular ? "text-white" : "text-tech-blue-500"}`}
                          />
                          自動圖片生成
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 flex-shrink-0 ${isPopular ? "text-white" : "text-tech-blue-500"}`}
                          />
                          排程發布
                        </li>
                      </ul>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className={`w-full mt-auto ${
                        isPopular
                          ? "bg-white text-tech-blue-600 hover:bg-white/90"
                          : "bg-tech-blue-600 text-white hover:bg-tech-blue-700"
                      }`}
                    >
                      <Link href="/login">開始使用</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700">
                <CreditCard className="h-4 w-4" />
                <span>Credits 加值包</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-text-light-primary">
                需要更多 Credits？
              </h3>
              <p className="text-sm text-text-light-secondary">
                免費版或終身版用戶皆可購買，直接加值不需升級方案。購買的 Credits
                永不過期！
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto items-stretch">
              {tokenPackages?.map((pkg) => {
                const isPopular = pkg.tokens === 50000;
                return (
                  <Card
                    key={pkg.id}
                    className={`relative glass-light ${
                      isPopular
                        ? "border-amber-400 shadow-md"
                        : "border-tech-blue-200/50"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-medium">
                        超值
                      </span>
                    )}
                    <CardContent className="p-6 text-center">
                      <div className="text-lg font-bold text-tech-blue-600 mb-1">
                        {pkg.tokens?.toLocaleString()} Credits
                      </div>
                      <div className="text-xl font-bold text-text-light-primary mb-4">
                        NT${pkg.price?.toLocaleString()}
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full border-tech-blue-300 text-tech-blue-600 hover:bg-tech-blue-50"
                      >
                        <Link href="/login">購買</Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - Dark */}
      <FAQSection />

      {/* Final CTA Section - Dark Gradient */}
      <section className="relative py-20 bg-dark-section overflow-hidden">
        <HeroGlow />
        <FloatingOrbs />

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-bold mb-6">
              <span className="text-text-dark-primary text-xl md:text-2xl">
                準備好
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-tech-blue-400 to-purple-400 text-4xl md:text-5xl mx-2">
                提升您的內容策略
              </span>
              <span className="text-text-dark-primary text-xl md:text-2xl">
                了嗎？
              </span>
            </h2>
            <p className="text-text-dark-secondary mb-8">
              立即註冊，免費獲得 10K Credits 開始體驗
            </p>
            <Button
              asChild
              size="lg"
              className="glow-blue animate-pulse-glow-slow bg-tech-blue-600 hover:bg-tech-blue-500 text-white group text-lg px-10 py-7"
            >
              <Link href="/login" className="gap-2">
                <Rocket className="h-5 w-5" />
                免費開始使用
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer - Darkest */}
      <footer className="relative py-8 bg-[#050810]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tech-blue-500/50 to-transparent" />

        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-text-dark-secondary text-sm">
              © 2024 1waySEO. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-text-dark-secondary">
              <Link
                href="/terms"
                className="hover:text-tech-blue-400 transition-colors"
              >
                服務條款
              </Link>
              <Link
                href="/privacy"
                className="hover:text-tech-blue-400 transition-colors"
              >
                隱私政策
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
