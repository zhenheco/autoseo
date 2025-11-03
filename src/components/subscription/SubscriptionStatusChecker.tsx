'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export function SubscriptionStatusChecker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | null>(null)
  const [message, setMessage] = useState<string>('')
  const hasProcessed = useRef(false)

  useEffect(() => {
    // 防止重複執行
    if (hasProcessed.current) return

    const paymentStatus = searchParams.get('payment')
    const mandateNo = searchParams.get('mandateNo')
    const error = searchParams.get('error')

    // 如果沒有 payment 參數，不做任何處理
    if (!paymentStatus) return

    // 標記已處理
    hasProcessed.current = true

    // 使用 setTimeout 將 setState 延遲到下一個事件循環
    if (paymentStatus === 'failed' || paymentStatus === 'error') {
      setTimeout(() => {
        setStatus('failed')
        setMessage(error || '訂閱失敗')
      }, 0)
      setTimeout(() => {
        router.replace('/dashboard/subscription')
      }, 5000)
      return
    }

    if (paymentStatus === 'success') {
      setTimeout(() => {
        setStatus('success')
        setMessage('訂閱成功！您的方案已更新')
      }, 0)
      // 只在成功時重新載入（需要更新 server component 的訂閱資料）
      setTimeout(() => {
        window.location.href = '/dashboard/subscription'
      }, 3000)
      return
    }

    if (paymentStatus === 'pending' && mandateNo) {
      setTimeout(() => {
        setStatus('checking')
        setMessage('正在處理您的訂閱...')
      }, 0)
      // pending 狀態只清理 URL，不重新載入
      setTimeout(() => {
        router.replace('/dashboard/subscription')
      }, 5000)
    }
  }, [searchParams, router])

  if (!status) {
    return null
  }

  if (status === 'checking') {
    return (
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
        <AlertTitle className="text-blue-500">處理中</AlertTitle>
        <AlertDescription>
          {message}
          <br />
          <span className="text-xs text-muted-foreground">
            這可能需要幾秒鐘，請稍候...
          </span>
        </AlertDescription>
      </Alert>
    )
  }

  if (status === 'success') {
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <AlertTitle className="text-green-500">訂閱成功</AlertTitle>
        <AlertDescription>
          {message}
        </AlertDescription>
      </Alert>
    )
  }

  if (status === 'failed') {
    return (
      <Alert className="border-red-500/50 bg-red-500/10">
        <XCircle className="h-5 w-5 text-red-500" />
        <AlertTitle className="text-red-500">訂閱失敗</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  return null
}
