import Link from 'next/link'
import { authenticateUser } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { OAuthButtons, OAuthDivider } from '@/components/auth/oauth-buttons'
import { Sparkles } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            歡迎使用 Auto Pilot SEO
          </h1>
          <p className="text-base text-muted-foreground">使用 Google 帳號或 Email 快速開始</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {params.success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {params.success}
            </div>
          )}
          {params.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {params.error}
              {params.error.includes('尚未註冊') && (
                <div className="mt-2">
                  <Link
                    href="/signup"
                    className="text-primary hover:text-primary/80 hover:underline underline-offset-4 font-semibold transition-all"
                  >
                    前往註冊 →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* OAuth 登入/註冊按鈕 */}
          <OAuthButtons redirectTo="/dashboard" actionText="繼續" />

          <OAuthDivider />

          <form action={authenticateUser} className="space-y-5">
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
              className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 transition-colors"
            >
              繼續
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
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8 px-8">
          繼續即表示您同意我們的{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-all">
            服務條款
          </Link>
          {' '}和{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-all">
            隱私政策
          </Link>
        </p>
      </div>
    </div>
  )
}
