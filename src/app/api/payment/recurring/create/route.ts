import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PaymentService } from '@/lib/payment/payment-service'
import { canUpgrade, getUpgradeBlockReason, type BillingPeriod } from '@/lib/subscription/upgrade-rules'

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

    const { data: company, error: companyError } = await authClient
      .from('companies')
      .select('subscription_tier')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('[API] 無法查詢公司資料:', {
        userId: user.id,
        companyId,
        error: companyError?.message,
        code: companyError?.code
      })
      return NextResponse.json(
        {
          error: '找不到公司資料',
          code: 'COMPANY_NOT_FOUND',
          details: companyError?.message || 'Company ID does not exist in database'
        },
        { status: 404 }
      )
    }

    // 從 company_subscriptions 取得當前的計費週期
    const { data: currentSubscription } = await authClient
      .from('company_subscriptions')
      .select('plan_id, subscription_plans(slug, billing_period)')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    const currentTierSlug = company.subscription_tier || null
    const currentBillingPeriod = (currentSubscription?.subscription_plans as { billing_period?: BillingPeriod })?.billing_period || 'monthly'
    const targetBillingPeriod = periodType === 'M' ? 'monthly' : (periodType === 'Y' ? 'yearly' : 'monthly')

    console.log('[API] 升級驗證:', {
      currentTier: currentTierSlug,
      currentPeriod: currentBillingPeriod,
      targetTier: plan.slug,
      targetPeriod: targetBillingPeriod
    })

    if (!canUpgrade(currentTierSlug, currentBillingPeriod, plan.slug, targetBillingPeriod)) {
      const reason = getUpgradeBlockReason(currentTierSlug, currentBillingPeriod, plan.slug, targetBillingPeriod)
      console.warn('[API] 升級驗證失敗:', reason)
      return NextResponse.json(
        { error: reason || '無法升級到此方案' },
        { status: 400 }
      )
    }

    const amount = plan.monthly_price || 0
    const description = `${plan.name} 月繳訂閱`
    const email = user.email || ''

    let periodPoint: string | undefined
    if (periodType === 'M') {
      const today = new Date()
      periodPoint = today.getDate().toString().padStart(2, '0')
    }

    const periodTimes = 12

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
