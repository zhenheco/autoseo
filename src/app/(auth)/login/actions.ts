'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

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

    // 檢查是否為「使用者不存在」的錯誤
    const errorMessage = loginError instanceof Error ? loginError.message : ''
    const isUserNotFound = errorMessage.includes('Invalid login credentials') || errorMessage.includes('User not found')

    if (isUserNotFound) {
      // 使用者不存在，嘗試自動註冊
      try {
        const { user } = await signUp(email, password)

        if (user) {
          // 註冊成功，自動登入
          const loginData = await signIn(email, password)

          const supabase = await createClient()
          const { data: membership } = await supabase
            .from('company_members')
            .select('role')
            .eq('user_id', loginData.user.id)
            .eq('status', 'active')
            .single()

          const userRole = membership?.role || 'viewer'

          revalidatePath('/', 'layout')

          if (userRole === 'writer' || userRole === 'viewer') {
            redirect('/dashboard/articles', RedirectType.replace)
          } else {
            redirect('/dashboard', RedirectType.replace)
          }
        }
      } catch (signupError) {
        // 註冊失敗
        if (signupError && typeof signupError === 'object' && 'digest' in signupError && typeof signupError.digest === 'string' && signupError.digest.startsWith('NEXT_REDIRECT')) {
          throw signupError
        }
        const signupErrorMessage = signupError instanceof Error ? signupError.message : '註冊失敗'
        redirect(`/login?error=${encodeURIComponent(signupErrorMessage)}`, RedirectType.replace)
      }
    } else {
      // 其他登入錯誤（例如密碼錯誤）
      redirect(`/login?error=${encodeURIComponent(errorMessage)}`, RedirectType.replace)
    }
  }
}
