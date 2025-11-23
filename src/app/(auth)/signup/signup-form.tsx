'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Loader2 } from 'lucide-react'

interface SignupFormProps {
  error?: string
  success?: string
  verified?: string
  unverified?: string
  email?: string
}

export function SignupForm({ error, success, verified, unverified, email }: SignupFormProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleResendVerification() {
    if (!email) return

    setIsResending(true)
    setResendMessage('')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setResendMessage(data.message || '驗證信已重新發送')
      } else {
        setResendMessage(data.error || '重發失敗，請稍後再試')
      }
    } catch (err) {
      setResendMessage('網路錯誤，請稍後再試')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <>
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">註冊成功！</p>
              <p className="text-xs">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <p>{error}</p>
          {verified && (
            <div className="mt-3">
              <Link
                href="/login"
                className="inline-block text-sm text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
              >
                前往登入 →
              </Link>
            </div>
          )}
          {unverified && email && (
            <div className="mt-3 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    發送中...
                  </>
                ) : (
                  '重新發送驗證信'
                )}
              </Button>
              {resendMessage && (
                <p className="text-xs text-center">
                  {resendMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <form
        action={async (formData) => {
          setIsSubmitting(true)
          await signup(formData)
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            電子郵件
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your@email.com"
            required
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            密碼
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="至少 6 個字元"
            required
            minLength={6}
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <p className="text-xs text-muted-foreground">
            密碼至少需要 6 個字元
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            確認密碼
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="再次輸入密碼"
            required
            minLength={6}
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-400">
              <p className="font-medium mb-1">需要驗證電子郵件</p>
              <p className="text-xs">註冊後請檢查您的信箱，點擊驗證連結以啟用帳號</p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              註冊中...
            </>
          ) : (
            '建立帳號'
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-center text-sm text-muted-foreground">
          已經有帳號？{' '}
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
          >
            立即登入
          </Link>
        </p>
      </div>
    </>
  )
}
