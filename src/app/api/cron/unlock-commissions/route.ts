import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cron/unlock-commissions
 * Cron Job: 每小時執行一次，解鎖已過鎖定期的佣金
 * Vercel Cron: 0 * * * *
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 呼叫資料庫函數解鎖佣金
    const { error: unlockError } = await supabase.rpc('unlock_commissions')

    if (unlockError) {
      console.error('解鎖佣金失敗:', unlockError)
      return NextResponse.json(
        { success: false, error: unlockError.message },
        { status: 500 }
      )
    }

    console.log('✅ 佣金解鎖完成')

    return NextResponse.json({
      success: true,
      message: 'Commissions unlocked successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron Job 錯誤:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
