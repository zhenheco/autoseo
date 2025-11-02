import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '未授權' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      companyId,
      planId,
      amount,
      description,
      email,
      periodType,
      periodPoint,
      periodStartType,
      periodTimes,
    } = body

    // periodTimes 可以是 0（表示無限期），所以不檢查它的 truthy 值
    if (!companyId || !planId || !amount || !description || !email || !periodType || periodStartType === undefined) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: '無權限存取此公司' },
        { status: 403 }
      )
    }

    const paymentService = PaymentService.createInstance(supabase)

    const result = await paymentService.createRecurringPayment({
      companyId,
      planId,
      amount,
      description,
      email,
      periodType,
      periodPoint,
      periodStartType,
      periodTimes,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mandateId: result.mandateId,
      mandateNo: result.mandateNo,
      paymentForm: result.paymentForm,
    })
  } catch (error) {
    console.error('[API] 建立定期定額支付失敗:', error)
    return NextResponse.json(
      { error: '建立定期定額支付失敗' },
      { status: 500 }
    )
  }
}
