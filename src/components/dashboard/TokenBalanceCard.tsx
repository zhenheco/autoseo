'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import Link from 'next/link'

interface TokenBalance {
  balance: {
    total: number
    monthlyQuota: number
    purchased: number
  }
  subscription: {
    tier: 'free' | 'basic' | 'pro' | 'enterprise'
    monthlyTokenQuota: number
  }
}

export function TokenBalanceCard() {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/token-balance')
      if (response.ok) {
        const data = await response.json()
        setBalance(data)
      }
    } catch (error) {
      console.error('Failed to fetch token balance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="group bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6 animate-pulse">
        <div className="h-24"></div>
      </div>
    )
  }

  if (!balance) {
    return null
  }

  const usagePercentage = balance.subscription.monthlyTokenQuota > 0
    ? ((balance.subscription.monthlyTokenQuota - balance.balance.monthlyQuota) / balance.subscription.monthlyTokenQuota) * 100
    : 0

  const isLowBalance = balance.balance.total < 5000
  const isCritical = balance.balance.total < 2000
  const isFree = balance.subscription.tier === 'free'

  return (
    <Link href="/dashboard/subscription" className="block">
      <div className={cn(
        "group bg-card/50 backdrop-blur-sm rounded-xl border p-6 card-hover-lift hover:shadow-xl transition-all duration-300",
        isCritical ? "border-red-500/50 hover:border-red-500" : isLowBalance ? "border-orange-500/50 hover:border-orange-500" : "border-border/50 hover:border-primary/50"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Token 餘額
            </p>
            <p className={cn(
              "text-4xl font-bold mb-2 group-hover:text-primary transition-colors",
              isCritical ? "text-red-600" : isLowBalance ? "text-orange-600" : "text-foreground"
            )}>
              {formatNumber(balance.balance.total)}
            </p>

            {/* 使用進度條或餘額資訊 */}
            <div className="space-y-1">
              {isFree ? (
                // 免費方案：顯示一次性餘額（硬編碼文字）
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    一次性 Token 餘額
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white dark:bg-blue-600 dark:text-white font-medium">
                    免費方案
                  </span>
                </div>
              ) : (
                // 付費方案：顯示使用進度
                <>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      usagePercentage > 90 ? "text-red-600" : usagePercentage > 70 ? "text-orange-600" : "text-success"
                    )}>
                      {usagePercentage.toFixed(0)}% 已使用
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        usagePercentage > 90 ? "bg-red-500" : usagePercentage > 70 ? "bg-orange-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className={cn(
            'p-4 rounded-xl group-hover:scale-110 transition-transform',
            isCritical ? "bg-red-500/10" : isLowBalance ? "bg-orange-500/10" : "bg-primary/10"
          )}>
            <Coins className={cn(
              'h-7 w-7',
              isCritical ? "text-red-600" : isLowBalance ? "text-orange-600" : "text-primary"
            )} />
          </div>
        </div>

        {/* 警告提示 */}
        {isCritical && (
          <div className="mt-4 p-2 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-700 font-medium">⚠️ Token 即將用完，請儘快購買</p>
          </div>
        )}
      </div>
    </Link>
  )
}
