'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 將 Supabase 錯誤訊息轉換成中文
 */
function translateErrorMessage(error: Error): string {
  const message = error.message.toLowerCase()

  // Email 驗證相關
  if (message.includes('email not confirmed')) {
    return '電子郵件尚未驗證，請檢查您的信箱並點擊驗證連結'
  }

  // 登入憑證錯誤或使用者不存在 - 統一提示註冊
  if (message.includes('invalid login credentials') ||
      message.includes('invalid credentials') ||
      message.includes('user not found')) {
    return '此帳號尚未註冊，請先註冊帳號'
  }

  // 帳號已存在
  if (message.includes('user already registered') || message.includes('already registered')) {
    return '此電子郵件已被註冊'
  }

  // 密碼相關
  if (message.includes('password')) {
    return '密碼格式不符合要求'
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
  return error.message
}

export async function authenticateUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('請輸入電子郵件和密碼')}`, RedirectType.replace)
  }

  try {
    // 先嘗試登入
    const data = await signIn(email, password)

    const supabase = await createClient()
    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', data.user.id)
      .eq('status', 'active')
      .single()

    const userRole = membership?.role || 'viewer'

    revalidatePath('/', 'layout')

    if (userRole === 'writer' || userRole === 'viewer') {
      redirect('/dashboard/articles', RedirectType.replace)
    } else {
      redirect('/dashboard', RedirectType.replace)
    }
  } catch (loginError) {
    // 檢查是否為 redirect error，如果是就直接拋出
    if (loginError && typeof loginError === 'object' && 'digest' in loginError && typeof loginError.digest === 'string' && loginError.digest.startsWith('NEXT_REDIRECT')) {
      throw loginError
    }

    // 直接顯示錯誤訊息，不自動註冊
    const errorMessage = loginError instanceof Error ? loginError.message : ''
    const translatedError = loginError instanceof Error ? translateErrorMessage(loginError) : errorMessage
    redirect(`/login?error=${encodeURIComponent(translatedError)}`, RedirectType.replace)
  }
}
