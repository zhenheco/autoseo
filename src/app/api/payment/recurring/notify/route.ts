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
      return NextResponse.json({ Status: 'SUCCESS' })
    } else {
      return NextResponse.json(
        { Status: 'FAILED', Message: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[API] 處理定期定額通知失敗:', error)
    return NextResponse.json(
      { Status: 'FAILED', Message: '處理定期定額通知失敗' },
      { status: 500 }
    )
  }
}
