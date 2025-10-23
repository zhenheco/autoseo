'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signUp } from '@/lib/auth'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signUp(email, password)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '註冊失敗'
    redirect(`/signup?error=${encodeURIComponent(errorMessage)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
