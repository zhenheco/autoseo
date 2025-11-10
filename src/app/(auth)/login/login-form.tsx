'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authenticateUser } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface LoginFormProps {
  error?: string
  success?: string
  unverified?: string
  email?: string
}

export function LoginForm({ error, success, unverified, email }: LoginFormProps) {
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
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <p>{error}</p>
          {error.includes('尚未註冊') && (
            <div className="mt-2">
              <Link
                href="/signup"
                className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
              >
                前往註冊 →
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
          await authenticateUser(formData)
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              密碼
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary/80 hover:underline underline-offset-4 font-medium transition-all"
            >
              忘記密碼？
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={6}
            className="h-11 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登入中...
            </>
          ) : (
            '繼續'
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-center text-sm text-muted-foreground">
          還沒有帳號？{' '}
          <Link
            href="/signup"
            className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
          >
            立即註冊
          </Link>
        </p>
      </div>
    </>
  )
}
