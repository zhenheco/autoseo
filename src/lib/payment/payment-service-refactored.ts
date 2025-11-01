/**
 * 重構後的支付服務
 * 使用策略模式處理不同類型的支付
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { NewebPayService, type OnetimePaymentParams, type RecurringPaymentParams } from './newebpay-service'
import { PaymentStrategyFactory } from './strategies/payment-strategy-factory'
import { PaymentContext, PaymentData, PaymentResult } from './strategies/payment-strategy.interface'
import { BUSINESS_RULES } from '@/lib/config/business-rules'

export interface CreateOnetimeOrderParams {
  companyId: string
  paymentType: 'subscription' | 'token_package' | 'lifetime'
  relatedId: string
  amount: number
  description: string
  email: string
  referralCode?: string
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

export class PaymentServiceRefactored {
  private supabase: ReturnType<typeof createClient<Database>>
  private newebpay: NewebPayService
  private strategyFactory: PaymentStrategyFactory

  constructor(
    supabase: ReturnType<typeof createClient<Database>>,
    newebpay: NewebPayService
  ) {
    this.supabase = supabase
    this.newebpay = newebpay
    this.strategyFactory = new PaymentStrategyFactory(supabase)
  }

  /**
   * 生成訂單編號
   */
  private generateOrderNo(): string {
    const { orderNumberPrefix, orderNumberLength } = BUSINESS_RULES.payment
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const orderNo = `${orderNumberPrefix}${timestamp}${random}`
    return orderNo.substring(0, orderNumberLength)
  }

  /**
   * 生成授權編號
   */
  private generateMandateNo(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `MAN${timestamp}${random}`
  }

  /**
   * 創建一次性支付
   */
  async createOnetimePayment(params: CreateOnetimeOrderParams): Promise<{
    success: boolean
    data?: { formHtml: string; orderNo: string }
    error?: string
  }> {
    try {
      // 生成訂單編號
      const orderNo = this.generateOrderNo()

      // 記錄訂單到資料庫
      const { error: dbError } = await this.supabase
        .from('payment_orders')
        .insert({
          order_no: orderNo,
          company_id: params.companyId,
          payment_type: params.paymentType,
          related_id: params.relatedId,
          amount: params.amount,
          status: 'pending',
          description: params.description,
          email: params.email,
          referral_code: params.referralCode,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('Failed to create payment order:', dbError)
        return {
          success: false,
          error: dbError.message
        }
      }

      // 準備支付參數
      const paymentParams: OnetimePaymentParams = {
        MerchantOrderNo: orderNo,
        Amt: params.amount,
        ItemDesc: params.description,
        Email: params.email
      }

      // 生成支付表單
      const formHtml = this.newebpay.generateOnetimePaymentForm(paymentParams)

      return {
        success: true,
        data: { formHtml, orderNo }
      }
    } catch (error) {
      console.error('Create payment error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 處理一次性支付回調（使用策略模式）
   */
  async handleOnetimeCallback(encryptedData: string): Promise<PaymentResult> {
    try {
      // 解密數據
      const decryptedData = this.newebpay.decryptOnetimeCallback(encryptedData)
      const paymentData = decryptedData.Result as PaymentData

      // 獲取訂單信息
      const { data: order } = await this.supabase
        .from('payment_orders')
        .select('*')
        .eq('order_no', paymentData.MerchantOrderNo)
        .single()

      if (!order) {
        return {
          success: false,
          error: 'Order not found'
        }
      }

      // 確定產品類型
      let productType = order.payment_type as PaymentData['productType']

      // 如果訂單中沒有產品類型，嘗試推斷
      if (!productType) {
        productType = this.strategyFactory.inferProductType(paymentData) || 'token_package'
      }

      // 補充支付數據
      paymentData.productType = productType
      paymentData.userId = order.company_id
      paymentData.referralCode = order.referral_code

      // 根據產品類型添加額外信息
      if (productType === 'subscription') {
        paymentData.subscriptionPlan = this.inferSubscriptionPlan(paymentData.Amt)
      } else if (productType === 'token_package') {
        paymentData.tokenAmount = this.calculateTokenAmount(paymentData.Amt)
      }

      // 獲取對應的策略
      const strategy = this.strategyFactory.getStrategy(productType)
      if (!strategy) {
        return {
          success: false,
          error: `No payment strategy found for product type: ${productType}`
        }
      }

      // 創建上下文
      const context: PaymentContext = {
        supabase: this.supabase,
        paymentData,
        userId: order.company_id
      }

      // 驗證支付
      const isValid = await strategy.validate(context)
      if (!isValid) {
        return {
          success: false,
          error: 'Payment validation failed'
        }
      }

      // 處理支付
      const result = await strategy.process(context)

      // 後處理
      await strategy.postProcess(context, result)

      // 更新訂單狀態
      await this.updateOrderStatus(
        paymentData.MerchantOrderNo,
        result.success ? 'completed' : 'failed'
      )

      return result
    } catch (error) {
      console.error('Handle callback error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 創建定期扣款
   */
  async createRecurringPayment(params: CreateRecurringOrderParams): Promise<{
    success: boolean
    data?: { formHtml: string; orderNo: string }
    error?: string
  }> {
    try {
      const orderNo = this.generateOrderNo()
      const mandateNo = this.generateMandateNo()

      // 記錄訂單
      const { error: dbError } = await this.supabase
        .from('recurring_orders')
        .insert({
          order_no: orderNo,
          company_id: params.companyId,
          plan_id: params.planId,
          amount: params.amount,
          period_type: params.periodType,
          period_point: params.periodPoint,
          period_start_type: params.periodStartType,
          period_times: params.periodTimes,
          status: 'pending',
          description: params.description,
          email: params.email,
          created_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('Failed to create recurring order:', dbError)
        return {
          success: false,
          error: dbError.message
        }
      }

      // 準備支付參數
      const paymentParams: RecurringPaymentParams = {
        MerNo: mandateNo,
        MerMemberID: params.companyId,
        MerchantOrderNo: orderNo,
        PeriodAmt: params.amount,
        ProdDesc: params.description,
        PayerEmail: params.email,
        PeriodType: params.periodType,
        PeriodPoint: params.periodPoint || '',
        PeriodStartType: params.periodStartType,
        PeriodTimes: params.periodTimes?.toString() || ''
      }

      // 生成支付表單
      const formHtml = this.newebpay.generateRecurringPaymentForm(paymentParams)

      return {
        success: true,
        data: { formHtml, orderNo }
      }
    } catch (error) {
      console.error('Create recurring payment error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 處理定期扣款回調
   */
  async handleRecurringCallback(encryptedData: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const decryptedData = this.newebpay.decryptRecurringCallback(encryptedData)

      // 處理定期扣款邏輯
      // 這部分可以根據需要擴展

      return {
        success: true,
        data: decryptedData
      }
    } catch (error) {
      console.error('Handle recurring callback error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 推斷訂閱計畫
   */
  private inferSubscriptionPlan(amount: number): string {
    if (amount === 1999) return 'monthly'
    if (amount === 9999) return 'annual'
    return 'custom'
  }

  /**
   * 計算 Token 數量
   */
  private calculateTokenAmount(amount: number): number {
    // 簡單的計算規則，可以根據業務需求調整
    return amount * 100
  }

  /**
   * 更新訂單狀態
   */
  private async updateOrderStatus(
    orderNo: string,
    status: 'pending' | 'completed' | 'failed'
  ): Promise<void> {
    await this.supabase
      .from('payment_orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('order_no', orderNo)
  }
}