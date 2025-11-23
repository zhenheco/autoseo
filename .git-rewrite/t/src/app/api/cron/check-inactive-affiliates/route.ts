import { NextRequest, NextResponse } from 'next/server'
import { checkInactiveAffiliates } from '@/lib/affiliate/commission'

/**
 * GET /api/cron/check-inactive-affiliates
 * Cron Job: 每日執行一次，檢查超過 3 個月無活動的聯盟夥伴
 * Vercel Cron: 0 2 * * *
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證 Cron Secret (Vercel Cron)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 })
    }

    // 執行檢查
    await checkInactiveAffiliates(supabaseUrl, supabaseServiceKey)

    console.log('✅ 不活躍聯盟夥伴檢查完成')

    return NextResponse.json({
      success: true,
      message: 'Inactive affiliates checked successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron Job 錯誤:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
