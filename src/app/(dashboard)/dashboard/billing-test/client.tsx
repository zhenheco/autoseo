'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'
import { Check, X, Sparkles, CreditCard, Cpu, TrendingUp, Zap, Crown, Infinity } from 'lucide-react'

type SubscriptionPlan = Tables<'subscription_plans'>
type TokenPackage = Tables<'token_packages'>
type AIModelPricing = Tables<'ai_model_pricing'>
type CompanySubscription = Tables<'company_subscriptions'>

export default function BillingTestClient() {
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([])
  const [aiModels, setAIModels] = useState<AIModelPricing[]>([])
  const [companySubscriptions, setCompanySubscriptions] = useState<CompanySubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()

      const [plansRes, packagesRes, modelsRes, subsRes] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*')
          .order('is_lifetime', { ascending: true })
          .order('monthly_price', { ascending: true }),
        supabase
          .from('token_packages')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true }),
        supabase
          .from('ai_model_pricing')
          .select('*')
          .eq('is_active', true)
          .order('tier', { ascending: true })
          .order('model_name', { ascending: true }),
        supabase
          .from('company_subscriptions')
          .select('*')
          .limit(5)
      ])

      if (plansRes.error) throw plansRes.error
      if (packagesRes.error) throw packagesRes.error
      if (modelsRes.error) throw modelsRes.error
      if (subsRes.error) throw subsRes.error

      setSubscriptionPlans(plansRes.data || [])
      setTokenPackages(packagesRes.data || [])
      setAIModels(modelsRes.data || [])
      setCompanySubscriptions(subsRes.data || [])

      console.log('✅ 資料載入成功')
      console.log('訂閱方案:', plansRes.data)
      console.log('Token 包:', packagesRes.data)
      console.log('AI 模型:', modelsRes.data)
      console.log('公司訂閱:', subsRes.data)
    } catch (err) {
      console.error('❌ 資料載入失敗:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-slate-600 dark:text-slate-400">載入中...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <X className="w-6 h-6 text-red-600 dark:text-red-400" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">錯誤</h3>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const monthlyPlans = subscriptionPlans.filter((p) => !p.is_lifetime)
  const lifetimePlans = subscriptionPlans.filter((p) => p.is_lifetime)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300">
            <Sparkles className="w-4 h-4" />
            Token 計費系統測試
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            定價與計費系統
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            靈活的 Token 計費方案，支援月費訂閱和一次性購買，配合 AI 模型動態定價
          </p>
        </header>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">月費方案</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">每月配額自動重置，適合穩定使用</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {monthlyPlans.map((plan) => (
              <div
                key={plan.id}
                className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{plan.name}</h3>
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                      NT$ {plan.monthly_price.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">每月</div>
                  </div>
                  <div className="py-3 px-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(plan.base_tokens / 1000).toLocaleString()}K
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Tokens / 月</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Infinity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">終身方案</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                一次付費，永久享用 + 購買 Token 享 8 折優惠
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {lifetimePlans.map((plan) => (
              <div
                key={plan.id}
                className="group relative bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-purple-200 dark:border-purple-700"
              >
                <div className="absolute -top-3 -right-3">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    終身
                  </div>
                </div>
                <div className="relative">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{plan.name}</h3>
                  <div className="mb-4">
                    <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      NT$ {plan.lifetime_price?.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">一次付費</div>
                  </div>
                  <div className="py-3 px-4 bg-white dark:bg-slate-800 rounded-lg mb-3 border border-purple-200 dark:border-purple-700">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {(plan.base_tokens / 1000).toLocaleString()}K
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Tokens / 月</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                    <Check className="w-4 h-4" />
                    <span>永久 8 折購買優惠</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Token 購買包</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">一次性購買，永不過期</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {tokenPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 shadow-md hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500"
              >
                <div className="text-center space-y-3">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {(pkg.tokens / 1000).toLocaleString()}K
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Tokens</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${pkg.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AI 模型定價</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">動態計費，透明價格</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      模型
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      供應商
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      層級
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      倍率
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Input
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Output
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {aiModels.map((model) => (
                    <tr
                      key={model.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {model.model_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {model.provider}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            model.tier === 'basic'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          }`}
                        >
                          {model.tier === 'basic' ? '基礎' : '進階'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-sm font-bold">
                          {model.multiplier}x
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400 font-mono">
                        ${model.input_price_per_1m.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400 font-mono">
                        ${model.output_price_per_1m.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">系統驗證</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  subscriptionPlans.length === 7
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {subscriptionPlans.length === 7 ? (
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">訂閱方案</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {subscriptionPlans.length}/7
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  tokenPackages.length === 6
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {tokenPackages.length === 6 ? (
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Token 包</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {tokenPackages.length}/6
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
                  aiModels.length === 8 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {aiModels.length === 8 ? (
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">AI 模型</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {aiModels.length}/8
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
