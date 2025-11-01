/**
 * 支付策略介面定義
 */

import { Database } from '@/types/database.types'

export type PaymentProduct =
  | 'token_package'
  | 'subscription'
  | 'lifetime'
  | 'custom'

export interface PaymentData {
  MerchantOrderNo: string
  Status: string
  RespondCode: string
  TimeStamp: string
  Amt: number
  ItemDesc: string
  Email: string
  MerchantID: string
  userId?: string
  productType?: PaymentProduct
  subscriptionPlan?: string
  tokenAmount?: number
  referralCode?: string
}

export interface PaymentResult {
  success: boolean
  orderId?: string
  error?: string
  subscription?: Database['public']['Tables']['subscriptions']['Row']
  tokenUsage?: Database['public']['Tables']['token_usage']['Row']
  transaction?: Database['public']['Tables']['payment_transactions']['Row']
}

export interface PaymentContext {
  supabase: any // SupabaseClient type
  paymentData: PaymentData
  userId: string
  existingTransaction?: Database['public']['Tables']['payment_transactions']['Row']
}

/**
 * 支付策略介面
 */
export interface PaymentStrategy {
  /**
   * 驗證支付資料
   */
  validate(context: PaymentContext): Promise<boolean>

  /**
   * 處理支付邏輯
   */
  process(context: PaymentContext): Promise<PaymentResult>

  /**
   * 支付後的處理（發送郵件、通知等）
   */
  postProcess(context: PaymentContext, result: PaymentResult): Promise<void>
}