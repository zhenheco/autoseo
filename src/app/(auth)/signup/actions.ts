'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signUp } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * 將 Supabase 錯誤訊息轉換成中文
 */
async function translateErrorMessage(error: Error, email: string): Promise<string> {
  const message = error.message.toLowerCase()

  // 帳號已存在 - 檢查是否已驗證
  if (message.includes('user already registered') || message.includes('already registered')) {
    const adminClient = createAdminClient()

    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers()

    if (!listError && users) {
      const existingUser = users.find(u => u.email === email)

      if (existingUser) {
        const isConfirmed = existingUser.email_confirmed_at !== null

        if (isConfirmed) {
          return 'VERIFIED_USER'
        } else {
          return 'UNVERIFIED_USER'
        }
      }
    }

    return '此電子郵件已被註冊，請直接登入'
  }

  // Email 驗證相關
  if (message.includes('email not confirmed')) {
    return '電子郵件尚未驗證，請檢查您的信箱並點擊驗證連結'
  }

  // 密碼相關
  if (message.includes('password')) {
    return '密碼格式不符合要求，請使用至少 6 個字元'
  }

  // Email 格式
  if (message.includes('invalid email')) {
    return '電子郵件格式不正確'
  }

  // 網路錯誤
  if (message.includes('network') || message.includes('fetch')) {
    return '網路連線錯誤，請稍後再試'
  }

  // 預設錯誤
  return '註冊失敗，請稍後再試'
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!email || !password || !confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('請填寫所有欄位')}`)
  }

  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent('兩次輸入的密碼不一致')}`)
  }

  try {
    await signUp(email, password)

    // 註冊成功，停留在註冊頁並顯示成功訊息
    redirect(`/signup?success=${encodeURIComponent('註冊成功！我們已發送驗證郵件到您的信箱，請點擊郵件中的連結完成驗證')}`)
  } catch (error) {
    // Next.js redirect() 會拋出 NEXT_REDIRECT 錯誤，需要重新拋出
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String((error as { digest?: string }).digest || '')
      if (digest.startsWith('NEXT_REDIRECT')) {
        throw error
      }
    }

    const errorMessage = error instanceof Error ? await translateErrorMessage(error, email) : '註冊失敗'

    if (errorMessage === 'VERIFIED_USER') {
      redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊，請直接登入')}&verified=true`)
    } else if (errorMessage === 'UNVERIFIED_USER') {
      redirect(`/signup?error=${encodeURIComponent('此電子郵件已註冊但尚未驗證，請檢查您的信箱或重發驗證信')}&unverified=true&email=${encodeURIComponent(email)}`)
    } else {
      redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
    }
  }
}
