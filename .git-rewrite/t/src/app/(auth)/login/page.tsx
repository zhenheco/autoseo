import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sparkles } from 'lucide-react'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; unverified?: string; email?: string }>
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
          <LoginForm
            error={params.error}
            success={params.success}
            unverified={params.unverified}
            email={params.email}
          />
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
