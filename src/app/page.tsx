"use client";

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
  Brain,
  Search,
  PenTool,
  Image,
  Link as LinkIcon,
  Calendar,
  Infinity,
  CreditCard,
} from "lucide-react";
import { useState, useEffect } from "react";

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

const lifetimePlans = [
  {
    name: "基礎版",
    price: 2999,
    monthlyCredits: "50K",
    features: [
      "每月 50K Credits",
      "基本 SEO 分析",
      "WordPress 整合",
      "Email 支援",
    ],
  },
  {
    name: "專業版",
    price: 5999,
    monthlyCredits: "150K",
    popular: true,
    features: ["每月 150K Credits", "進階 SEO 分析", "多站點管理", "優先支援"],
  },
  {
    name: "企業版",
    price: 9999,
    monthlyCredits: "500K",
    features: ["每月 500K Credits", "完整 SEO 套件", "無限站點", "專屬客服"],
  },
];

const creditPacks = [
  { credits: "50K", price: 299 },
  { credits: "100K", price: 549, popular: true },
  { credits: "250K", price: 1199 },
  { credits: "500K", price: 2099 },
];

const testimonials = [
  {
    name: "張經理",
    company: "數位行銷公司",
    content:
      "使用 1waySEO 後，我們的內容產出效率提升了 300%，SEO 排名也顯著改善！",
    avatar: "👨‍💼",
  },
  {
    name: "李總監",
    company: "電商企業",
    content: "這個平台完全改變了我們的內容策略，AI 生成的文章品質超乎想像！",
    avatar: "👩‍💻",
  },
  {
    name: "王創辦人",
    company: "新創公司",
    content: "自動化功能太好用了，讓我們的內容團隊效率翻倍！",
    avatar: "👨‍🚀",
  },
];

export default function Home() {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <section className="relative py-20 sm:py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              <span>AI 驅動的 SEO 內容平台</span>
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              讓 AI 為您打造
              <br />
              <span className="text-primary">完美的 SEO 內容</span>
            </h1>

            <p className="mx-auto mb-10 max-w-3xl text-lg text-muted-foreground leading-relaxed">
              1waySEO 結合最先進的 AI
              技術，依照關鍵字與搜尋結果自動決定最佳架構，
              <br />
              幫助您自動化內容創作流程，節省 90% 的時間成本。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
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

      <section id="features" className="relative py-32 bg-muted/30">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4" />
              <span>完整工作流程</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-foreground">
              從研究到發布，<span className="text-primary">全自動化</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              依照關鍵字與搜尋結果自動決定最佳的字數及架構，
              <br />9 大核心功能讓您的 SEO 內容策略完全自動化。
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
                  <CardContent className="p-8">
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Infinity className="h-4 w-4" />
              <span>定價方案</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-foreground">
              <span className="text-primary">終身買斷</span>，永久使用
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              一次付費，每月自動獲得 Credits 配額，無需訂閱費用。
            </p>
          </div>

          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-6 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-300 font-medium">
                免費方案：註冊即送 10K Credits（一次性）
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-24">
            {lifetimePlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative border-2 ${plan.popular ? "border-primary shadow-xl scale-105" : "border-border"} bg-card`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      最受歡迎
                    </span>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">
                      NT${plan.price.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground ml-2">終身</span>
                  </div>
                  <div className="mb-6 p-3 bg-primary/10 rounded-lg">
                    <span className="text-primary font-medium">
                      每月 {plan.monthlyCredits} Credits
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90" : "bg-foreground hover:bg-foreground/90"}`}
                  >
                    <Link href="/login">立即購買</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <CreditCard className="h-4 w-4" />
                <span>Credits 加值包</span>
              </div>
              <h3 className="text-3xl font-bold mb-4 text-foreground">
                需要更多 Credits？
              </h3>
              <p className="text-muted-foreground">
                免費版或終身版用戶皆可購買，直接加值不需升級方案。
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {creditPacks.map((pack, index) => (
                <Card
                  key={index}
                  className={`border-2 ${pack.popular ? "border-primary shadow-lg" : "border-border"} bg-card hover:shadow-lg transition-shadow`}
                >
                  <CardContent className="p-6 text-center">
                    {pack.popular && (
                      <span className="inline-block bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium mb-3">
                        超值
                      </span>
                    )}
                    <div className="text-3xl font-bold text-primary mb-2">
                      {pack.credits}
                    </div>
                    <div className="text-muted-foreground text-sm mb-4">
                      Credits
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-4">
                      NT${pack.price}
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-primary/50 text-primary hover:bg-primary/10"
                    >
                      <Link href="/login">購買</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-32 bg-muted/30">
        <BackgroundGrid className="opacity-20" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Users className="h-4 w-4" />
              <span>客戶見證</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-foreground">
              <span className="text-primary">數千家企業</span>的選擇
            </h2>
            <p className="text-lg text-muted-foreground">
              看看他們如何使用 1waySEO 改變內容策略
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="border border-border bg-card shadow-lg p-12 relative overflow-hidden">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    index === activeTestimonial
                      ? "opacity-100"
                      : "opacity-0 absolute inset-12"
                  }`}
                >
                  <div className="text-6xl mb-6">{testimonial.avatar}</div>
                  <p className="text-xl leading-relaxed mb-8 text-foreground/90">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div>
                    <div className="font-bold text-lg text-foreground">
                      {testimonial.name}
                    </div>
                    <div className="text-muted-foreground">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-center gap-2 mt-8">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveTestimonial(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === activeTestimonial
                        ? "w-8 bg-primary"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="relative py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl sm:text-6xl font-bold mb-8 text-foreground">
              準備好<span className="text-primary">提升您的內容策略</span>
              了嗎？
            </h2>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
              立即註冊，免費獲得 10K Credits 開始體驗。
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
