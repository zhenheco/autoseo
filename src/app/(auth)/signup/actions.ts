'use server'

import { redirect } from 'next/navigation'
import { signUp } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // 基本驗證
  if (!email || !password || !confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('請填寫所有欄位')}`)
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('兩次輸入的密碼不一致')}`)
  }

  try {
    // 使用 RPC 函數查詢用戶
    const supabase = await createClient()
    const { data: userData, error: rpcError } = await supabase.rpc('get_user_by_email', {
      email_input: email
    })

    console.log('[Signup] RPC 查詢結果:', { userData, rpcError })

    // 檢查用戶是否已存在
    if (userData && userData.length > 0) {
      const user = userData[0]
      const isConfirmed = user.email_confirmed_at !== null

      if (isConfirmed) {
        // 已驗證用戶
        redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊，請直接登入')}&verified=true`)
      } else {
        // 未驗證用戶
        redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊但尚未驗證，請檢查您的信箱或重發驗證信')}&unverified=true&email=${encodeURIComponent(email)}`)
      }
    }

    // 用戶不存在，執行註冊
    console.log('[Signup] 用戶不存在，執行 signUp')
    await signUp(email, password)

    // 註冊成功
    redirect(`/signup?success=${encodeURIComponent('註冊成功！我們已發送驗證郵件到您的信箱，請點擊郵件中的連結完成驗證')}`)
  } catch (error) {
    // Next.js redirect() 會拋出 NEXT_REDIRECT 錯誤，需要重新拋出
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String((error as { digest?: string }).digest || '')
      if (digest.startsWith('NEXT_REDIRECT')) {
        throw error
      }
    }

    console.error('[Signup] 錯誤:', error)
    const errorMessage = error instanceof Error ? error.message : '註冊失敗，請稍後再試'
    redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
  }
}
