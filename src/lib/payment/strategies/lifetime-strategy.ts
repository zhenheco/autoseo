/**
 * 終身方案支付策略
 */

import { BasePaymentStrategy } from './base-payment-strategy'
import { PaymentContext, PaymentResult } from './payment-strategy.interface'
import { SubscriptionActivationService } from '../services/subscription-activation-service'

export class LifetimeStrategy extends BasePaymentStrategy {
  private activationService: SubscriptionActivationService

  constructor(supabase: any) {
    super()
    this.activationService = new SubscriptionActivationService(supabase)
  }

  /**
   * 驗證終身方案支付
   */
  protected async validateSpecific(context: PaymentContext): Promise<boolean> {
    const { paymentData } = context

    // 驗證是否為終身方案類型
    if (paymentData.productType !== 'lifetime') {
      return false
    }

    // 驗證金額
    const expectedAmount = this.getLifetimePrice(paymentData.referralCode)
    if (Math.abs(paymentData.Amt - expectedAmount) > 0.01) {
      console.error('Amount mismatch for lifetime plan:', {
        expected: expectedAmount,
        actual: paymentData.Amt
      })
      return false
    }

    return true
  }

  /**
   * 處理終身方案支付
   */
  async process(context: PaymentContext): Promise<PaymentResult> {
    const { paymentData, userId } = context

    try {
      // 檢查是否已處理
      if (await this.isTransactionProcessed(context)) {
        return {
          success: false,
          error: 'Transaction already processed'
        }
      }

      // 檢查是否已有終身方案
      if (await this.hasLifetimeSubscription(context)) {
        return {
          success: false,
          error: 'User already has lifetime subscription'
        }
      }

      // 創建交易記錄
      const transaction = await this.createTransaction(context)
      if (!transaction) {
        return {
          success: false,
          error: 'Failed to create transaction'
        }
      }

      // 啟用終身訂閱
      const result = await this.activationService.activateSubscription({
        userId,
        plan: 'lifetime',
        amount: paymentData.Amt,
        referralCode: paymentData.referralCode,
        transactionId: transaction.id
      })

      if (!result.success) {
        await this.updateTransaction(context, transaction.id, 'failed')
        return {
          success: false,
          error: result.error
        }
      }

      // 更新交易狀態
      await this.updateTransaction(context, transaction.id, 'completed')

      // 授予終身會員特權
      await this.grantLifetimePrivileges(context)

      return {
        success: true,
        orderId: paymentData.MerchantOrderNo,
        subscription: result.subscription,
        tokenUsage: result.tokenUsage,
        transaction
      }
    } catch (error) {
      console.error('Lifetime payment failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 終身方案後處理
   */
  protected async postProcessSpecific(
    context: PaymentContext,
    result: PaymentResult
  ): Promise<void> {
    if (!result.success || !result.subscription) {
      return
    }

    // 發送終身會員歡迎郵件
    await this.sendLifetimeMemberEmail(context)

    // 授予成就徽章
    await this.grantAchievementBadge(context)

    // 記錄分析事件
    await this.trackLifetimePurchase(context)
  }

  /**
   * 獲取終身方案價格
   */
  private getLifetimePrice(referralCode?: string): number {
    const basePrice = 9999
    const rules = this.getBusinessRules()

    // 如果有推薦碼，應用折扣
    if (referralCode) {
      return Math.floor(basePrice * rules.subscription.lifetimeDiscountRate)
    }

    return basePrice
  }

  /**
   * 檢查是否已有終身訂閱
   */
  private async hasLifetimeSubscription(context: PaymentContext): Promise<boolean> {
    const { supabase, userId } = context

    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('plan', 'lifetime')
      .eq('status', 'active')
      .single()

    return !!data
  }

  /**
   * 授予終身會員特權
   */
  private async grantLifetimePrivileges(context: PaymentContext): Promise<void> {
    const { supabase, userId } = context

    try {
      // 更新用戶角色
      await supabase
        .from('users')
        .update({
          role: 'lifetime_member',
          features: {
            unlimited_tokens: true,
            priority_support: true,
            early_access: true,
            custom_branding: true
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      // 添加終身會員標記
      await supabase.from('user_badges').insert({
        user_id: userId,
        badge_type: 'lifetime_member',
        granted_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to grant lifetime privileges:', error)
    }
  }

  /**
   * 發送終身會員郵件
   */
  private async sendLifetimeMemberEmail(context: PaymentContext): Promise<void> {
    try {
      console.log('Sending lifetime member welcome email:', {
        email: context.paymentData.Email
      })
      // 實際的郵件發送邏輯
    } catch (error) {
      console.error('Failed to send lifetime member email:', error)
    }
  }

  /**
   * 授予成就徽章
   */
  private async grantAchievementBadge(context: PaymentContext): Promise<void> {
    const { supabase, userId } = context

    try {
      await supabase.from('achievements').insert({
        user_id: userId,
        achievement_type: 'lifetime_supporter',
        unlocked_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to grant achievement badge:', error)
    }
  }

  /**
   * 追蹤終身方案購買
   */
  private async trackLifetimePurchase(context: PaymentContext): Promise<void> {
    try {
      console.log('Tracking lifetime purchase:', {
        userId: context.userId,
        amount: context.paymentData.Amt,
        referral: !!context.paymentData.referralCode
      })
      // 實際的分析追蹤邏輯
    } catch (error) {
      console.error('Failed to track lifetime purchase:', error)
    }
  }
}