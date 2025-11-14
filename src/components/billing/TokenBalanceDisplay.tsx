'use client'

import useSWR from 'swr'
import { formatNumber } from '@/lib/utils'

interface TokenBalance {
  monthly: number
  purchased: number
  total: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('無法取得 token 餘額')
  }
  return res.json()
}

export function TokenBalanceDisplay() {
  const { data: balance, error, isLoading } = useSWR<TokenBalance>(
    '/api/billing/balance',
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  if (isLoading) {
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
        <p className="text-sm text-red-600">{error?.message || '無法載入餘額'}</p>
      </div>
    )
  }

  const isLowBalance = balance.total < 1000

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 標題 */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Token 餘額</h3>
        {isLowBalance && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            餘額不足
          </span>
        )}
      </div>

      {/* 總餘額 */}
      <div className="mb-4">
        <p className={`text-2xl font-bold ${isLowBalance ? 'text-red-600' : 'text-gray-900'}`}>
          {formatNumber(balance.total)}
        </p>
        <p className="text-xs text-gray-500">可用 tokens</p>
      </div>

      {/* 餘額明細 */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">月配額剩餘</span>
          <span className="font-medium text-gray-900">{formatNumber(balance.monthly)}</span>
        </div>

        {balance.purchased > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">購買 tokens</span>
            <span className="font-medium text-gray-900">{formatNumber(balance.purchased)}</span>
          </div>
        )}
      </div>

      {/* 餘額不足警告 */}
      {isLowBalance && (
        <div className="mt-3 rounded-md bg-red-50 p-3">
          <p className="text-xs text-red-700">
            Token 餘額不足，請升級方案或購買 token 包以確保服務不中斷。
          </p>
          <a
            href="/dashboard/billing/upgrade"
            className="mt-2 inline-block text-xs font-medium text-red-700 underline hover:text-red-800"
          >
            立即升級 →
          </a>
        </div>
      )}
    </div>
  )
}
