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

  private mapPlanSlugToTier(slug: string): 'free' | 'basic' | 'pro' | 'enterprise' {
    const mapping: Record<string, 'free' | 'basic' | 'pro' | 'enterprise'> = {
      'free': 'free',
      'starter': 'basic',
      'professional': 'pro',
      'business': 'enterprise',
      'agency': 'enterprise',
    }
    return mapping[slug] || 'free'
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
      returnUrl: `${baseUrl}/api/payment/callback`,
      notifyUrl: `${baseUrl}/api/payment/notify`,
      clientBackUrl: `${baseUrl}/dashboard/subscription`,
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
    console.log('[PaymentService] 建立定期定額委託 - 收到參數:', {
      companyId: params.companyId,
      planId: params.planId,
      amount: params.amount,
      periodType: params.periodType,
      periodPoint: params.periodPoint,
      periodStartType: params.periodStartType
    })

    const mandateNo = this.generateMandateNo()
    console.log('[PaymentService] 生成委託編號:', mandateNo)

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
      console.error('[PaymentService] 建立定期定額委託失敗:', {
        mandateNo,
        error: mandateError,
        errorMessage: mandateError?.message,
        errorDetails: mandateError?.details
      })
      return { success: false, error: '建立定期定額委託失敗' }
    }

    console.log('[PaymentService] 委託寫入資料庫成功:', {
      mandateId: mandateData.id,
      mandateNo: mandateData.mandate_no
    })

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

    const paymentParams: RecurringPaymentParams = {
      orderNo: mandateNo,
      amount: params.amount,
      description: params.description,
      email: params.email,
      periodType: params.periodType,
      periodPoint: params.periodPoint,
      periodStartType: params.periodStartType,
      periodTimes: params.periodTimes,
      returnUrl: `${baseUrl}/api/payment/recurring/callback`,
      notifyUrl: `${baseUrl}/api/payment/recurring/notify`,
      clientBackUrl: `${baseUrl}/dashboard/subscription`,
    }

    const paymentForm = this.newebpay.createRecurringPayment(paymentParams)

    console.log('[PaymentService] 定期定額委託建立完成:', {
      success: true,
      mandateId: mandateData.id,
      mandateNo: mandateData.mandate_no,
      orderNo: orderData.order_no,
      orderId: orderData.id
    })

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

      // 記錄完整的解密資料結構
      console.log('[PaymentService] 解密後的完整資料:', JSON.stringify(decryptedData, null, 2))
      console.log('[PaymentService] 解密資料的 keys:', Object.keys(decryptedData))

      // 藍新金流單次購買可能回傳兩種格式：
      // 1. JSON 格式（有 Result 物件）: {Status, Message, Result: {MerchantOrderNo, TradeNo, Amt, ...}}
      // 2. URLSearchParams 格式（扁平）: {Status, Message, MerchantOrderNo, TradeNo, Amt, ...}
      let status: string
      let message: string
      let orderNo: string
      let tradeNo: string
      let amount: number

      if (decryptedData.Result && typeof decryptedData.Result === 'object') {
        // JSON 格式：資料在 Result 物件裡
        console.log('[PaymentService] 使用 JSON 格式（有 Result 物件）')
        const result = decryptedData.Result as Record<string, any>
        status = decryptedData.Status as string
        message = decryptedData.Message as string
        orderNo = result.MerchantOrderNo as string
        tradeNo = result.TradeNo as string
        amount = result.Amt as number
      } else {
        // URLSearchParams 格式：資料在最外層
        console.log('[PaymentService] 使用扁平格式（無 Result 物件）')
        status = decryptedData.Status as string
        message = decryptedData.Message as string
        orderNo = decryptedData.MerchantOrderNo as string
        tradeNo = decryptedData.TradeNo as string
        amount = decryptedData.Amt as number
      }

      console.log('[PaymentService] 處理付款通知:', {
        orderNo,
        status,
        tradeNo,
        amount,
        hasOrderNo: !!orderNo,
        hasStatus: !!status
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
          const { data: packageData, error: packageError } = await this.supabase
            .from('token_packages')
            .select<'*', Database['public']['Tables']['token_packages']['Row']>('*')
            .eq('id', orderData.related_id)
            .single()

          if (packageError || !packageData) {
            console.error('[PaymentService] Token 包不存在:', packageError)
            return { success: false, error: 'Token 包不存在' }
          }

          console.log('[PaymentService] Token 包資料:', {
            packageId: packageData.id,
            packageName: packageData.name,
            tokens: packageData.tokens
          })

          console.log('[PaymentService] 準備查詢公司, company_id:', orderData.company_id)

          // 加入重試機制查詢公司
          let company: { seo_token_balance: number } | null = null
          let companyError: unknown = null

          for (let attempt = 1; attempt <= 10; attempt++) {
            console.log(`[PaymentService] 查詢公司嘗試 ${attempt}/10, company_id: ${orderData.company_id}`)

            const { data, error } = await this.supabase
              .from('companies')
              .select<'seo_token_balance', { seo_token_balance: number }>('seo_token_balance')
              .eq('id', orderData.company_id)
              .maybeSingle()

            console.log(`[PaymentService] 查詢結果 (嘗試 ${attempt}/10):`, {
              hasData: !!data,
              error: error?.message || null,
              errorCode: error?.code || null
            })

            if (data && !error) {
              company = data
              companyError = null
              console.log(`[PaymentService] 找到公司 (嘗試 ${attempt}/10), seo_token_balance:`, data.seo_token_balance)
              break
            }

            companyError = error
            console.log(`[PaymentService] 查詢公司失敗 (嘗試 ${attempt}/10):`, {
              company_id: orderData.company_id,
              error
            })

            if (attempt < 10) {
              const delay = Math.min(1000 * attempt, 3000)
              console.log(`[PaymentService] 等待 ${delay}ms 後重試`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }

          if (companyError || !company) {
            console.error('[PaymentService] 重試 10 次後仍查詢公司失敗:', {
              company_id: orderData.company_id,
              error: companyError
            })

            // 列出最近的公司記錄以供診斷
            const { data: recentCompanies } = await this.supabase
              .from('companies')
              .select('id, name, created_at')
              .order('created_at', { ascending: false })
              .limit(5)

            console.error('[PaymentService] 最近 5 筆公司記錄:', recentCompanies)

            return { success: false, error: '查詢公司失敗' }
          }

          const newBalance = company.seo_token_balance + packageData.tokens

          const { error: updateError } = await this.supabase
            .from('companies')
            .update({ seo_token_balance: newBalance })
            .eq('id', orderData.company_id)

          if (updateError) {
            console.error('[PaymentService] 更新 Token 餘額失敗:', updateError)
            return { success: false, error: '更新 Token 餘額失敗' }
          }

          console.log('[PaymentService] Token 包處理成功:', {
            packageName: packageData.name,
            tokens: packageData.tokens,
            balanceBefore: company.seo_token_balance,
            balanceAfter: newBalance
          })
        } else if (orderData.payment_type === 'lifetime' && orderData.related_id) {
          const { data: planData, error: planError } = await this.supabase
            .from('subscription_plans')
            .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
            .eq('id', orderData.related_id)
            .single()

          if (planError || !planData) {
            console.error('[PaymentService] 終身方案不存在:', planError)
            return { success: false, error: '終身方案不存在' }
          }

          const tier = this.mapPlanSlugToTier(planData.slug)

          const { error: updateError } = await this.supabase
            .from('companies')
            .update({
              subscription_tier: tier,
              subscription_ends_at: null,
            })
            .eq('id', orderData.company_id)

          if (updateError) {
            console.error('[PaymentService] 更新終身訂閱失敗:', updateError)
            return { success: false, error: '更新終身訂閱失敗' }
          }

          console.log('[PaymentService] 終身方案處理成功:', {
            planName: planData.name,
            planSlug: planData.slug,
            tier,
            companyId: orderData.company_id
          })
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
    warnings?: string[]
  }> {
    try {
      const decryptedData = this.newebpay.decryptPeriodCallback(period)

      console.log('[PaymentService] NotifyURL 解密資料:', JSON.stringify(decryptedData, null, 2))

      // Period 回調的結構: { Status, Message, Result: { MerchantOrderNo, PeriodNo, ... } }
      const status = decryptedData.Status as string
      const result = (decryptedData as any).Result

      if (!result || !result.MerchantOrderNo) {
        console.error('[PaymentService] 解密資料結構錯誤，缺少 Result.MerchantOrderNo')
        return { success: false, error: '解密資料結構錯誤' }
      }

      const mandateNo = result.MerchantOrderNo as string
      const periodNo = result.PeriodNo as string

      console.log('[PaymentService] NotifyURL 提取資訊:', { status, mandateNo, periodNo })
      console.log('[PaymentService] 準備查詢委託 mandate_no:', mandateNo)

      let mandateData: Database['public']['Tables']['recurring_mandates']['Row'] | null = null
      let lastError: unknown = null

      for (let attempt = 1; attempt <= 10; attempt++) {
        console.log(`[PaymentService] 查詢委託嘗試 ${attempt}/10`)

        const { data, error } = await this.supabase
          .from('recurring_mandates')
          .select<'*', Database['public']['Tables']['recurring_mandates']['Row']>('*')
          .eq('mandate_no', mandateNo)
          .maybeSingle()

        console.log(`[PaymentService] 查詢結果 (嘗試 ${attempt}/10):`, {
          mandateNo,
          hasData: !!data,
          error: error?.message || null,
          errorCode: error?.code || null
        })

        if (data && !error) {
          mandateData = data
          lastError = null
          console.log(`[PaymentService] 找到委託 (嘗試 ${attempt}/10):`, {
            mandateId: data.id,
            mandateNo: data.mandate_no,
            currentStatus: data.status
          })
          break
        }

        lastError = error
        console.log(`[PaymentService] 查詢失敗 (嘗試 ${attempt}/10):`, { mandateNo, error })

        if (attempt < 10) {
          const delay = Math.min(1000 * attempt, 3000)
          console.log(`[PaymentService] 等待 ${delay}ms 後重試`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!mandateData) {
        console.error('[PaymentService] 重試 10 次後仍找不到定期定額委託')
        console.error('[PaymentService] mandate_no:', mandateNo)
        console.error('[PaymentService] 最後錯誤:', lastError)
        console.error('[PaymentService] 完整解密資料:', JSON.stringify(decryptedData, null, 2))

        const { data: allMandates } = await this.supabase
          .from('recurring_mandates')
          .select('mandate_no, id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(10)

        console.error('[PaymentService] 最近 10 筆 mandates:', allMandates)

        return { success: false, error: '找不到定期定額委託' }
      }

      if (status === 'SUCCESS') {
        const isFirstAuthorization = mandateData.status === 'pending'
        const isRecurringBilling = mandateData.status === 'active'

        console.log('[PaymentService] 開始處理授權成功邏輯:', {
          isFirstAuthorization,
          isRecurringBilling,
          currentStatus: mandateData.status,
        })

        let authorizationSuccess = false
        const businessLogicErrors: string[] = []

        const mandateUpdate: Database['public']['Tables']['recurring_mandates']['Update'] = {
          newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
          next_payment_date: this.calculateNextPaymentDate(
            mandateData.period_type,
            mandateData.period_point || undefined
          ),
        }

        if (isFirstAuthorization) {
          mandateUpdate.status = 'active'
          mandateUpdate.newebpay_period_no = periodNo
          mandateUpdate.activated_at = new Date().toISOString()
          mandateUpdate.periods_paid = 1
        } else if (isRecurringBilling) {
          mandateUpdate.periods_paid = (mandateData.periods_paid || 0) + 1
        }

        const { error: updateError } = await this.supabase
          .from('recurring_mandates')
          .update(mandateUpdate)
          .eq('id', mandateData.id)

        if (updateError) {
          console.error('[PaymentService] ❌ 更新定期定額委託失敗:', updateError)
          businessLogicErrors.push('更新委託狀態失敗')
        } else {
          console.log('[PaymentService] ✅ 委託狀態已更新為 active')
          authorizationSuccess = true
        }

        if (mandateData.first_payment_order_id) {
          const { error: orderUpdateError } = await this.supabase
            .from('payment_orders')
            .update({
              status: 'success',
              newebpay_status: status,
              newebpay_response: decryptedData as unknown as Database['public']['Tables']['payment_orders']['Update']['newebpay_response'],
              paid_at: new Date().toISOString(),
            })
            .eq('id', mandateData.first_payment_order_id)

          if (orderUpdateError) {
            console.error('[PaymentService] ❌ 更新訂單狀態失敗:', orderUpdateError)
            businessLogicErrors.push('更新訂單狀態失敗')
          } else {
            console.log('[PaymentService] ✅ 訂單狀態已更新為 success')
          }
        }

        const { data: planData, error: planError } = await this.supabase
          .from('subscription_plans')
          .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
          .eq('id', mandateData.plan_id)
          .single()

        if (planError || !planData) {
          console.error('[PaymentService] ❌ 查詢方案失敗:', planError)
          businessLogicErrors.push('查詢方案失敗')
        } else {
          const now = new Date()
          const periodStart = now.toISOString()
          const periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

          // 查詢舊的訂閱記錄，保留 purchased_token_balance
          const { data: oldSubscription } = await this.supabase
            .from('company_subscriptions')
            .select('purchased_token_balance')
            .eq('company_id', mandateData.company_id)
            .eq('status', 'active')
            .single()

          const preservedPurchasedBalance = oldSubscription?.purchased_token_balance || 0

          // 刪除該公司的所有舊訂閱記錄
          await this.supabase
            .from('company_subscriptions')
            .delete()
            .eq('company_id', mandateData.company_id)

          // 創建新的訂閱記錄，保留購買的 Token
          const { error: subscriptionError } = await this.supabase.from('company_subscriptions').insert({
            company_id: mandateData.company_id,
            plan_id: mandateData.plan_id,
            status: 'active',
            purchased_token_balance: preservedPurchasedBalance,
            monthly_quota_balance: planData.base_tokens,
            monthly_token_quota: planData.base_tokens,
            is_lifetime: false,
            lifetime_discount: 1.0,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          })

          if (subscriptionError) {
            console.error('[PaymentService] ❌ 創建訂閱失敗:', subscriptionError)
            businessLogicErrors.push('創建訂閱失敗')
          } else {
            console.log('[PaymentService] ✅ 訂閱已創建')
          }

          // 更新公司的訂閱層級和到期時間
          const subscriptionTier = this.mapPlanSlugToTier(planData.slug)
          const subscriptionEndsAt = mandateData.period_type === 'M'
            ? this.calculateNextPaymentDate(mandateData.period_type, mandateData.period_point || undefined)
            : mandateData.period_type === 'Y'
            ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
            : periodEnd

          const { error: companyUpdateError } = await this.supabase
            .from('companies')
            .update({
              subscription_tier: subscriptionTier,
              subscription_ends_at: subscriptionEndsAt,
              updated_at: now.toISOString(),
            })
            .eq('id', mandateData.company_id)

          if (companyUpdateError) {
            console.error('[PaymentService] ❌ 更新公司訂閱資料失敗:', companyUpdateError)
            businessLogicErrors.push('更新公司訂閱資料失敗')
          } else {
            console.log('[PaymentService] ✅ 公司訂閱資料已更新:', {
              subscription_tier: subscriptionTier,
              subscription_ends_at: subscriptionEndsAt,
            })
          }

          // 記錄月配額的獲得（首次訂閱或續約）
          const description = isFirstAuthorization
            ? `訂閱 ${planData.name} 方案（首次授權）- 月配額 ${planData.base_tokens?.toLocaleString()} Tokens`
            : `定期定額扣款 - ${planData.name} 方案（第 ${mandateUpdate.periods_paid} 期）- 月配額 ${planData.base_tokens?.toLocaleString()} Tokens`

          // 計算總餘額（月配額 + 購買配額）
          const totalBalance = planData.base_tokens + preservedPurchasedBalance

          const { error: tokenError } = await this.supabase.from('token_balance_changes').insert({
            company_id: mandateData.company_id,
            change_type: isFirstAuthorization ? 'subscription' : 'quota_renewal',
            amount: planData.base_tokens,
            balance_before: preservedPurchasedBalance,
            balance_after: totalBalance,
            description,
          })

          if (tokenError) {
            console.error('[PaymentService] ❌ 添加代幣記錄失敗:', tokenError)
            businessLogicErrors.push('添加代幣記錄失敗')
          } else {
            console.log('[PaymentService] ✅ 代幣記錄已添加')
          }
        }

        if (businessLogicErrors.length > 0) {
          console.warn('[PaymentService] ⚠️ 授權成功但部分業務邏輯失敗:', businessLogicErrors)
          if (!authorizationSuccess) {
            return { success: false, error: '授權處理失敗: ' + businessLogicErrors.join(', ') }
          }
        }

        console.log('[PaymentService] ✅ 授權成功處理完成')
        return { success: true, warnings: businessLogicErrors.length > 0 ? businessLogicErrors : undefined }
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
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, day, 0, 0, 0, 0)
        return nextMonth.toISOString()

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
