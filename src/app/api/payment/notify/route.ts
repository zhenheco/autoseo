import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const formData = await request.formData()
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
      return NextResponse.json({ Status: 'SUCCESS' })
    } else {
      return NextResponse.json(
        { Status: 'FAILED', Message: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[API] 處理支付通知失敗:', error)
    return NextResponse.json(
      { Status: 'FAILED', Message: '處理支付通知失敗' },
      { status: 500 }
    )
  }
}
