import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()

    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '未授權' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      planId,
      periodType,
      periodStartType,
    } = body

    console.log('[API] 收到建立定期定額請求:', { planId, periodType, periodStartType })

    if (!planId || !periodType || periodStartType === undefined) {
      console.error('[API] 缺少必要參數:', { planId, periodType, periodStartType })
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    const { data: membership } = await authClient
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: '找不到使用者所屬公司' },
        { status: 403 }
      )
    }

    const companyId = membership.company_id

    const { data: plan } = await authClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (!plan) {
      return NextResponse.json(
        { error: '找不到訂閱方案' },
        { status: 404 }
      )
    }

    const amount = plan.monthly_price || 0
    const description = `${plan.name} 月繳訂閱`
    const email = user.email || ''

    let periodPoint: string | undefined
    if (periodType === 'M') {
      const today = new Date()
      periodPoint = today.getDate().toString()
    }

    const periodTimes = 0

    const supabase = createAdminClient()
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

    console.log('[API] PaymentService 回應:', {
      success: result.success,
      mandateId: result.mandateId,
      mandateNo: result.mandateNo,
      hasPaymentForm: !!result.paymentForm,
      error: result.error
    })

    if (!result.success) {
      console.error('[API] PaymentService 回傳失敗:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const response = {
      success: true,
      mandateId: result.mandateId,
      mandateNo: result.mandateNo,
      paymentForm: result.paymentForm,
    }

    console.log('[API] 回傳給前端:', {
      success: response.success,
      mandateId: response.mandateId,
      mandateNo: response.mandateNo,
      paymentFormKeys: response.paymentForm ? Object.keys(response.paymentForm) : []
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] 建立定期定額支付失敗:', error)
    return NextResponse.json(
      { error: '建立定期定額支付失敗' },
      { status: 500 }
    )
  }
}
