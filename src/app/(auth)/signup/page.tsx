import Link from 'next/link'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sparkles, Mail } from 'lucide-react'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
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
            建立新帳號
          </h1>
          <p className="text-base text-muted-foreground">輸入您的 Email 以建立新帳號</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          {params.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {params.error}
            </div>
          )}

          <form action={signup} className="space-y-5">
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

            {/* Email 驗證提示 */}
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
              className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 transition-colors"
            >
              建立帳號
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
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8 px-8">
          註冊即表示您同意我們的{' '}
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
