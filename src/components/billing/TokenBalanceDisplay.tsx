'use client'

import { useEffect } from 'react'
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
  const { data: balance, error, isLoading, mutate } = useSWR<TokenBalance>(
    '/api/billing/balance',
    fetcher,
    {
      refreshInterval: 10000, // 降低輪詢頻率
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // 防止重複請求
    }
  )

  // 監聽文章生成完成事件，立即更新餘額
  useEffect(() => {
    const handleArticleGenerated = () => {
      // 立即重新驗證餘額
      mutate()
    }

    // 監聽自訂事件
    window.addEventListener('articleGenerated', handleArticleGenerated)
    window.addEventListener('articlesUpdated', handleArticleGenerated)

    return () => {
      window.removeEventListener('articleGenerated', handleArticleGenerated)
      window.removeEventListener('articlesUpdated', handleArticleGenerated)
    }
  }, [mutate])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-gray-200"></div>
          <div className="h-5 w-20 rounded bg-gray-200"></div>
        </div>
      </div>
    )
  }

  if (error || !balance) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
        <p className="text-xs text-red-600">{error?.message || '無法載入餘額'}</p>
      </div>
    )
  }

  const isLowBalance = balance.total < 1000

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {/* 標題和總餘額 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Token 餘額:</span>
        <span className={`text-lg font-bold ${isLowBalance ? 'text-red-600' : 'text-gray-900'}`}>
          {formatNumber(balance.total)}
        </span>
      </div>

      {/* 餘額明細 - 簡化顯示 */}
      <div className="flex items-center gap-3 border-l border-gray-200 pl-3 text-xs text-gray-500">
        <span>月配額: {formatNumber(balance.monthly)}</span>
        {balance.purchased > 0 && (
          <span>購買: {formatNumber(balance.purchased)}</span>
        )}
      </div>

      {/* 餘額不足警告 */}
      {isLowBalance && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            餘額不足
          </span>
          <a
            href="/dashboard/billing/upgrade"
            className="text-xs font-medium text-red-700 underline hover:text-red-800"
          >
            立即升級
          </a>
        </div>
      )}
    </div>
  )
}
