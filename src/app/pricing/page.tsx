'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database.types'
import { Check, Sparkles, Zap, ArrowRight, CreditCard, Crown, Cpu, User, LogOut, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { canUpgrade, type BillingPeriod, TIER_HIERARCHY } from '@/lib/subscription/upgrade-rules'

type SubscriptionPlan = Tables<'subscription_plans'>
type TokenPackage = Tables<'token_packages'>
type AIModel = Tables<'ai_model_pricing'>

function canUpgradeWrapper(
  currentTier: string | null,
  currentBillingPeriod: BillingPeriod,
  targetPlan: SubscriptionPlan,
  targetBillingPeriod: BillingPeriod
): boolean {
  return canUpgrade(currentTier, currentBillingPeriod, targetPlan.slug, targetBillingPeriod)
}

function isCurrentPlan(
  currentTier: string | null,
  currentBillingPeriod: BillingPeriod,
  targetPlan: SubscriptionPlan,
  targetBillingPeriod: BillingPeriod
): boolean {
  if (!currentTier) return false

  const currentLevel = TIER_HIERARCHY[currentTier] ?? 0
  const targetLevel = TIER_HIERARCHY[targetPlan.slug] ?? 0

  return currentLevel === targetLevel && currentBillingPeriod === targetBillingPeriod
}

export default function PricingPage() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([])
  const [aiModels, setAiModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null)
  const [processingPackageId, setProcessingPackageId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<string | null>(null)
  const [currentBillingPeriod, setCurrentBillingPeriod] = useState<BillingPeriod>('monthly')

  useEffect(() => {
    loadPlans()
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)

        const { data: member } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (member) {
          const { data: company } = await supabase
            .from('companies')
            .select('subscription_tier')
            .eq('id', member.company_id)
            .single()

          if (company) {
            const { data: mandate } = await supabase
              .from('recurring_mandates')
              .select('period_type, subscription_plan_id')
              .eq('company_id', member.company_id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (mandate) {
              const { data: plan } = await supabase
                .from('subscription_plans')
                .select('slug, is_lifetime')
                .eq('id', mandate.subscription_plan_id)
                .single()

              if (plan) {
                setCurrentTier(plan.slug)

                if (plan.is_lifetime) {
                  setCurrentBillingPeriod('lifetime')
                } else if (mandate.period_type === 'Y') {
                  setCurrentBillingPeriod('yearly')
                } else {
                  setCurrentBillingPeriod('monthly')
                }
              }
            } else {
              setCurrentTier(company.subscription_tier)
              setCurrentBillingPeriod('monthly')
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  async function loadPlans() {
    try {
      const supabase = createClient()
      const [plansRes, packagesRes, modelsRes] = await Promise.all([
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
          .order('tier', { ascending: false })
          .order('provider', { ascending: true })
      ])

      if (plansRes.error) throw plansRes.error
      if (packagesRes.error) throw packagesRes.error
      if (modelsRes.error) throw modelsRes.error

      if (plansRes.data) {
        // 過濾掉終身方案和免費方案（免費方案只供註冊使用，不在定價頁顯示）
        const paidPlans = plansRes.data.filter(p => !p.is_lifetime && p.slug !== 'free')
        const sortedPlans = [...paidPlans].sort((a, b) => {
          const priceA = a.monthly_price
          const priceB = b.monthly_price

          // 按價格排序：STARTER < PROFESSIONAL < BUSINESS < AGENCY
          if (priceA < 2000) return -1
          if (priceB < 2000) return 1
          if (priceA < 5000) return -1
          if (priceB < 5000) return 1
          return 0
        })
        setPlans(sortedPlans)
      }

      if (packagesRes.data) {
        const displayedPackages = packagesRes.data.filter(pkg =>
          ['entry-10k', 'standard-50k', 'advanced-100k'].includes(pkg.slug)
        )
        setTokenPackages(displayedPackages)
      }

      if (modelsRes.data) {
        setAiModels(modelsRes.data)
      }
    } catch (error) {
      console.error('Failed to load plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanPrice = (plan: SubscriptionPlan) => {
    if (billingPeriod === 'lifetime' && plan.lifetime_price) {
      return plan.lifetime_price
    }
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

  const submitPaymentForm = (paymentForm: {
    merchantId: string
    tradeInfo?: string
    tradeSha?: string
    postData?: string
    postDataSha?: string
    version?: string
    apiUrl: string
  }) => {
    console.log('[表單提交] 準備重定向到授權頁面')
    console.log('[表單提交] 目標 URL:', paymentForm.apiUrl)

    const fields: Record<string, string> = {}

    if (paymentForm.tradeInfo && paymentForm.tradeSha) {
      console.log('[表單提交] 單次付款模式')
      fields.MerchantID = paymentForm.merchantId
      fields.TradeInfo = paymentForm.tradeInfo
      fields.TradeSha = paymentForm.tradeSha
      fields.Version = paymentForm.version || '2.0'
    } else if (paymentForm.postData) {
      console.log('[表單提交] 定期定額模式')
      fields.MerchantID_ = paymentForm.merchantId
      fields.PostData_ = paymentForm.postData
    }

    const formData = {
      apiUrl: paymentForm.apiUrl,
      postData: paymentForm.postData,
      tradeInfo: paymentForm.tradeInfo,
      tradeSha: paymentForm.tradeSha,
      version: paymentForm.version,
      merchantId: paymentForm.merchantId
    }

    const encodedFormData = encodeURIComponent(JSON.stringify(formData))
    const authorizingUrl = `/dashboard/billing/authorizing?paymentForm=${encodedFormData}`

    console.log('[表單提交] 重定向到:', authorizingUrl)
    router.push(authorizingUrl)
  }

  async function handlePlanPurchase(plan: SubscriptionPlan) {
    try {
      setProcessingPlanId(plan.id)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/pricing')
        return
      }

      const { data: companies } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const companyId = companies?.[0]?.company_id
      if (!companyId) {
        alert('找不到公司資訊，請先完成註冊')
        return
      }

      const price = getPlanPrice(plan)
      const isLifetime = billingPeriod === 'lifetime'

      if (isLifetime) {
        const response = await fetch('/api/payment/onetime/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            paymentType: 'lifetime',
            relatedId: plan.id,
            amount: price,
            description: `${plan.name} 終身方案`,
            email: user.email || '',
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '支付請求失敗')
        }

        if (data.paymentForm) {
          submitPaymentForm(data.paymentForm)
        }
      } else {
        const periodType = billingPeriod === 'yearly' ? 'Y' : 'M'
        const amount = billingPeriod === 'yearly' ? plan.yearly_price : plan.monthly_price

        // 使用今天的日期作為每月扣款日
        const today = new Date()
        const dayOfMonth = today.getDate().toString().padStart(2, '0')

        const response = await fetch('/api/payment/recurring/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            planId: plan.id,
            amount,
            description: `${plan.name} ${billingPeriod === 'yearly' ? '年繳' : '月繳'}方案`,
            email: user.email || '',
            periodType,
            periodPoint: dayOfMonth,
            periodStartType: 2,
            periodTimes: 12,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '支付請求失敗')
        }

        if (data.paymentForm) {
          console.log('[定期定額] 準備提交表單，paymentForm:', data.paymentForm)
          console.log('[定期定額] API URL:', data.paymentForm.apiUrl)
          submitPaymentForm(data.paymentForm)
        }
      }
    } catch (error) {
      console.error('購買失敗:', error)
      alert(error instanceof Error ? error.message : '購買失敗，請稍後再試')
    } finally {
      setProcessingPlanId(null)
    }
  }

  async function handleTokenPackagePurchase(pkg: TokenPackage) {
    try {
      setProcessingPackageId(pkg.id)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/pricing')
        return
      }

      const { data: companies } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const companyId = companies?.[0]?.company_id
      if (!companyId) {
        alert('找不到公司資訊，請先完成註冊')
        return
      }

      const response = await fetch('/api/payment/onetime/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId,
          paymentType: 'token_package',
          relatedId: pkg.id,
          amount: pkg.price,
          description: `購買 ${pkg.name}`,
          email: user.email || '',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '支付請求失敗')
      }

      if (data.paymentForm) {
        submitPaymentForm(data.paymentForm)
      }
    } catch (error) {
      console.error('購買失敗:', error)
      alert(error instanceof Error ? error.message : '購買失敗，請稍後再試')
    } finally {
      setProcessingPackageId(null)
    }
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
      <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">AutoPilot SEO</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {userEmail ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="" alt="User avatar" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">使用者帳號</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userEmail}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>控制台</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>登出</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  登入
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

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
              <span>年繳 (省 20%)</span>
              <Badge className="absolute -top-2 -right-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs px-1.5 py-0">
                最划算
              </Badge>
            </button>
            <button
              onClick={() => setBillingPeriod('lifetime')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'lifetime'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>終身方案</span>
              <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 text-xs px-1.5 py-0">
                <Crown className="w-3 h-3" />
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
                    billingPeriod === 'lifetime'
                      ? 'border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-purple-50/50 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-purple-900/10 shadow-2xl shadow-purple-500/20 hover:shadow-purple-500/30'
                      : isPopular
                        ? 'border-primary/50 shadow-2xl shadow-primary/30 hover:shadow-primary/40'
                        : 'border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20'
                  }`}
                >
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                    <div className="mb-1">
                      <div className="text-lg text-muted-foreground mb-1">NT$</div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${billingPeriod === 'lifetime' ? 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent' : ''}`}>
                          {price.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">
                          {billingPeriod === 'lifetime' ? '' : billingPeriod === 'yearly' ? '/ 年' : '/ 月'}
                        </span>
                      </div>
                      {billingPeriod === 'lifetime' && (
                        <p className="text-sm text-muted-foreground">一次付費</p>
                      )}
                    </div>

                    {billingPeriod === 'yearly' && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        相當於月繳 10 個月費用
                      </p>
                    )}
                    {billingPeriod === 'lifetime' && (
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                        一次付清，終身享有
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
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      每月重置
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {renderFeatureList(features)}
                  </ul>

                  <Button
                    onClick={() => handlePlanPurchase(plan)}
                    disabled={
                      processingPlanId === plan.id ||
                      !canUpgradeWrapper(currentTier, currentBillingPeriod, plan, billingPeriod)
                    }
                    className={`w-full group/button mt-auto ${
                      isPopular
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                  >
                    <span>
                      {processingPlanId === plan.id
                        ? '處理中...'
                        : !canUpgradeWrapper(currentTier, currentBillingPeriod, plan, billingPeriod)
                          ? isCurrentPlan(currentTier, currentBillingPeriod, plan, billingPeriod)
                            ? '目前方案'
                            : '無法升級'
                          : '開始使用'}
                    </span>
                    {processingPlanId !== plan.id && canUpgradeWrapper(currentTier, currentBillingPeriod, plan, billingPeriod) && (
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/button:translate-x-1 transition-transform" />
                    )}
                  </Button>
                </div>

                {isPopular && (
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
                )}
              </div>
            )
          })}
        </div>

        {/* 功能比較表 */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">功能完整比較</h2>
            <p className="text-lg text-muted-foreground">
              選擇最適合您需求的方案
            </p>
          </div>

          <div className="max-w-6xl mx-auto overflow-x-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">功能</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">STARTER</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold bg-primary/5">
                      PROFESSIONAL
                      <div className="text-xs font-normal text-primary mt-1">最受歡迎</div>
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">BUSINESS</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">AGENCY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">每月 Tokens</td>
                    <td className="px-6 py-4 text-center">25K</td>
                    <td className="px-6 py-4 text-center bg-primary/5 font-semibold text-primary">100K</td>
                    <td className="px-6 py-4 text-center">300K</td>
                    <td className="px-6 py-4 text-center">750K</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">使用者席位</td>
                    <td className="px-6 py-4 text-center">1</td>
                    <td className="px-6 py-4 text-center bg-primary/5">3</td>
                    <td className="px-6 py-4 text-center">10</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">WordPress 網站</td>
                    <td className="px-6 py-4 text-center">1</td>
                    <td className="px-6 py-4 text-center bg-primary/5">5</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">圖片 & 文章生成</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                    <td className="px-6 py-4 text-center bg-primary/5">無限制</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                    <td className="px-6 py-4 text-center">無限制</td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">API 存取</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center bg-primary/5">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">團隊協作功能</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center bg-primary/5 text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">白標 (White-Label)</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center bg-primary/5 text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center text-muted-foreground">—</td>
                    <td className="px-6 py-4 text-center">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">客服支援</td>
                    <td className="px-6 py-4 text-center">標準支援</td>
                    <td className="px-6 py-4 text-center bg-primary/5">優先支援</td>
                    <td className="px-6 py-4 text-center">專屬客戶經理</td>
                    <td className="px-6 py-4 text-center">專屬客戶經理</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Token 購買包作為誘餌方案 */}
        <section className="mb-16">
          <div className="text-center mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 backdrop-blur-sm">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">彈性加值包（用完再買）</span>
            </div>
            <h2 className="text-4xl font-bold">彈性加值，永不過期</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              一次性購買 Token 包，永久有效不過期
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              {tokenPackages.map((pkg) => {
                const perTokenPrice = (pkg.price / (pkg.tokens / 1000)).toFixed(2)
                return (
                  <div
                    key={pkg.id}
                    className="group relative bg-card rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-border hover:border-amber-400 dark:hover:border-amber-500"
                  >
                    <div className="text-center space-y-3">
                      <div className="text-3xl font-bold">
                        {(pkg.tokens / 1000).toLocaleString()}K
                      </div>
                      <div className="text-xs text-muted-foreground">Tokens</div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        NT$ {pkg.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        單價: NT$ {perTokenPrice} / 1K
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleTokenPackagePurchase(pkg)}
                        disabled={processingPackageId === pkg.id}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                      >
                        {processingPackageId === pkg.id ? '處理中...' : '購買'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              💡 <span className="font-medium">提示：</span>訂閱 <span className="text-primary font-semibold">STARTER 方案</span> (NT$ 699)，每月即享 <span className="text-primary font-semibold">25K Tokens</span>，更划算！
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                所有<span className="font-bold">終身會員</span>，皆享 Token 購買包 <span className="font-bold text-lg">8 折優惠</span>
              </p>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">AI 模型定價</h2>
              <p className="text-sm text-muted-foreground">動態計費，透明價格</p>
            </div>
          </div>
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      模型
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      供應商
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Input / 1M Token
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Output / 1M Token
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {aiModels.map((model) => (
                    <tr
                      key={model.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        {model.model_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">
                        {model.provider}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground font-mono">
                        ${model.input_price_per_1m.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-muted-foreground font-mono">
                        ${model.output_price_per_1m.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
