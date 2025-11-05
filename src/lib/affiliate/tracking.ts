/**
 * 聯盟行銷追蹤工具函數
 */

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const AFFILIATE_COOKIE_NAME = 'affiliate_ref'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 天（秒）

/**
 * 從 URL 取得推薦碼
 */
export function getAffiliateCodeFromUrl(request: NextRequest): string | null {
  const { searchParams } = request.nextUrl
  return searchParams.get('ref')
}

/**
 * 從 Cookie 取得推薦碼
 */
export function getAffiliateCodeFromCookie(request: NextRequest): string | null {
  return request.cookies.get(AFFILIATE_COOKIE_NAME)?.value || null
}

/**
 * Cookie 設定選項
 */
export function getAffiliateCookieOptions() {
  return {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}

/**
 * 記錄追蹤事件
 */
export async function logTrackingEvent({
  supabaseUrl,
  supabaseServiceKey,
  affiliateCode,
  eventType,
  request,
  companyId,
  userId,
  metadata,
}: {
  supabaseUrl: string
  supabaseServiceKey: string
  affiliateCode: string
  eventType: 'click' | 'visit' | 'register' | 'payment'
  request: NextRequest
  companyId?: string
  userId?: string
  metadata?: Record<string, any>
}) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0] : request.ip || null

    const data = {
      affiliate_code: affiliateCode,
      event_type: eventType,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || null,
      referer: request.headers.get('referer') || null,
      company_id: companyId || null,
      user_id: userId || null,
      metadata: metadata || null,
    }

    const { error } = await supabase.from('affiliate_tracking_logs').insert(data)

    if (error) {
      console.error('❌ 記錄追蹤事件失敗:', error)
    }
  } catch (error) {
    console.error('❌ 記錄追蹤事件例外:', error)
  }
}

/**
 * 驗證推薦碼格式
 */
export function validateAffiliateCode(code: string): boolean {
  // 推薦碼應為 8 位英數字（大寫）
  const pattern = /^[A-Z0-9]{8}$/
  return pattern.test(code)
}

/**
 * 生成推薦碼（用於伺服器端）
 */
export function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * 取得客戶端 IP
 */
export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return request.ip || null
}
