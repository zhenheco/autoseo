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
    <main className="relative min-h-screen overflow-hidden bg-white">
      <section className="relative py-20 sm:py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
              <Zap className="h-4 w-4" />
              <span>AI 驅動的 SEO 內容平台</span>
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              讓 AI 為您打造
              <br />
              <span className="text-violet-600">完美的 SEO 內容</span>
            </h1>

            <p className="mx-auto mb-10 max-w-3xl text-lg text-gray-600 leading-relaxed">
              1waySEO 結合最先進的 AI
              技術，依照關鍵字與搜尋結果自動決定最佳架構，
              <br />
              幫助您自動化內容創作流程，節省 90% 的時間成本。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-lg px-8 py-6"
              >
                <Link href="/login" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  免費開始
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-gray-700 font-medium">
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

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent" />
      </section>

      <section id="features" className="relative py-32 bg-gray-50">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
              <Target className="h-4 w-4" />
              <span>完整工作流程</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-gray-900">
              從研究到發布，<span className="text-violet-600">全自動化</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
                  className="border border-gray-200 hover:border-violet-300 hover:shadow-lg transition-all duration-200 bg-white"
                >
                  <CardContent className="p-8">
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100">
                      <Icon className="h-7 w-7 text-violet-600" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-gray-500 leading-relaxed text-sm">
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
              <Infinity className="h-4 w-4" />
              <span>定價方案</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-gray-900">
              <span className="text-violet-600">終身買斷</span>，永久使用
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              一次付費，每月自動獲得 Credits 配額，無需訂閱費用。
            </p>
          </div>

          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-green-50 border border-green-200 px-6 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                免費方案：註冊即送 10K Credits（一次性）
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-24">
            {lifetimePlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative border-2 ${plan.popular ? "border-violet-500 shadow-xl scale-105" : "border-gray-200"} bg-white`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      最受歡迎
                    </span>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      NT${plan.price.toLocaleString()}
                    </span>
                    <span className="text-gray-500 ml-2">終身</span>
                  </div>
                  <div className="mb-6 p-3 bg-violet-50 rounded-lg">
                    <span className="text-violet-700 font-medium">
                      每月 {plan.monthlyCredits} Credits
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-gray-600"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`w-full ${plan.popular ? "bg-violet-600 hover:bg-violet-700" : "bg-gray-900 hover:bg-gray-800"}`}
                  >
                    <Link href="/login">立即購買</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700">
                <CreditCard className="h-4 w-4" />
                <span>Credits 加值包</span>
              </div>
              <h3 className="text-3xl font-bold mb-4 text-gray-900">
                需要更多 Credits？
              </h3>
              <p className="text-gray-600">
                免費版或終身版用戶皆可購買，直接加值不需升級方案。
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {creditPacks.map((pack, index) => (
                <Card
                  key={index}
                  className={`border-2 ${pack.popular ? "border-violet-500 shadow-lg" : "border-gray-200"} bg-white hover:shadow-lg transition-shadow`}
                >
                  <CardContent className="p-6 text-center">
                    {pack.popular && (
                      <span className="inline-block bg-violet-600 text-white px-3 py-1 rounded-full text-xs font-medium mb-3">
                        超值
                      </span>
                    )}
                    <div className="text-3xl font-bold text-violet-600 mb-2">
                      {pack.credits}
                    </div>
                    <div className="text-gray-500 text-sm mb-4">Credits</div>
                    <div className="text-2xl font-bold text-gray-900 mb-4">
                      NT${pack.price}
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-violet-300 text-violet-600 hover:bg-violet-50"
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

      <section className="relative py-32 bg-gray-50">
        <BackgroundGrid className="opacity-20" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700">
              <Users className="h-4 w-4" />
              <span>客戶見證</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900">
              <span className="text-violet-600">數千家企業</span>的選擇
            </h2>
            <p className="text-lg text-gray-600">
              看看他們如何使用 1waySEO 改變內容策略
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="border border-gray-200 bg-white shadow-lg p-12 relative overflow-hidden">
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
                  <p className="text-xl leading-relaxed mb-8 text-gray-800">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div>
                    <div className="font-bold text-lg text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-gray-500">{testimonial.company}</div>
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
                        ? "w-8 bg-violet-600"
                        : "bg-gray-300"
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
            <h2 className="text-4xl sm:text-6xl font-bold mb-8 text-gray-900">
              準備好<span className="text-violet-600">提升您的內容策略</span>
              了嗎？
            </h2>
            <p className="text-xl text-gray-600 mb-12 leading-relaxed">
              立即註冊，免費獲得 10K Credits 開始體驗。
            </p>
            <Button
              asChild
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 group text-lg px-10 py-7"
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

      <footer className="py-8 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-500 text-sm">
              © 2024 1waySEO. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/terms" className="hover:text-violet-600">
                服務條款
              </Link>
              <Link href="/privacy" className="hover:text-violet-600">
                隱私政策
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
