'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useState } from 'react'
import type { Database } from '@/types/database.types'

type Plan = Database['public']['Tables']['subscription_plans']['Row']

interface SubscriptionPlansProps {
  plans: Plan[]
  companyId: string
  userEmail: string
  currentTier: string
}

export function SubscriptionPlans({ plans, companyId, userEmail, currentTier }: SubscriptionPlansProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleSubscribe = async (plan: Plan) => {
    try {
      setLoading(plan.id)

      const response = await fetch('/api/payment/recurring/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          periodType: 'M',
          periodStartType: 2,
        }),
      })

      const data = await response.json()

      if (data.success && data.paymentForm) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.paymentForm.action

        Object.entries(data.paymentForm.params).forEach(([key, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = value as string
          form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()
      } else {
        alert(`訂閱失敗: ${data.error || '未知錯誤'}`)
      }
    } catch (error) {
      console.error('訂閱錯誤:', error)
      alert('訂閱失敗，請稍後再試')
    } finally {
      setLoading(null)
    }
  }

  const getPlanColor = (slug: string) => {
    if (slug.includes('starter')) return 'border-blue-500'
    if (slug.includes('professional')) return 'border-purple-500'
    if (slug.includes('business')) return 'border-orange-500'
    return 'border-border'
  }

  const getTierFromSlug = (slug: string): string => {
    if (slug.includes('starter')) return 'basic'
    if (slug.includes('professional')) return 'pro'
    if (slug.includes('business')) return 'pro'
    return 'free'
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const planTier = getTierFromSlug(plan.slug)
        const isCurrentPlan = planTier === currentTier

        return (
          <Card
            key={plan.id}
            className={`relative ${getPlanColor(plan.slug)} ${
              isCurrentPlan ? 'ring-2 ring-primary' : ''
            }`}
          >
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                目前方案
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>每月 {plan.base_tokens?.toLocaleString()} Tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    ${plan.monthly_price?.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">/月</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.base_tokens?.toLocaleString()} Tokens / 月</span>
                </div>
                {plan.features && Array.isArray(plan.features) && (plan.features as string[]).map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id || isCurrentPlan}
              >
                {loading === plan.id ? '處理中...' : isCurrentPlan ? '目前方案' : '立即訂閱'}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
