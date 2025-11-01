'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'
import { Check, Sparkles, Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type SubscriptionPlan = Tables<'subscription_plans'>

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_lifetime', false)
        .order('monthly_price', { ascending: true })

      if (error) throw error

      // 重新排序：確保 Agency 在最右邊
      if (data) {
        const sortedPlans = [...data].sort((a, b) => {
          // 根據價格判斷方案等級
          const priceA = a.monthly_price
          const priceB = b.monthly_price

          // Starter < Professional < Business < Agency
          if (priceA < 500) return -1 // Starter
          if (priceB < 500) return 1
          if (priceA < 2000) return -1 // Professional
          if (priceB < 2000) return 1
          if (priceA < 5000) return -1 // Business
          if (priceB < 5000) return 1
          return 0 // Agency
        })
        setPlans(sortedPlans)
      }
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanPrice = (plan: SubscriptionPlan) => {
    if (billingPeriod === 'yearly' && plan.yearly_price) {
      return plan.yearly_price
    }
    return plan.monthly_price
  }

  const getYearlySavings = (plan: SubscriptionPlan) => {
    if (!plan.yearly_price) return 0
    const monthlyYearly = plan.monthly_price * 12
    return monthlyYearly - plan.yearly_price
  }

  const renderFeatureList = (features: Record<string, unknown>) => {
    const items: ReactNode[] = []

    if (features.wordpress_sites) {
      items.push(
        <li key="sites" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.wordpress_sites === -1
              ? '無限 WordPress 網站'
              : `${features.wordpress_sites} 個 WordPress 網站`}
          </span>
        </li>
      )
    }

    if (features.images_per_article) {
      items.push(
        <li key="images" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.images_per_article === -1
              ? '無限圖片/文章'
              : `每篇 ${features.images_per_article} 張圖片`}
          </span>
        </li>
      )
    }

    if (features.batch_generation) {
      items.push(
        <li key="batch" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {String(features.batch_generation)} 篇批量生成
          </span>
        </li>
      )
    }

    if (features.team_members) {
      items.push(
        <li key="team" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.team_members === -1
              ? '無限團隊成員'
              : `${features.team_members} 個團隊成員`}
          </span>
        </li>
      )
    }

    if (features.seo_score) {
      items.push(
        <li key="seo" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            SEO 分數優化
          </span>
        </li>
      )
    }

    if (features.scheduling) {
      const schedText =
        features.scheduling === 'basic'
          ? '基礎排程'
          : features.scheduling === 'advanced'
            ? '進階排程'
            : '智能排程'
      items.push(
        <li key="schedule" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {schedText}
          </span>
        </li>
      )
    }

    if (features.brand_voices) {
      items.push(
        <li key="voices" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.brand_voices === -1
              ? '無限品牌聲音'
              : features.brand_voices === 0
                ? '無品牌聲音'
                : `${features.brand_voices} 個品牌聲音`}
          </span>
        </li>
      )
    }

    if (features.api_access) {
      items.push(
        <li key="api" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            API 存取
          </span>
        </li>
      )
    }

    if (features.white_label) {
      items.push(
        <li key="white" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            白標服務
          </span>
        </li>
      )
    }

    return items
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">簡單透明的定價</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
            選擇最適合您的方案
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            無論您是個人創作者、成長中的團隊或是大型企業，我們都有最適合您的解決方案
          </p>
        </div>

        <div className="flex items-center justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card/50 backdrop-blur-sm shadow-sm">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              月繳
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>年繳</span>
              <Badge className="absolute -top-2 -right-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs px-1.5 py-0">
                省 20%
              </Badge>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const price = getPlanPrice(plan)
            const savings = getYearlySavings(plan)
            const features = plan.features as Record<string, unknown>
            const isPopular = index === 1

            return (
              <div
                key={plan.id}
                className={`group relative rounded-3xl transition-all duration-500 ${
                  isPopular
                    ? 'lg:scale-105'
                    : 'lg:hover:scale-105'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-primary via-primary to-secondary text-white border-0 px-5 py-1.5 shadow-lg shadow-primary/40 text-sm font-semibold animate-pulse-glow">
                      <Zap className="w-4 h-4 mr-1.5" />
                      最受歡迎
                    </Badge>
                  </div>
                )}

                <div
                  className={`relative h-full flex flex-col rounded-3xl border glass-effect p-8 transition-all duration-500 ${
                    isPopular
                      ? 'border-primary/50 shadow-2xl shadow-primary/30 hover:shadow-primary/40'
                      : 'border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20'
                  }`}
                >
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-4xl font-bold">
                        NT$ {price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">
                        {billingPeriod === 'yearly' ? '/ 年' : '/ 月'}
                      </span>
                    </div>

                    {billingPeriod === 'yearly' && savings > 0 && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        每年省下 NT$ {savings.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="text-3xl font-bold text-primary mb-1">
                      {(plan.base_tokens / 1000).toLocaleString()}K
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Tokens / 月
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {renderFeatureList(features)}
                  </ul>

                  <Button
                    className={`w-full group/button mt-auto ${
                      isPopular
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                  >
                    <span>開始使用</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/button:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {isPopular && (
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
                )}
              </div>
            )
          })}
        </div>

        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            需要更多 Token？可隨時購買額外的 Token 包，永不過期
          </p>
          <Button variant="outline" className="group">
            查看 Token 購買方案
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </div>
  )
}
