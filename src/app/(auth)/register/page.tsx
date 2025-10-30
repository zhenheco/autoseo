import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function register(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/register?error=' + encodeURIComponent('請輸入電子郵件和密碼'))
  }

  if (email !== 'ace@zhenhe-co.com') {
    redirect('/register?error=' + encodeURIComponent('此電子郵件無法註冊，請使用 ace@zhenhe-co.com'))
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
    redirect('/register?error=' + encodeURIComponent(error.message))
  }

  if (data.user) {
    redirect('/login?success=' + encodeURIComponent('註冊成功！請登入'))
  }

  redirect('/register?error=' + encodeURIComponent('註冊失敗'))
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[450px]">
          <div className="bg-black rounded-lg p-8 md:p-12">
            <h1 className="text-white text-center text-5xl font-bold mb-12">
              註冊 Auto Pilot SEO
            </h1>

            {params.error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 text-red-400 rounded-md text-[14px] text-center">
                {params.error}
              </div>
            )}
            {params.success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 text-green-400 rounded-md text-[14px] text-center">
                {params.success}
              </div>
            )}

            <form action={register} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-[14px] font-semibold">
                  電子郵件地址
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="電子郵件地址"
                  required
                  className="bg-[#121212] border-gray-700 text-white placeholder:text-gray-500 h-14 text-[14px] rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white text-[14px] font-semibold">
                  密碼
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="密碼（至少 6 個字元）"
                  required
                  minLength={6}
                  className="bg-[#121212] border-gray-700 text-white placeholder:text-gray-500 h-14 text-[14px] rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-[14px] bg-green-500 hover:bg-green-400 hover:scale-105 text-black font-bold rounded-full transition-all mt-8"
              >
                註冊
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-800">
              <p className="text-gray-400 text-center text-[14px]">
                已經有帳號了？{' '}
                <Link href="/login" className="text-white hover:text-green-400 underline font-semibold">
                  登入 Auto Pilot SEO
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="p-8 text-center text-gray-500 text-[14px]">
        <p>此網站受 reCAPTCHA 保護，並適用 Google <a href="#" className="underline">隱私權政策</a>與<a href="#" className="underline">服務條款</a>。</p>
        <p className="mt-2">© 2025 Auto Pilot SEO</p>
      </footer>
    </div>
  )
}
