'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'
import { Check } from 'lucide-react'

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
      setPlans(data || [])
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
    const items: JSX.Element[] = []

    if (features.wordpress_sites) {
      items.push(
        <li key="sites" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>
            {features.wordpress_sites === -1
              ? '無限 WordPress 網站'
              : `${features.wordpress_sites} 個 WordPress 網站`}
          </span>
        </li>
      )
    }

    if (features.images_per_article) {
      items.push(
        <li key="images" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>
            {features.images_per_article === -1
              ? '無限圖片/文章'
              : `每篇 ${features.images_per_article} 張圖片`}
          </span>
        </li>
      )
    }

    if (features.batch_generation) {
      items.push(
        <li key="batch" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{features.batch_generation} 篇批量生成</span>
        </li>
      )
    }

    if (features.team_members) {
      items.push(
        <li key="team" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>
            {features.team_members === -1
              ? '無限團隊成員'
              : `${features.team_members} 個團隊成員`}
          </span>
        </li>
      )
    }

    if (features.seo_score) {
      items.push(
        <li key="seo" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>SEO 分數優化</span>
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
        <li key="schedule" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>{schedText}</span>
        </li>
      )
    }

    if (features.brand_voices) {
      items.push(
        <li key="voices" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>
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
        <li key="api" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>API 存取</span>
        </li>
      )
    }

    if (features.white_label) {
      items.push(
        <li key="white" className="flex items-start gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>白標服務</span>
        </li>
      )
    }

    return items
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            靈活透明的定價方案
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            無論您是個人、小團隊或成長中的企業，我們都有最適合您的方案
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            月繳
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors relative ${
              billingPeriod === 'yearly'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            年繳
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
              省 20%
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => {
            const price = getPlanPrice(plan)
            const savings = getYearlySavings(plan)
            const features = plan.features as Record<string, unknown>

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-8 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl transition-all duration-300"
              >
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      NT$ {price.toLocaleString()}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {billingPeriod === 'yearly' ? '/ 年' : '/ 月'}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && savings > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      每年省下 NT$ {savings.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="mb-6 py-4 px-5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {(plan.base_tokens / 1000).toLocaleString()}K
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Tokens / {billingPeriod === 'yearly' ? '月' : '月'}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 text-sm text-slate-700 dark:text-slate-300">
                  {renderFeatureList(features)}
                </ul>

                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
                  選擇方案
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            需要更多 Token？可隨時購買額外的 Token 包，永不過期
          </p>
          <button className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            查看 Token 購買方案 →
          </button>
        </div>
      </div>
    </div>
  )
}
