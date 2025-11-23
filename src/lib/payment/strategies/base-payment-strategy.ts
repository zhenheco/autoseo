/**
 * 支付策略基礎類別
 */

import { PaymentStrategy, PaymentContext, PaymentResult } from './payment-strategy.interface'
import { Database } from '@/types/database.types'
import { BUSINESS_RULES } from '@/lib/config/business-rules'

export abstract class BasePaymentStrategy implements PaymentStrategy {
  /**
   * 基礎驗證邏輯
   */
  async validate(context: PaymentContext): Promise<boolean> {
    const { paymentData, userId } = context

    // 驗證必要欄位
    if (!paymentData.MerchantOrderNo || !paymentData.Status || !paymentData.RespondCode) {
      console.error('Missing required payment fields')
      return false
    }

    // 驗證支付狀態
    if (paymentData.Status !== 'SUCCESS' || paymentData.RespondCode !== 'SUCCESS') {
      console.error('Payment not successful:', {
        status: paymentData.Status,
        code: paymentData.RespondCode
      })
      return false
    }

    // 驗證用戶
    if (!userId) {
      console.error('User ID not found')
      return false
    }

    // 驗證金額
    if (paymentData.Amt <= 0) {
      console.error('Invalid payment amount:', paymentData.Amt)
      return false
    }

    return this.validateSpecific(context)
  }

  /**
   * 子類別特定的驗證邏輯
   */
  protected abstract validateSpecific(context: PaymentContext): Promise<boolean>

  /**
   * 抽象處理方法
   */
  abstract process(context: PaymentContext): Promise<PaymentResult>

  /**
   * 基礎後處理邏輯
   */
  async postProcess(context: PaymentContext, result: PaymentResult): Promise<void> {
    if (!result.success) {
      await this.logError(context, result.error || 'Unknown error')
      return
    }

    await this.logSuccess(context, result)
    await this.postProcessSpecific(context, result)
  }

  /**
   * 子類別特定的後處理邏輯
   */
  protected abstract postProcessSpecific(
    context: PaymentContext,
    result: PaymentResult
  ): Promise<void>

  /**
   * 創建交易記錄
   */
  protected async createTransaction(
    context: PaymentContext,
    status: 'pending' | 'completed' | 'failed' = 'completed'
  ): Promise<Database['public']['Tables']['payment_orders']['Row'] | null> {
    const { supabase, paymentData, userId } = context

    const { data, error } = await supabase
      .from('payment_orders')
      .insert({
        order_no: paymentData.MerchantOrderNo,
        user_id: userId,
        amount: paymentData.Amt,
        status,
        payment_method: 'newebpay',
        description: paymentData.ItemDesc,
        raw_data: paymentData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create transaction:', error)
      return null
    }

    return data
  }

  /**
   * 更新交易狀態
   */
  protected async updateTransaction(
    context: PaymentContext,
    transactionId: string,
    status: 'pending' | 'completed' | 'failed',
    additionalData?: any
  ): Promise<boolean> {
    const { supabase } = context

    const updateData: any = { status }
    if (additionalData) {
      updateData.raw_data = { ...context.paymentData, ...additionalData }
    }

    const { error } = await supabase
      .from('payment_transactions')
      .update(updateData)
      .eq('id', transactionId)

    if (error) {
      console.error('Failed to update transaction:', error)
      return false
    }

    return true
  }

  /**
   * 記錄成功日誌
   */
  private async logSuccess(context: PaymentContext, result: PaymentResult): Promise<void> {
    console.log('Payment processed successfully:', {
      orderId: result.orderId,
      userId: context.userId,
      amount: context.paymentData.Amt
    })
  }

  /**
   * 記錄錯誤日誌
   */
  private async logError(context: PaymentContext, error: string): Promise<void> {
    console.error('Payment processing failed:', {
      error,
      orderId: context.paymentData.MerchantOrderNo,
      userId: context.userId
    })
  }

  /**
   * 檢查交易是否已處理
   */
  protected async isTransactionProcessed(
    context: PaymentContext
  ): Promise<boolean> {
    const { supabase, paymentData } = context

    const { data } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('order_no', paymentData.MerchantOrderNo)
      .single()

    return data?.status === 'completed'
  }

  /**
   * 獲取業務規則配置
   */
  protected getBusinessRules() {
    return BUSINESS_RULES
  }
}