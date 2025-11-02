'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BackgroundGrid } from '@/components/ui/background-effects'
import {
  Sparkles,
  Zap,
  Users,
  TrendingUp,
  Globe,
  FileText,
  Shield,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Rocket,
  Target,
  Layers,
  Brain,
  Gauge,
  Lock
} from 'lucide-react'
import { useState, useEffect } from 'react'

const features = [
  {
    icon: Brain,
    title: 'AI 智能寫作',
    description: '採用最先進的 GPT-4 和 Claude AI，自動生成高品質、SEO 優化的內容，讓您的文章在搜尋引擎中脫穎而出',
    gradient: 'gradient-purple-blue'
  },
  {
    icon: Globe,
    title: 'WordPress 無縫整合',
    description: '一鍵發布到 WordPress，支援自訂排程、多站點管理和自動更新，完全自動化您的內容發布流程',
    gradient: 'gradient-blue-cyan'
  },
  {
    icon: Users,
    title: '團隊協作管理',
    description: '多租戶架構，企業級權限控制，支援角色分配、工作流程審批和即時協作，提升團隊效率',
    gradient: 'gradient-purple-pink'
  },
  {
    icon: TrendingUp,
    title: 'SEO 深度優化',
    description: '內建 SEO 專家系統，智能關鍵字分析、競爭對手研究、內容優化建議，幫您提升排名',
    gradient: 'gradient-purple-blue'
  },
  {
    icon: Layers,
    title: '內容生命週期',
    description: '從創意構思到發布追蹤，完整的內容管理系統，讓您掌控每個細節，提升內容品質',
    gradient: 'gradient-blue-cyan'
  },
  {
    icon: BarChart3,
    title: '數據智能分析',
    description: '即時流量追蹤、用戶行為分析、ROI 計算，數據驅動您的內容策略，持續優化成效',
    gradient: 'gradient-purple-pink'
  }
]

const stats = [
  { value: '10,000+', label: '生成文章數', icon: FileText },
  { value: '500+', label: '活躍用戶', icon: Users },
  { value: '99.9%', label: '系統穩定性', icon: Gauge },
  { value: '24/7', label: '技術支援', icon: Shield }
]

const benefits = [
  '✨ 完全自動化的內容生成和發布流程，節省90%時間',
  '🔒 企業級的安全性和穩定性保障，數據永不丟失',
  '🤝 靈活的團隊協作和權限管理，適合各種規模',
  '📊 專業的 SEO 優化和分析工具，提升搜尋排名',
  '🚀 24/7 技術支援和定期功能更新，持續進化',
  '🔗 無縫整合主流 CMS 平台，開箱即用'
]

const testimonials = [
  {
    name: '張經理',
    company: '數位行銷公司',
    content: '使用 Auto Pilot SEO 後，我們的內容產出效率提升了 300%，SEO 排名也顯著改善！',
    avatar: '👨‍💼'
  },
  {
    name: '李總監',
    company: '電商企業',
    content: '這個平台完全改變了我們的內容策略，AI 生成的文章品質超乎想像！',
    avatar: '👩‍💻'
  },
  {
    name: '王創辦人',
    company: '新創公司',
    content: '團隊協作功能太好用了，讓我們的內容團隊效率翻倍！',
    avatar: '👨‍🚀'
  }
]

export default function Home() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

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
              Auto Pilot SEO 結合最先進的 AI 技術，幫助您自動化內容創作流程，
              提升網站排名，節省 90% 的時間成本。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                <Link href="/signup" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  立即開始免費試用
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                <Link href="/pricing">查看定價方案</Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>7 天免費試用</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>無需信用卡</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>隨時取消</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="relative py-20 bg-muted/30">
        <BackgroundGrid className="opacity-30" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="text-center group">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-4xl sm:text-5xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4" />
              <span>核心功能</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-primary">強大功能</span>，簡化工作流程
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              整合所有您需要的工具，讓內容創作變得前所未有的簡單高效。
              從 AI 寫作到數據分析，一站式解決所有需求。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 overflow-hidden">
                  <CardContent className="p-8">
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="mb-3 text-2xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative py-32 bg-muted/30">
        <BackgroundGrid className="opacity-20" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                <span>為什麼選擇我們</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold mb-8">
                為什麼選擇
                <br />
                <span className="text-primary">Auto Pilot SEO</span>？
              </h2>
              <div className="space-y-5">
                {benefits.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="text-2xl">{item.split(' ')[0]}</div>
                    <span className="text-muted-foreground leading-relaxed flex-1">{item.substring(item.indexOf(' ') + 1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl border border-border bg-card p-8 flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-shadow">
                <Lock className="h-32 w-32 text-primary/30 mb-8" />
                <h3 className="text-2xl font-bold mb-4 text-center">企業級安全保障</h3>
                <p className="text-center text-muted-foreground leading-relaxed">
                  採用業界最高安全標準，確保您的數據和內容永遠安全可靠
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-32">
        <div className="container relative z-10 mx-auto px-4">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Users className="h-4 w-4" />
              <span>客戶見證</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="text-primary">數千家企業</span>的選擇
            </h2>
            <p className="text-lg text-muted-foreground">
              看看他們如何使用 Auto Pilot SEO 改變內容策略
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="border border-border bg-card shadow-lg p-12 relative overflow-hidden">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    index === activeTestimonial ? 'opacity-100' : 'opacity-0 absolute inset-12'
                  }`}
                >
                  <div className="text-6xl mb-6">{testimonial.avatar}</div>
                  <p className="text-xl leading-relaxed mb-8 text-foreground">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div>
                    <div className="font-semibold text-lg">{testimonial.name}</div>
                    <div className="text-muted-foreground">{testimonial.company}</div>
                  </div>
                </div>
              ))}
              <div className="flex justify-center gap-2 mt-8">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveTestimonial(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === activeTestimonial ? 'w-8 bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="relative py-32 bg-muted/30">
        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl sm:text-6xl font-bold mb-8">
              準備好<span className="text-primary">提升您的內容策略</span>了嗎？
            </h2>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
              立即開始免費試用，體驗 AI 驅動的內容創作革命。
              <br />
              無需信用卡，7 天內隨時取消。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 group text-lg px-10 py-7">
                <Link href="/signup" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  免費開始使用
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-10 py-7 border-border hover:border-primary/50">
                <Link href="/login">已有帳號？登入</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
