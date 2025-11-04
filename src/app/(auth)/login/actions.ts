'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
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
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : '登入失敗'
    redirect(`/login?error=${encodeURIComponent(errorMessage)}`, RedirectType.replace)
  }
}
