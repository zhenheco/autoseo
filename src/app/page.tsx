import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackgroundGrid } from "@/components/ui/background-effects";
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
  { name: "GPT-4o", description: "OpenAI 最新旗艦模型" },
  { name: "Claude 3.5", description: "Anthropic 高性能模型" },
  { name: "DeepSeek", description: "高性價比中文模型" },
  { name: "Gemini", description: "Google 多模態模型" },
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
    <main className="relative min-h-screen overflow-hidden bg-background">
      <section className="relative py-20 sm:py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              <span>AI 驅動的 SEO 內容平台</span>
            </div>

            <h1 className="mb-6 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              讓 AI 為您打造
              <span className="text-primary block mt-2">完美的 SEO 內容</span>
            </h1>

            <p className="mx-auto mb-6 max-w-3xl text-lg text-muted-foreground leading-relaxed">
              1waySEO 結合 GPT-4o、Claude 等最先進 AI 技術，
              <br className="hidden md:block" />
              從關鍵字研究到文章發布，全自動化 SEO 內容生產流程。
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm">
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 px-4 py-2 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">
                  省下 95% 內容成本
                </span>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-400 font-medium">
                  10 分鐘完成一篇文章
                </span>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
                <span className="text-purple-700 dark:text-purple-400 font-medium">
                  終身使用，無訂閱費
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-lg px-8 py-6"
              >
                <Link href="/login" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  免費開始
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-foreground font-medium">
                  免費 10K Credits
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>無需信用卡</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>可生成 2-3 篇文章</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-muted/30 to-transparent" />
      </section>

      <CostComparison />

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Brain className="h-4 w-4" />
              <span>AI 技術</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              整合<span className="text-primary">頂尖 AI 模型</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              根據需求自動選擇最適合的 AI 模型，確保最佳品質與性價比
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {aiModels.map((model, index) => (
              <Card key={index} className="border border-border text-center">
                <CardContent className="p-6">
                  <div className="text-lg font-bold text-primary mb-1">
                    {model.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {model.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="relative py-20 bg-muted/30">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4" />
              <span>完整工作流程</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              從研究到發布，<span className="text-primary">全自動化</span>
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              9 大核心功能讓您的 SEO 內容策略完全自動化
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 bg-card"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative py-20">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Infinity className="h-4 w-4" />
              <span>定價方案</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              <span className="text-primary">終身買斷</span>，永久使用
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              一次付費，每月自動獲得 Credits 配額，無需訂閱費用
            </p>
            <div className="inline-flex items-center gap-3 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-6 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-300 font-medium">
                免費方案：註冊即送 10K Credits（一次性）
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-16">
            {plans?.map((plan, index) => {
              const isPopular = plan.slug.includes("professional");
              const originalPrice = Math.round(
                (plan.lifetime_price || 0) * 1.5,
              );

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col h-full ${
                    isPopular
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border border-border"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                      最熱門
                    </div>
                  )}
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="mb-2">
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm line-through opacity-60">
                        NT${originalPrice.toLocaleString()}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">
                          NT${plan.lifetime_price?.toLocaleString()}
                        </span>
                        <span className="text-xs opacity-70">終身</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <ul className="space-y-2 text-sm mb-4">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          每月 {plan.base_tokens?.toLocaleString()} Credits
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          所有 AI 模型
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          WordPress 整合
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          自動圖片生成
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          排程發布
                        </li>
                      </ul>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className={`w-full mt-auto ${
                        isPopular
                          ? "bg-white text-primary hover:bg-white/90"
                          : ""
                      }`}
                      variant={isPopular ? "secondary" : "outline"}
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
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <CreditCard className="h-4 w-4" />
                <span>Credits 加值包</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">
                需要更多 Credits？
              </h3>
              <p className="text-sm text-muted-foreground">
                免費版或終身版用戶皆可購買，直接加值不需升級方案。購買的 Credits
                永不過期！
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {tokenPackages?.map((pkg) => {
                const isPopular = pkg.tokens === 50000;
                return (
                  <Card
                    key={pkg.id}
                    className={`border ${
                      isPopular ? "border-primary" : "border-border"
                    } bg-card`}
                  >
                    <CardContent className="p-6 text-center">
                      {isPopular && (
                        <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium mb-3">
                          超值
                        </span>
                      )}
                      <div className="text-lg font-bold text-primary mb-1">
                        {pkg.tokens?.toLocaleString()} Credits
                      </div>
                      <div className="text-xl font-bold text-foreground mb-4">
                        NT${pkg.price?.toLocaleString()}
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="w-full"
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

      <section className="relative py-20 bg-muted/30">
        <BackgroundGrid className="opacity-20" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Users className="h-4 w-4" />
              <span>客戶見證</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              <span className="text-primary">用戶</span>怎麼說
            </h2>
            <p className="text-muted-foreground">
              看看他們如何使用 1waySEO 改變內容策略
            </p>
          </div>

          <TestimonialsCarousel />
        </div>
      </section>

      <FAQSection />

      <section className="relative py-20">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-foreground">
              準備好<span className="text-primary">提升您的內容策略</span>了嗎？
            </h2>
            <p className="text-muted-foreground mb-8">
              立即註冊，免費獲得 10K Credits 開始體驗
            </p>
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 group text-lg px-10 py-7"
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

      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-muted-foreground text-sm">
              © 2024 1waySEO. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-primary">
                服務條款
              </Link>
              <Link href="/privacy" className="hover:text-primary">
                隱私政策
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
