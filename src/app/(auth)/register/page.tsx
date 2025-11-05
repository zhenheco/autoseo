import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sparkles } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function register(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const invitationId = formData.get('invitation') as string

  if (!email || !password) {
    const redirectUrl = invitationId
      ? `/register?invitation=${invitationId}&email=${encodeURIComponent(email || '')}&error=${encodeURIComponent('請輸入電子郵件和密碼')}`
      : '/register?error=' + encodeURIComponent('請輸入電子郵件和密碼')
    redirect(redirectUrl)
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3168'}/auth/callback`,
    },
  })

  if (error) {
    const redirectUrl = invitationId
      ? `/register?invitation=${invitationId}&email=${encodeURIComponent(email)}&error=${encodeURIComponent(error.message)}`
      : '/register?error=' + encodeURIComponent(error.message)
    redirect(redirectUrl)
  }

  if (data.user && invitationId) {
    const adminClient = createAdminClient()

    const { data: invitation } = await adminClient
      .from('company_members')
      .select('invited_email')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single()

    if (!invitation) {
      redirect('/register?error=' + encodeURIComponent('無效的邀請連結'))
    }

    if (invitation.invited_email && invitation.invited_email !== email) {
      redirect('/register?error=' + encodeURIComponent('請使用受邀的電子郵件地址註冊'))
    }

    const { error: updateError } = await adminClient
      .from('company_members')
      .update({
        user_id: data.user.id,
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('更新邀請狀態失敗:', updateError)
      redirect('/register?error=' + encodeURIComponent('邀請激活失敗，請聯絡管理員'))
    }
  }

  if (data.user) {
    redirect('/login?success=' + encodeURIComponent('註冊成功！請登入'))
  }

  redirect('/register?error=' + encodeURIComponent('註冊失敗'))
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; invitation?: string; email?: string }>
}) {
  const params = await searchParams

  // 如果沒有邀請參數，重定向到登入頁
  if (!params.invitation) {
    redirect('/login')
  }

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
            接受邀請
          </h1>
          <p className="text-base text-muted-foreground">使用受邀的電子郵件完成註冊</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
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

          {/* 邀請註冊提示 */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl text-sm">
            您正在透過邀請連結註冊，請使用受邀的電子郵件地址完成帳號建立。
          </div>

          <form action={register} className="space-y-5">
            <input type="hidden" name="invitation" value={params.invitation} />
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                電子郵件
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                defaultValue={params.email || ''}
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
