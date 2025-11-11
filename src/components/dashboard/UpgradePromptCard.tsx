'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Check, ArrowRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface UpgradePromptCardProps {
  currentTier: 'free' | 'basic' | 'pro' | 'enterprise'
  tokenBalance: number
}

export function UpgradePromptCard({ currentTier, tokenBalance }: UpgradePromptCardProps) {
  const router = useRouter()
  const [processingSlug, setProcessingSlug] = useState<string | null>(null)

  // 只對免費用戶顯示
  if (currentTier !== 'free') {
    return null
  }

  const isLowBalance = tokenBalance < 5000

  const plans = [
    {
      name: 'STARTER',
      slug: 'starter',
      price: 699,
      yearlyPrice: 5825, // 699 * 10 = 6990, 83折 = 5825
      tokens: '25K (多 150%)',
      features: [
        '連接 1 個 WordPress 網站',
        '使用全部 AI 模型',
        '每篇文章無限圖片',
        '優先客服支援'
      ],
      isPopular: false,
      gradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      name: 'PROFESSIONAL',
      slug: 'professional',
      price: 2499,
      yearlyPrice: 24990, // 2499 * 12 = 29988, 83折 = 24990
      tokens: '100K',
      features: [
        '連接 5 個 WordPress 網站',
        '3 個團隊成員',
        'API 存取',
        '品牌聲音設定'
      ],
      isPopular: true,
      gradient: 'from-primary/10 to-secondary/10',
      borderColor: 'border-primary/50'
    }
  ]

  const handleUpgrade = async (planSlug: string, _yearlyPrice: number, _planName: string) => {
    try {
      setProcessingSlug(planSlug)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/dashboard')
        return
      }

      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('slug', planSlug)
        .single()

      if (!plan) {
        alert('找不到方案資訊')
        return
      }

      const response = await fetch('/api/payment/recurring/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '支付請求失敗')
      }

      if (data.paymentForm) {
        const formData = {
          apiUrl: data.paymentForm.apiUrl,
          postData: data.paymentForm.postData,
          tradeInfo: data.paymentForm.tradeInfo,
          tradeSha: data.paymentForm.tradeSha,
          version: data.paymentForm.version,
          merchantId: data.paymentForm.merchantId
        }

        const encodedFormData = encodeURIComponent(JSON.stringify(formData))
        router.push(`/dashboard/billing/authorizing?paymentForm=${encodedFormData}`)
      }
    } catch (error) {
      console.error('升級失敗:', error)
      alert(error instanceof Error ? error.message : '升級失敗，請稍後再試')
    } finally {
      setProcessingSlug(null)
    }
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">升級解鎖更多功能</CardTitle>
            <CardDescription>
              {isLowBalance
                ? '您的 Token 即將用完，升級獲得更多配額！'
                : '選擇最適合您的方案，讓您的 SEO 更上一層樓'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 50%50% 雙欄布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative p-5 rounded-xl border-2 bg-gradient-to-br transition-all duration-300 hover:shadow-lg",
                plan.gradient,
                plan.borderColor
              )}
            >
              {/* 推薦標籤 */}
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                    <Zap className="h-3 w-3" />
                    最受歡迎
                  </span>
                </div>
              )}

              {/* 方案名稱 */}
              <div className="mb-3">
                <h3 className="font-bold text-lg">{plan.name}</h3>
              </div>

              {/* 價格 */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">NT$ {plan.price.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">/月</span>
                </div>
                <div className="mt-1">
                  <span className="text-sm font-semibold text-primary">{plan.tokens} tokens/月</span>
                </div>
              </div>

              {/* 特色功能 */}
              <div className="space-y-2 mb-4">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                      <Check className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <span className="text-xs text-foreground leading-tight">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA 按鈕 */}
              <Button
                onClick={() => handleUpgrade(plan.slug, plan.yearlyPrice, plan.name)}
                disabled={processingSlug === plan.slug}
                className={cn(
                  "w-full",
                  plan.isPopular
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                )}
                size="sm"
              >
                {processingSlug === plan.slug ? '處理中...' : '立即升級'}
                {processingSlug !== plan.slug && <ArrowRight className="ml-2 h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            隨時可以取消，無需綁約
          </p>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/pricing">
              查看所有方案
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
