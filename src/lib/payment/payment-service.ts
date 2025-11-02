import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { NewebPayService, type OnetimePaymentParams, type RecurringPaymentParams } from './newebpay-service'

export interface CreateOnetimeOrderParams {
  companyId: string
  paymentType: 'subscription' | 'token_package' | 'lifetime'
  relatedId: string
  amount: number
  description: string
  email: string
}

export interface CreateRecurringOrderParams {
  companyId: string
  planId: string
  amount: number
  description: string
  email: string
  periodType: 'D' | 'W' | 'M' | 'Y'
  periodPoint?: string
  periodStartType: 1 | 2 | 3
  periodTimes?: number
}

export class PaymentService {
  private supabase: ReturnType<typeof createClient<Database>>
  private newebpay: NewebPayService

  constructor(
    supabase: ReturnType<typeof createClient<Database>>,
    newebpay: NewebPayService
  ) {
    this.supabase = supabase
    this.newebpay = newebpay
  }

  private generateOrderNo(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `ORD${timestamp}${random}`
  }

  private generateMandateNo(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `MAN${timestamp}${random}`
  }

  async createOnetimePayment(params: CreateOnetimeOrderParams): Promise<{
    success: boolean
    orderId?: string
    orderNo?: string
    paymentForm?: {
      merchantId: string
      tradeInfo: string
      tradeSha: string
      version: string
      apiUrl: string
    }
    error?: string
  }> {
    const orderNo = this.generateOrderNo()

    console.log('[PaymentService] 建立單次付款訂單:', {
      orderNo,
      companyId: params.companyId,
      amount: params.amount,
      paymentType: params.paymentType
    })

    const { data: orderData, error: orderError } = await this.supabase
      .from('payment_orders')
      .insert({
        company_id: params.companyId,
        order_no: orderNo,
        order_type: 'onetime',
        payment_type: params.paymentType,
        amount: params.amount,
        item_description: params.description,
        related_id: params.relatedId,
        status: 'pending',
      })
      .select<'*', Database['public']['Tables']['payment_orders']['Row']>()
      .single()

    if (orderError || !orderData) {
      console.error('[PaymentService] 建立訂單失敗:', { orderNo, error: orderError })
      return { success: false, error: '建立訂單失敗' }
    }

    console.log('[PaymentService] 訂單建立成功:', {
      orderId: orderData.id,
      orderNo: orderData.order_no
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const paymentParams: OnetimePaymentParams = {
      orderNo,
      amount: params.amount,
      description: params.description,
      email: params.email,
      returnUrl: `${baseUrl}/api/payment/recurring/callback`,
      notifyUrl: `${baseUrl}/api/payment/notify`,
      clientBackUrl: `${baseUrl}/dashboard/billing`,
    }

    const paymentForm = this.newebpay.createOnetimePayment(paymentParams)

    return {
      success: true,
      orderId: orderData.id,
      orderNo: orderData.order_no,
      paymentForm,
    }
  }

  async createRecurringPayment(params: CreateRecurringOrderParams): Promise<{
    success: boolean
    mandateId?: string
    mandateNo?: string
    paymentForm?: {
      merchantId: string
      postData: string
      postDataSha?: string  // 定期定額不需要 postDataSha
      apiUrl: string
    }
    error?: string
  }> {
    const mandateNo = this.generateMandateNo()

    const { data: mandateData, error: mandateError } = await this.supabase
      .from('recurring_mandates')
      .insert({
        company_id: params.companyId,
        plan_id: params.planId,
        mandate_no: mandateNo,
        period_type: params.periodType,
        period_point: params.periodPoint,
        period_times: params.periodTimes,
        period_amount: params.amount,
        total_amount: params.periodTimes ? params.amount * params.periodTimes : null,
        status: 'pending',
      })
      .select<'*', Database['public']['Tables']['recurring_mandates']['Row']>()
      .single()

    if (mandateError || !mandateData) {
      console.error('[PaymentService] 建立定期定額委託失敗:', mandateError)
      return { success: false, error: '建立定期定額委託失敗' }
    }

    const orderNo = this.generateOrderNo()

    const { data: orderData, error: orderError } = await this.supabase
      .from('payment_orders')
      .insert({
        company_id: params.companyId,
        order_no: orderNo,
        order_type: 'recurring_first',
        payment_type: 'subscription',
        amount: params.amount,
        item_description: params.description,
        related_id: params.planId,
        status: 'pending',
      })
      .select<'*', Database['public']['Tables']['payment_orders']['Row']>()
      .single()

    if (orderError || !orderData) {
      console.error('[PaymentService] 建立訂單失敗:', orderError)
      return { success: false, error: '建立訂單失敗' }
    }

    await this.supabase
      .from('recurring_mandates')
      .update({ first_payment_order_id: orderData.id })
      .eq('id', mandateData.id)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // 確保 periodPoint 是兩位數格式
    let formattedPeriodPoint: string | undefined
    if (params.periodPoint && params.periodType === 'M') {
      // 月繳需要兩位數格式 (01-31)
      const day = parseInt(params.periodPoint)
      formattedPeriodPoint = day.toString().padStart(2, '0')
    } else {
      formattedPeriodPoint = params.periodPoint
    }

    const paymentParams: RecurringPaymentParams = {
      orderNo: mandateNo,
      amount: params.amount,
      description: params.description,
      email: params.email,
      periodType: params.periodType,
      periodPoint: formattedPeriodPoint,
      periodStartType: params.periodStartType,
      periodTimes: params.periodTimes,
      returnUrl: `${baseUrl}/api/payment/recurring/callback`,
      notifyUrl: `${baseUrl}/api/payment/recurring/notify`,
      clientBackUrl: `${baseUrl}/dashboard/billing`,
    }

    const paymentForm = this.newebpay.createRecurringPayment(paymentParams)

    return {
      success: true,
      mandateId: mandateData.id,
      mandateNo: mandateData.mandate_no,
      paymentForm,
    }
  }

  async handleOnetimeCallback(tradeInfo: string, tradeSha: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const decryptedData = this.newebpay.decryptCallback(tradeInfo, tradeSha)

      const status = decryptedData.Status as string
      const message = decryptedData.Message as string
      const orderNo = decryptedData.MerchantOrderNo as string
      const tradeNo = decryptedData.TradeNo as string
      const amount = decryptedData.Amt as number

      console.log('[PaymentService] 處理付款通知:', {
        orderNo,
        status,
        tradeNo,
        amount
      })

      // 加入重試機制，應對 Supabase 多區域複製延遲
      // 重試策略：最多重試 20 次，總等待時間約 20-25 秒
      // 重試間隔: 500ms, 1000ms, 1500ms, 2000ms, 然後固定 2000ms
      let orderData: Database['public']['Tables']['payment_orders']['Row'] | null = null
      let findError: unknown = null

      for (let attempt = 1; attempt <= 20; attempt++) {
        const { data, error } = await this.supabase
          .from('payment_orders')
          .select<'*', Database['public']['Tables']['payment_orders']['Row']>('*')
          .eq('order_no', orderNo)
          .maybeSingle() // 使用 maybeSingle() 避免 PGRST116 錯誤

        if (data && !error) {
          orderData = data
          findError = null
          console.log(`[PaymentService] 成功找到訂單 (第 ${attempt} 次嘗試)`)
          break
        }

        findError = error
        console.log(`[PaymentService] 查詢訂單失敗 (嘗試 ${attempt}/20):`, { orderNo, error })

        if (attempt < 20) {
          // 更長的重試間隔，應對 Supabase 複製延遲
          // 500ms, 1000ms, 1500ms, 2000ms, 2000ms...
          const delay = Math.min(500 * attempt, 2000)
          console.log(`[PaymentService] 等待 ${delay}ms 後重試 (應對資料庫複製延遲)`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (findError || !orderData) {
        console.error('[PaymentService] 找不到訂單（已重試20次，總計約20-25秒）:', {
          orderNo,
          tradeNo,
          error: findError,
          hint: '可能是 Supabase 多區域複製延遲超過預期'
        })
        return { success: false, error: '找不到訂單' }
      }

      console.log('[PaymentService] 找到訂單:', { id: orderData.id, status: orderData.status })

      if (status === 'SUCCESS') {
        const { error: updateError } = await this.supabase
          .from('payment_orders')
          .update({
            status: 'success',
            newebpay_status: status,
            newebpay_message: message,
            newebpay_trade_no: tradeNo,
            newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
            paid_at: new Date().toISOString(),
          })
          .eq('id', orderData.id)

        if (updateError) {
          console.error('[PaymentService] 更新訂單狀態失敗:', updateError)
          return { success: false, error: '更新訂單狀態失敗' }
        }

        if (orderData.payment_type === 'token_package' && orderData.related_id) {
          const { data: packageData } = await this.supabase
            .from('token_packages')
            .select<'*', Database['public']['Tables']['token_packages']['Row']>('*')
            .eq('id', orderData.related_id)
            .single()

          if (packageData) {
            const { data: subscription } = await this.supabase
              .from('company_subscriptions')
              .select<'purchased_token_balance', { purchased_token_balance: number }>('purchased_token_balance')
              .eq('company_id', orderData.company_id)
              .single()

            if (subscription) {
              const newBalance = subscription.purchased_token_balance + packageData.tokens

              await this.supabase
                .from('company_subscriptions')
                .update({ purchased_token_balance: newBalance })
                .eq('company_id', orderData.company_id)

              await this.supabase.from('token_balance_changes').insert({
                company_id: orderData.company_id,
                change_type: 'purchase',
                amount: packageData.tokens,
                balance_before: subscription.purchased_token_balance,
                balance_after: newBalance,
                reference_id: orderData.id,
                description: `購買 ${packageData.name}`,
              })
            }
          }
        } else if ((orderData.payment_type === 'subscription' || orderData.payment_type === 'lifetime') && orderData.related_id) {
          const isLifetime = orderData.payment_type === 'lifetime'

          const { data: planData } = await this.supabase
            .from('subscription_plans')
            .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
            .eq('id', orderData.related_id)
            .single()

          if (planData) {
            const now = new Date()
            const periodStart = now.toISOString()
            const periodEnd = isLifetime
              ? null
              : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

            await this.supabase.from('company_subscriptions').upsert({
              company_id: orderData.company_id,
              plan_id: orderData.related_id,
              status: 'active',
              purchased_token_balance: 0,
              monthly_quota_balance: planData.base_tokens,
              monthly_token_quota: planData.base_tokens,
              is_lifetime: isLifetime,
              lifetime_discount: isLifetime ? 0.8 : 1.0,
              current_period_start: periodStart,
              current_period_end: periodEnd,
            })

            await this.supabase.from('token_balance_changes').insert({
              company_id: orderData.company_id,
              change_type: 'quota_renewal',
              amount: planData.base_tokens,
              balance_before: 0,
              balance_after: planData.base_tokens,
              description: `訂閱 ${planData.name} 方案${isLifetime ? '（終身）' : ''}`,
            })
          }
        }

        return { success: true }
      } else {
        const { error: updateError } = await this.supabase
          .from('payment_orders')
          .update({
            status: 'failed',
            newebpay_status: status,
            newebpay_message: message,
            newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
            failed_at: new Date().toISOString(),
            failure_reason: message,
          })
          .eq('id', orderData.id)

        if (updateError) {
          console.error('[PaymentService] 更新訂單狀態失敗:', updateError)
        }

        return { success: false, error: message }
      }
    } catch (error) {
      console.error('[PaymentService] 處理回調失敗:', error)
      return { success: false, error: '處理回調失敗' }
    }
  }

  // 解密 TradeInfo 格式的定期定額回調
  decryptTradeInfoForRecurring(tradeInfo: string, tradeSha: string): any {
    return this.newebpay.decryptCallback(tradeInfo, tradeSha)
  }

  // 解密 Period 格式的定期定額授權回調
  decryptPeriodCallback(period: string): any {
    return this.newebpay.decryptPeriodCallback(period)
  }

  async handleRecurringCallback(period: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const decryptedData = this.newebpay.decryptPeriodCallback(period)

      const status = decryptedData.Status as string
      const mandateNo = decryptedData.MerOrderNo as string
      const periodNo = decryptedData.PeriodNo as string

      const { data: mandateData, error: findError } = await this.supabase
        .from('recurring_mandates')
        .select<'*', Database['public']['Tables']['recurring_mandates']['Row']>('*')
        .eq('mandate_no', mandateNo)
        .single()

      if (findError || !mandateData) {
        console.error('[PaymentService] 找不到定期定額委託:', mandateNo)
        return { success: false, error: '找不到定期定額委託' }
      }

      if (status === 'SUCCESS') {
        const { error: updateError } = await this.supabase
          .from('recurring_mandates')
          .update({
            status: 'active',
            newebpay_period_no: periodNo,
            newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
            activated_at: new Date().toISOString(),
            next_payment_date: this.calculateNextPaymentDate(
              mandateData.period_type,
              mandateData.period_point || undefined
            ),
          })
          .eq('id', mandateData.id)

        if (updateError) {
          console.error('[PaymentService] 更新定期定額委託失敗:', updateError)
          return { success: false, error: '更新定期定額委託失敗' }
        }

        if (mandateData.first_payment_order_id) {
          await this.supabase
            .from('payment_orders')
            .update({
              status: 'success',
              newebpay_status: status,
              newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
              paid_at: new Date().toISOString(),
            })
            .eq('id', mandateData.first_payment_order_id)
        }

        const { data: planData } = await this.supabase
          .from('subscription_plans')
          .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
          .eq('id', mandateData.plan_id)
          .single()

        if (planData) {
          const now = new Date()
          const periodStart = now.toISOString()
          const periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

          await this.supabase.from('company_subscriptions').upsert({
            company_id: mandateData.company_id,
            plan_id: mandateData.plan_id,
            status: 'active',
            purchased_token_balance: 0,
            monthly_quota_balance: planData.base_tokens,
            monthly_token_quota: planData.base_tokens,
            is_lifetime: false,
            lifetime_discount: 1.0,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          })

          await this.supabase.from('token_balance_changes').insert({
            company_id: mandateData.company_id,
            change_type: 'quota_renewal',
            amount: planData.base_tokens,
            balance_before: 0,
            balance_after: planData.base_tokens,
            description: `訂閱 ${planData.name} 方案`,
          })
        }

        return { success: true }
      } else {
        await this.supabase
          .from('recurring_mandates')
          .update({
            status: 'failed',
            newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
          })
          .eq('id', mandateData.id)

        return { success: false, error: decryptedData.Message as string }
      }
    } catch (error) {
      console.error('[PaymentService] 處理定期定額回調失敗:', error)
      return { success: false, error: '處理定期定額回調失敗' }
    }
  }

  private calculateNextPaymentDate(
    periodType: 'D' | 'W' | 'M' | 'Y',
    periodPoint?: string
  ): string {
    const now = new Date()

    switch (periodType) {
      case 'M':
        const day = periodPoint ? parseInt(periodPoint) : now.getDate()
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, day)
        return nextMonth.toISOString().split('T')[0]

      case 'Y':
        const [month, dayOfMonth] = periodPoint ? periodPoint.split(',').map(Number) : [now.getMonth() + 1, now.getDate()]
        const nextYear = new Date(now.getFullYear() + 1, month - 1, dayOfMonth)
        return nextYear.toISOString().split('T')[0]

      case 'W':
        const weekday = periodPoint ? parseInt(periodPoint) : now.getDay()
        const daysUntilNext = (weekday + 7 - now.getDay()) % 7 || 7
        const nextWeek = new Date(now)
        nextWeek.setDate(now.getDate() + daysUntilNext)
        return nextWeek.toISOString().split('T')[0]

      case 'D':
        const nextDay = new Date(now)
        nextDay.setDate(now.getDate() + 1)
        return nextDay.toISOString().split('T')[0]

      default:
        return now.toISOString().split('T')[0]
    }
  }

  static createInstance(supabase: ReturnType<typeof createClient<Database>>): PaymentService {
    const newebpay = NewebPayService.createInstance()
    return new PaymentService(supabase, newebpay)
  }
}
