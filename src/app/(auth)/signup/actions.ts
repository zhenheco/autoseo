'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signUp } from '@/lib/auth'

/**
 * 將 Supabase 錯誤訊息轉換成中文
 */
function translateErrorMessage(error: Error): string {
  const message = error.message.toLowerCase()

  // Email 驗證相關
  if (message.includes('email not confirmed')) {
    return '電子郵件尚未驗證，請檢查您的信箱並點擊驗證連結'
  }

  // 帳號已存在
  if (message.includes('user already registered') || message.includes('already registered')) {
    return '此電子郵件已被註冊，請直接登入'
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

    // 註冊成功，重定向到登入頁並顯示成功訊息
    redirect(`/login?success=${encodeURIComponent('註冊成功！請檢查您的電子郵件以驗證帳號')}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? translateErrorMessage(error) : '註冊失敗'
    redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
  }
}
