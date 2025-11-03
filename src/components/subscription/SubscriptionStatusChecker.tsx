'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export function SubscriptionStatusChecker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const paymentStatus = searchParams.get('payment')
    const mandateNo = searchParams.get('mandateNo')
    const error = searchParams.get('error')

    if (paymentStatus === 'failed' || paymentStatus === 'error') {
      setStatus('failed')
      setMessage(error || '訂閱失敗')
      setTimeout(() => {
        router.replace('/dashboard/subscription')
      }, 5000)
      return
    }

    if (paymentStatus === 'success') {
      setStatus('success')
      setMessage('訂閱成功！您的方案已更新')
      setTimeout(() => {
        router.replace('/dashboard/subscription')
        window.location.reload()
      }, 3000)
      return
    }

    if (paymentStatus === 'pending' && mandateNo) {
      setStatus('checking')
      setMessage('正在處理您的訂閱...')

      setTimeout(() => {
        router.replace('/dashboard/subscription')
        window.location.reload()
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
          <br />
          <span className="text-xs text-muted-foreground">
            頁面將自動重新載入以顯示最新資訊...
          </span>
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
