'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function AuthorizingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [status, setStatus] = useState<'loading' | 'submitting' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const paymentForm = searchParams.get('paymentForm')

    if (!paymentForm) {
      setTimeout(() => {
        setStatus('error')
        setErrorMessage('缺少付款表單資料')
      }, 0)
      setTimeout(() => {
        router.push('/dashboard/billing')
      }, 3000)
      return
    }

    try {
      const formData = JSON.parse(decodeURIComponent(paymentForm))

      if (formRef.current && formData.apiUrl && formData.postData && formData.merchantId) {
        formRef.current.action = formData.apiUrl

        setTimeout(() => {
          setStatus('submitting')
        }, 0)

        const merchantInput = document.createElement('input')
        merchantInput.type = 'hidden'
        merchantInput.name = 'MerchantID_'
        merchantInput.value = formData.merchantId
        formRef.current.appendChild(merchantInput)

        const postDataInput = document.createElement('input')
        postDataInput.type = 'hidden'
        postDataInput.name = 'PostData_'
        postDataInput.value = formData.postData
        formRef.current.appendChild(postDataInput)

        setTimeout(() => {
          formRef.current?.submit()
        }, 500)
      }
    } catch (error) {
      console.error('[Authorizing] 解析付款表單失敗:', error)
      setTimeout(() => {
        setStatus('error')
        setErrorMessage('付款表單資料格式錯誤')
      }, 0)
      setTimeout(() => {
        router.push('/dashboard/billing')
      }, 3000)
    }
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-6">
          {status === 'error' ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">處理失敗</h2>
                <p className="mt-2 text-gray-600">{errorMessage}</p>
                <p className="mt-4 text-sm text-gray-500">即將返回計費頁面...</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">正在前往授權頁面</h2>
                <p className="mt-2 text-gray-600">
                  {status === 'loading' ? '正在準備付款資料...' : '正在連接藍新金流...'}
                </p>
                <p className="mt-4 text-sm text-gray-500">請稍候，不要關閉此頁面</p>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full animate-pulse bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: '75%' }}
                />
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>安全加密連線</span>
              </div>
            </>
          )}
        </div>
      </div>

      <form
        ref={formRef}
        method="post"
        action=""
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default function AuthorizingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">載入中...</h2>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AuthorizingContent />
    </Suspense>
  )
}
