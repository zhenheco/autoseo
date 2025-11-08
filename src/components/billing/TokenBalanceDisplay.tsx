'use client'

import { useEffect, useState } from 'react'
import { formatNumber } from '@/lib/utils'

interface TokenBalance {
  balance: {
    total: number
    monthlyQuota: number
    purchased: number
  }
  subscription: {
    tier: 'free' | 'basic' | 'pro' | 'enterprise'
    monthlyTokenQuota: number
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
  }
  plan: {
    name: string
    slug: string
    features: Record<string, unknown>
    limits: Record<string, unknown>
  } | null
}

export function TokenBalanceDisplay() {
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/token-balance')

      if (!response.ok) {
        throw new Error('無法取得 token 餘額')
      }

      const data = await response.json()
      setBalance(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200"></div>
          <div className="h-8 w-32 rounded bg-gray-200"></div>
        </div>
      </div>
    )
  }

  if (error || !balance) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error || '無法載入餘額'}</p>
      </div>
    )
  }

  const usagePercentage = balance.subscription.monthlyTokenQuota > 0
    ? ((balance.subscription.monthlyTokenQuota - balance.balance.monthlyQuota) / balance.subscription.monthlyTokenQuota) * 100
    : 0

  const isFree = balance.subscription.tier === 'free'
  const isLowBalance = balance.balance.total < 5000

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 標題 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Token 餘額</h3>
        {isFree && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            免費方案
          </span>
        )}
      </div>

      {/* 總餘額 */}
      <div className="mb-4">
        <p className={`text-2xl font-bold ${isLowBalance ? 'text-orange-600' : 'text-gray-900'}`}>
          {formatNumber(balance.balance.total)}
        </p>
        <p className="text-xs text-gray-500">可用 tokens</p>
      </div>

      {/* 餘額明細 */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">月配額剩餘</span>
          <span className="font-medium text-gray-900">
            {formatNumber(balance.balance.monthlyQuota)} / {formatNumber(balance.subscription.monthlyTokenQuota)}
          </span>
        </div>

        {balance.balance.purchased > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">購買 tokens</span>
            <span className="font-medium text-gray-900">{formatNumber(balance.balance.purchased)}</span>
          </div>
        )}

        {/* 使用進度條 */}
        <div className="pt-2">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>本月使用率</span>
            <span>{usagePercentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercentage > 90
                  ? 'bg-red-500'
                  : usagePercentage > 70
                  ? 'bg-orange-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 週期資訊 */}
      {balance.subscription.currentPeriodEnd && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            配額重置：{new Date(balance.subscription.currentPeriodEnd).toLocaleDateString('zh-TW')}
          </p>
        </div>
      )}

      {/* 免費方案提示 */}
      {isFree && (
        <div className="mt-3 rounded-md bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            免費方案每月提供 {formatNumber(balance.subscription.monthlyTokenQuota)} tokens，
            升級可獲得更多配額和功能！
          </p>
        </div>
      )}

      {/* 餘額不足警告 */}
      {isLowBalance && !isFree && (
        <div className="mt-3 rounded-md bg-orange-50 p-3">
          <p className="text-xs text-orange-700">
            Token 餘額不足，建議購買 token 包以確保服務不中斷。
          </p>
        </div>
      )}
    </div>
  )
}
