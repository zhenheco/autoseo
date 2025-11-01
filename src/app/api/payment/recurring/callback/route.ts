import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const period = formData.get('Period') as string

    if (!period) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.handleRecurringCallback(period)

    if (result.success) {
      const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${redirectUrl}/dashboard/billing?subscription=success`)
    } else {
      const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${redirectUrl}/dashboard/billing?subscription=failed&error=${encodeURIComponent(result.error || '訂閱失敗')}`)
    }
  } catch (error) {
    console.error('[API] 處理定期定額回調失敗:', error)
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${redirectUrl}/dashboard/billing?subscription=error`)
  }
}
