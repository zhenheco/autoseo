'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export function PaymentStatusChecker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | null>(null)
  const [message, setMessage] = useState<string>('')
  const [pollCount, setPollCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    const paymentStatus = searchParams.get('payment')
    const orderNo = searchParams.get('orderNo')
    const error = searchParams.get('error')

    // 如果是明確的失敗或錯誤，直接顯示
    if (paymentStatus === 'failed' || paymentStatus === 'error') {
      setStatus('failed')
      setMessage(error || '付款失敗')
      return
    }

    // 如果是成功狀態，直接顯示
    if (paymentStatus === 'success') {
      setStatus('success')
      setMessage('付款成功')
      return
    }

    // 如果是 pending 且有 orderNo，開始輪詢
    if (paymentStatus === 'pending' && orderNo) {
      setStatus('checking')
      setMessage('正在確認付款狀態...')

      const pollOrderStatus = async () => {
        try {
          const response = await fetch(`/api/payment/order-status/${orderNo}`)
          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || '查詢失敗')
          }

          if (data.synced && data.order) {
            // 訂單已同步
            if (data.order.status === 'success') {
              setStatus('success')
              setMessage('付款成功')
              // 清除 URL 參數，更新為成功狀態
              setTimeout(() => {
                router.replace('/dashboard/subscription?payment=success')
              }, 2000)
            } else if (data.order.status === 'failed') {
              setStatus('failed')
              setMessage(data.order.newebpayMessage || '付款失敗')
              setTimeout(() => {
                router.replace(`/dashboard/subscription?payment=failed&error=${encodeURIComponent(data.order.newebpayMessage || '付款失敗')}`)
              }, 2000)
            } else {
              // 訂單仍在處理中，繼續輪詢
              setPollCount(prev => prev + 1)
            }
          } else {
            // 訂單尚未同步，繼續輪詢
            setPollCount(prev => prev + 1)
          }
        } catch (error) {
          console.error('[PaymentStatusChecker] 查詢訂單狀態失敗:', error)
          const newErrorCount = errorCount + 1
          setErrorCount(newErrorCount)

          if (newErrorCount >= 3 || pollCount >= 85) {
            setStatus('failed')
            setMessage('無法確認付款狀態，請重新整理頁面或聯繫客服')
            return
          }

          setPollCount(prev => prev + 1)
        }
      }

      // 立即執行一次
      pollOrderStatus()

      // 每 3 秒輪詢一次，最多輪詢 90 次（270 秒 = 4.5 分鐘）
      let currentPollCount = 0
      const maxPolls = 90
      const pollInterval = 3000

      const interval = setInterval(() => {
        currentPollCount++
        if (currentPollCount >= maxPolls) {
          clearInterval(interval)
          setStatus('failed')
          setMessage('付款確認超時，請重新整理頁面或聯繫客服')
          return
        }
        pollOrderStatus()
      }, pollInterval)

      return () => clearInterval(interval)
    }
  }, [searchParams, router])

  if (!status) {
    return null
  }

  if (status === 'checking') {
    return (
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        <AlertTitle className="text-blue-500">確認中</AlertTitle>
        <AlertDescription>
          {message}
          <br />
          <span className="text-xs text-muted-foreground">
            這可能需要幾秒鐘，請稍候...（{pollCount}/90）
          </span>
        </AlertDescription>
      </Alert>
    )
  }

  if (status === 'success') {
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <AlertTitle className="text-green-500">付款成功</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  if (status === 'failed') {
    return (
      <Alert className="border-red-500/50 bg-red-500/10">
        <XCircle className="h-5 w-5 text-red-500" />
        <AlertTitle className="text-red-500">付款失敗</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  return null
}
