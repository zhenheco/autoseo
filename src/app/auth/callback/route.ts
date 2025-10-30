import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(
        requestUrl.origin + '/login?error=' + encodeURIComponent(error.message)
      )
    }

    if (data.session) {
      console.log('Session created successfully for user:', data.user?.email)
      return NextResponse.redirect(requestUrl.origin + '/dashboard')
    }
  }

  return NextResponse.redirect(
    requestUrl.origin + '/login?error=' + encodeURIComponent('驗證失敗，請重新註冊')
  )
}
