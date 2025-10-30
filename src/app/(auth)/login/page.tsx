import Link from 'next/link'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sparkles } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">歡迎回來</h1>
          <p className="text-base text-muted-foreground">登入您的 Auto Pilot SEO 帳號</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/5">
          {params.success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-medium">
              {params.success}
            </div>
          )}
          {params.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
              {params.error}
            </div>
          )}

          <form action={login} className="space-y-5">
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
                className="h-11 bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  密碼
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
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
                className="h-11 bg-background border-border"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              登入帳號
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-sm text-muted-foreground">
              還沒有帳號？{' '}
              <Link
                href="/register"
                className="text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                立即註冊
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8 px-8">
          登入即表示您同意我們的{' '}
          <Link href="/terms" className="underline hover:text-foreground transition-colors">
            服務條款
          </Link>
          {' '}和{' '}
          <Link href="/privacy" className="underline hover:text-foreground transition-colors">
            隱私政策
          </Link>
        </p>
      </div>
    </div>
  )
}
