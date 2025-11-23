/**
 * 訂閱啟用服務
 * 集中處理訂閱啟用邏輯，避免代碼重複
 */

import { Database } from '@/types/database.types'
import { BUSINESS_RULES } from '@/lib/config/business-rules'

export interface SubscriptionActivationParams {
  userId: string
  plan: 'monthly' | 'annual' | 'lifetime'
  amount: number
  referralCode?: string
  transactionId?: string
}

export interface SubscriptionActivationResult {
  success: boolean
  subscription?: Database['public']['Tables']['company_subscriptions']['Row']
  tokenUsage?: Database['public']['Tables']['token_usage_logs']['Row']
  error?: string
}

export class SubscriptionActivationService {
  constructor(private supabase: any) {}

  /**
   * 啟用訂閱
   */
  async activateSubscription(
    params: SubscriptionActivationParams
  ): Promise<SubscriptionActivationResult> {
    const { userId, plan, amount, referralCode, transactionId } = params

    try {
      // 開始資料庫事務
      const result = await this.supabase.rpc('activate_subscription', {
        p_user_id: userId,
        p_plan: plan,
        p_amount: amount,
        p_referral_code: referralCode,
        p_transaction_id: transactionId
      })

      if (result.error) {
        throw result.error
      }

      // 如果沒有使用 RPC，則手動處理
      if (!result.data) {
        return await this.manualActivation(params)
      }

      return {
        success: true,
        subscription: result.data.subscription,
        tokenUsage: result.data.token_usage
      }
    } catch (error) {
      console.error('Subscription activation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 手動啟用訂閱（當 RPC 不可用時）
   */
  private async manualActivation(
    params: SubscriptionActivationParams
  ): Promise<SubscriptionActivationResult> {
    const { userId, plan, amount, referralCode } = params

    // 1. 檢查現有訂閱
    const existingSubscription = await this.checkExistingSubscription(userId)
    if (existingSubscription?.status === 'active') {
      return await this.upgradeSubscription(existingSubscription, plan, amount)
    }

    // 2. 創建新訂閱
    const subscription = await this.createSubscription(userId, plan, amount)
    if (!subscription) {
      return { success: false, error: 'Failed to create subscription' }
    }

    // 3. 更新或創建 token usage
    const tokenUsage = await this.updateTokenUsage(userId, plan)
    if (!tokenUsage) {
      return { success: false, error: 'Failed to update token usage' }
    }

    // 4. 處理推薦碼
    if (referralCode) {
      await this.processReferral(userId, referralCode, amount, plan)
    }

    // 5. 更新用戶狀態
    await this.updateUserStatus(userId, plan)

    return {
      success: true,
      subscription,
      tokenUsage: tokenUsage || undefined
    }
  }

  /**
   * 檢查現有訂閱
   */
  private async checkExistingSubscription(
    userId: string
  ): Promise<Database['public']['Tables']['company_subscriptions']['Row'] | null> {
    const { data } = await this.supabase
      .from('company_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    return data
  }

  /**
   * 創建新訂閱
   */
  private async createSubscription(
    userId: string,
    plan: string,
    amount: number
  ): Promise<Database['public']['Tables']['company_subscriptions']['Row'] | null> {
    const now = new Date()
    const startDate = now.toISOString()
    const endDate = this.calculateEndDate(plan, now)

    const { data, error } = await this.supabase
      .from('company_subscriptions')
      .insert({
        user_id: userId,
        plan,
        status: 'active',
        price: amount,
        start_date: startDate,
        end_date: endDate,
        created_at: startDate,
        updated_at: startDate
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create subscription:', error)
      return null
    }

    return data
  }

  /**
   * 升級訂閱
   */
  private async upgradeSubscription(
    existing: Database['public']['Tables']['company_subscriptions']['Row'],
    newPlan: string,
    amount: number
  ): Promise<SubscriptionActivationResult> {
    const { data, error } = await this.supabase
      .from('company_subscriptions')
      .update({
        plan: newPlan,
        price: amount,
        end_date: this.calculateEndDate(newPlan, new Date()),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: 'Failed to upgrade subscription' }
    }

    // 更新 token usage
    const tokenUsage = await this.updateTokenUsage(existing.company_id, newPlan)

    return {
      success: true,
      subscription: data,
      tokenUsage: tokenUsage || undefined
    }
  }

  /**
   * 更新或創建 Token Usage
   */
  private async updateTokenUsage(
    userId: string,
    plan: string
  ): Promise<Database['public']['Tables']['token_usage_logs']['Row'] | null> {
    const tokenQuota = this.getTokenQuota(plan)

    // 先嘗試更新
    const { data: updateData, error: updateError } = await this.supabase
      .from('token_usage_logs')
      .update({
        total_tokens: tokenQuota,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateData) {
      return updateData
    }

    // 如果更新失敗，創建新記錄
    const { data: insertData, error: insertError } = await this.supabase
      .from('token_usage_logs')
      .insert({
        user_id: userId,
        total_tokens: tokenQuota,
        used_tokens: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create token usage:', insertError)
      return null
    }

    return insertData
  }

  /**
   * 處理推薦
   */
  private async processReferral(
    userId: string,
    referralCode: string,
    amount: number,
    plan: string
  ): Promise<void> {
    // TODO: 推薦系統需要重新設計（目前 public.users 表不存在）
    console.log('推薦系統功能尚未實作')

    // try {
    //   const rules = BUSINESS_RULES.referral
    //
    //   // 查找推薦人
    //   const { data: referrer } = await this.supabase
    //     .from('users')
    //     .select('id')
    //     .eq('referral_code', referralCode)
    //     .single()
    //
    //   if (!referrer) {
    //     return
    //   }
    //
    //   // 記錄推薦關係
    //   await this.supabase.from('referrals').insert({
    //     referrer_id: referrer.id,
    //     referred_id: userId,
    //     status: 'completed',
    //     reward_amount: amount * rules.firstPaymentCommissionRate,
    //     created_at: new Date().toISOString()
    //   })
    //
    //   // 發放推薦獎勵
    //   await this.supabase.rpc('add_referral_reward', {
    //     p_user_id: referrer.id,
    //     p_amount: amount * rules.firstPaymentCommissionRate
    //   })
    // } catch (error) {
    //   console.error('Failed to process referral:', error)
    //   // 推薦處理失敗不應影響主要流程
    // }
  }

  /**
   * 更新用戶狀態
   */
  private async updateUserStatus(userId: string, plan: string): Promise<void> {
    // TODO: 用戶狀態更新功能需要重新設計（目前 public.users 表不存在）
    console.log('用戶狀態更新功能尚未實作')

    // await this.supabase
    //   .from('users')
    //   .update({
    //     subscription_plan: plan,
    //     subscription_status: 'active',
    //     updated_at: new Date().toISOString()
    //   })
    //   .eq('id', userId)
  }

  /**
   * 計算結束日期
   */
  private calculateEndDate(plan: string, startDate: Date): string | null {
    if (plan === 'lifetime') {
      return null
    }

    const endDate = new Date(startDate)

    if (plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1)
    } else if (plan === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1)
    }

    return endDate.toISOString()
  }

  /**
   * 獲取 Token 配額
   */
  private getTokenQuota(plan: string): number {
    const quotaMap: Record<string, number> = {
      monthly: 100000,
      annual: 1500000,
      lifetime: 999999999
    }

    return quotaMap[plan] || BUSINESS_RULES.subscription.defaultTokenQuota
  }
}