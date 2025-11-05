import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

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

      // 檢查使用者是否為 OAuth 登入
      const provider = data.user?.app_metadata?.provider
      if (provider && provider !== 'email') {
        console.log(`OAuth login detected: ${provider}`)
        // Database trigger 會自動建立公司和訂閱
      }

      // 重定向到指定頁面或 dashboard
      return NextResponse.redirect(requestUrl.origin + next)
    }
  }

  return NextResponse.redirect(
    requestUrl.origin + '/login?error=' + encodeURIComponent('驗證失敗，請重新登入')
  )
}
