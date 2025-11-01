import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
    const status = formData.get('Status') as string
    const tradeInfo = formData.get('TradeInfo') as string
    const tradeSha = formData.get('TradeSha') as string

    if (!tradeInfo || !tradeSha) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.handleOnetimeCallback(tradeInfo, tradeSha)

    if (result.success) {
      const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${redirectUrl}/dashboard/billing?payment=success`)
    } else {
      const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${redirectUrl}/dashboard/billing?payment=failed&error=${encodeURIComponent(result.error || '支付失敗')}`)
    }
  } catch (error) {
    console.error('[API] 處理支付回調失敗:', error)
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${redirectUrl}/dashboard/billing?payment=error`)
  }
}
