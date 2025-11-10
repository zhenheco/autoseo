import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ensureUserHasCompany,
  getProviderFromUser,
  isOAuthProvider,
  getDefaultCompanyName,
} from '@/lib/auth/oauth-setup'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const error = requestUrl.searchParams.get('error')

  if (error) {
    console.warn(`[OAuth Callback] OAuth error: ${error}`)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=oauth_cancelled`
    )
  }

  if (!code) {
    console.error('[OAuth Callback] Missing authorization code')
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=missing_code`
    )
  }

  const supabase = await createClient()

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[OAuth Callback] Failed to exchange code:', exchangeError)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=exchange_failed`
    )
  }

  if (!data.session || !data.user) {
    console.error('[OAuth Callback] No session or user after exchange')
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=no_session`
    )
  }

  const { user } = data
  const provider = getProviderFromUser(user)

  console.log(`[OAuth Callback] User authenticated: ${user.id}, provider: ${provider}`)

  if (provider && isOAuthProvider(provider)) {
    console.log(`[OAuth Callback] OAuth login detected: ${provider}`)

    const companyName = getDefaultCompanyName(user, provider)
    const result = await ensureUserHasCompany(
      user.id,
      user.email!,
      companyName
    )

    if (!result.success) {
      console.error('[OAuth Callback] Failed to ensure company:', result.error)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=company_creation_failed`
      )
    }

    console.log(
      `[OAuth Callback] Company setup succeeded via ${result.path} (${result.delay}ms)`
    )
  }

  console.log(`[OAuth Callback] Redirecting to: ${next}`)
  return NextResponse.redirect(requestUrl.origin + next)
}
