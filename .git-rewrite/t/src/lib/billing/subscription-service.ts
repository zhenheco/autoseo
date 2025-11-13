import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  monthlyPrice: number
  baseTokens: number
  isLifetime: boolean
  lifetimePrice: number | null
  features: Record<string, unknown>
  limits: Record<string, unknown>
}

export interface TokenSubscriptionPlan {
  id: string
  name: string
  slug: string
  monthlyTokens: number
  monthlyPrice: number
  discountVsOnetime: number
  description: string
}

export interface CompanySubscription {
  id: string
  companyId: string
  planId: string
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  purchasedTokenBalance: number
  monthlyQuotaBalance: number
  monthlyTokenQuota: number
  isLifetime: boolean
  lifetimeDiscount: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  trialEnd: string | null
  cancelledAt: string | null
}

export class SubscriptionService {
  private supabase: ReturnType<typeof createClient<Database>>

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase
  }

  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
      .order('monthly_price', { ascending: true })

    if (error) {
      console.error('[SubscriptionService] 取得方案失敗:', error)
      return []
    }

    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: Number(plan.monthly_price),
      baseTokens: plan.base_tokens,
      isLifetime: plan.is_lifetime || false,
      lifetimePrice: plan.lifetime_price ? Number(plan.lifetime_price) : null,
      features: plan.features as Record<string, unknown>,
      limits: plan.limits as Record<string, unknown>,
    }))
  }

  async getAvailableTokenPlans(): Promise<TokenSubscriptionPlan[]> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
      .eq('is_lifetime', false)
      .order('monthly_price', { ascending: true })

    if (error) {
      console.error('[SubscriptionService] 取得月訂閱 Token 方案失敗:', error)
      return []
    }

    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyTokens: plan.base_tokens,
      monthlyPrice: Number(plan.monthly_price),
      discountVsOnetime: 0,
      description: '',
    }))
  }

  async getCompanySubscription(companyId: string): Promise<CompanySubscription | null> {
    const { data, error } = await this.supabase
      .from('company_subscriptions')
      .select<'*', Database['public']['Tables']['company_subscriptions']['Row']>('*')
      .eq('company_id', companyId)
      .single()

    if (error) {
      console.error('[SubscriptionService] 取得訂閱資訊失敗:', error)
      return null
    }

    if (!data) {
      return null
    }

    return {
      id: data.id,
      companyId: data.company_id,
      planId: data.plan_id,
      status: data.status as 'active' | 'past_due' | 'cancelled' | 'trialing',
      purchasedTokenBalance: data.purchased_token_balance,
      monthlyQuotaBalance: data.monthly_quota_balance,
      monthlyTokenQuota: data.monthly_token_quota,
      isLifetime: data.is_lifetime || false,
      lifetimeDiscount: Number(data.lifetime_discount || 1.0),
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      trialEnd: data.trial_end,
      cancelledAt: data.cancelled_at,
    }
  }

  async createSubscription(
    companyId: string,
    planId: string,
    isLifetime: boolean = false
  ): Promise<{ success: boolean; subscription?: CompanySubscription; error?: string }> {
    const { data: planData, error: planError } = await this.supabase
      .from('subscription_plans')
      .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
      .eq('id', planId)
      .single()

    if (planError || !planData) {
      return { success: false, error: '找不到指定的訂閱方案' }
    }

    const now = new Date()
    const periodStart = now.toISOString()
    const periodEnd = isLifetime
      ? null
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

    const lifetimeDiscount = isLifetime ? 0.8 : 1.0

    const { data: subscriptionData, error: subscriptionError } = await this.supabase
      .from('company_subscriptions')
      .insert({
        company_id: companyId,
        plan_id: planId,
        status: 'active',
        purchased_token_balance: 0,
        monthly_quota_balance: planData.base_tokens,
        monthly_token_quota: planData.base_tokens,
        is_lifetime: isLifetime,
        lifetime_discount: lifetimeDiscount,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      })
      .select<'*', Database['public']['Tables']['company_subscriptions']['Row']>()
      .single()

    if (subscriptionError) {
      console.error('[SubscriptionService] 建立訂閱失敗:', subscriptionError)
      return { success: false, error: '訂閱建立失敗' }
    }

    await this.supabase.from('token_balance_changes').insert({
      company_id: companyId,
      change_type: 'quota_renewal',
      amount: planData.base_tokens,
      balance_before: 0,
      balance_after: planData.base_tokens,
      description: `訂閱 ${planData.name} 方案${isLifetime ? '（終身）' : ''}`,
    })

    return {
      success: true,
      subscription: {
        id: subscriptionData.id,
        companyId: subscriptionData.company_id,
        planId: subscriptionData.plan_id,
        status: subscriptionData.status as 'active' | 'past_due' | 'cancelled' | 'trialing',
        purchasedTokenBalance: subscriptionData.purchased_token_balance,
        monthlyQuotaBalance: subscriptionData.monthly_quota_balance,
        monthlyTokenQuota: subscriptionData.monthly_token_quota,
        isLifetime: subscriptionData.is_lifetime || false,
        lifetimeDiscount: Number(subscriptionData.lifetime_discount || 1.0),
        currentPeriodStart: subscriptionData.current_period_start,
        currentPeriodEnd: subscriptionData.current_period_end,
        trialEnd: subscriptionData.trial_end,
        cancelledAt: subscriptionData.cancelled_at,
      },
    }
  }

  async createTokenSubscription(
    companyId: string,
    planId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: planData, error: planError } = await this.supabase
      .from('subscription_plans')
      .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
      .eq('id', planId)
      .single()

    if (planError || !planData) {
      return { success: false, error: '找不到指定的 Token 方案' }
    }

    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())

    const { error: subscriptionError } = await this.supabase
      .from('company_subscriptions')
      .upsert({
        company_id: companyId,
        plan_id: planId,
        status: 'active',
        monthly_token_quota: planData.base_tokens,
        monthly_quota_balance: planData.base_tokens,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })

    if (subscriptionError) {
      console.error('[SubscriptionService] 建立月訂閱 Token 失敗:', subscriptionError)
      return { success: false, error: '月訂閱 Token 建立失敗' }
    }

    const { data: subscription } = await this.supabase
      .from('company_subscriptions')
      .select<'purchased_token_balance', { purchased_token_balance: number }>('purchased_token_balance')
      .eq('company_id', companyId)
      .single()

    if (subscription) {
      const newBalance = subscription.purchased_token_balance + planData.base_tokens

      await this.supabase
        .from('company_subscriptions')
        .update({ purchased_token_balance: newBalance })
        .eq('company_id', companyId)

      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'purchase',
        amount: planData.base_tokens,
        balance_before: subscription.purchased_token_balance,
        balance_after: newBalance,
        description: `月訂閱 ${planData.name}`,
      })
    }

    return { success: true }
  }

  async upgradePlan(
    companyId: string,
    newPlanId: string
  ): Promise<{ success: boolean; error?: string }> {
    const currentSubscription = await this.getCompanySubscription(companyId)

    if (!currentSubscription) {
      return { success: false, error: '找不到目前的訂閱' }
    }

    if (currentSubscription.isLifetime) {
      return { success: false, error: '終身方案無法升級' }
    }

    const { data: newPlan, error: planError } = await this.supabase
      .from('subscription_plans')
      .select<'*', Database['public']['Tables']['subscription_plans']['Row']>('*')
      .eq('id', newPlanId)
      .single()

    if (planError || !newPlan) {
      return { success: false, error: '找不到指定的方案' }
    }

    const tokenDiff = newPlan.base_tokens - currentSubscription.monthlyTokenQuota
    const newMonthlyQuota = currentSubscription.monthlyQuotaBalance + tokenDiff

    const { error: updateError } = await this.supabase
      .from('company_subscriptions')
      .update({
        plan_id: newPlanId,
        monthly_token_quota: newPlan.base_tokens,
        monthly_quota_balance: Math.max(0, newMonthlyQuota),
      })
      .eq('company_id', companyId)

    if (updateError) {
      console.error('[SubscriptionService] 升級方案失敗:', updateError)
      return { success: false, error: '方案升級失敗' }
    }

    if (tokenDiff > 0) {
      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'adjustment',
        amount: tokenDiff,
        balance_before: currentSubscription.monthlyQuotaBalance,
        balance_after: newMonthlyQuota,
        description: `升級至 ${newPlan.name} 方案`,
      })
    }

    return { success: true }
  }

  async cancelSubscription(
    companyId: string,
    immediate: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const currentSubscription = await this.getCompanySubscription(companyId)

    if (!currentSubscription) {
      return { success: false, error: '找不到目前的訂閱' }
    }

    if (currentSubscription.isLifetime) {
      return { success: false, error: '終身方案無法取消' }
    }

    const now = new Date().toISOString()

    if (immediate) {
      const { error } = await this.supabase
        .from('company_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: now,
        })
        .eq('company_id', companyId)

      if (error) {
        console.error('[SubscriptionService] 取消訂閱失敗:', error)
        return { success: false, error: '訂閱取消失敗' }
      }
    } else {
      const { error } = await this.supabase
        .from('company_subscriptions')
        .update({
          cancelled_at: now,
        })
        .eq('company_id', companyId)

      if (error) {
        console.error('[SubscriptionService] 標記取消失敗:', error)
        return { success: false, error: '訂閱取消失敗' }
      }
    }

    return { success: true }
  }

  async renewMonthlyQuota(companyId: string): Promise<{ success: boolean; error?: string }> {
    const subscription = await this.getCompanySubscription(companyId)

    if (!subscription) {
      return { success: false, error: '找不到訂閱' }
    }

    if (subscription.isLifetime) {
      const { error } = await this.supabase
        .from('company_subscriptions')
        .update({
          monthly_quota_balance: subscription.monthlyTokenQuota,
        })
        .eq('company_id', companyId)

      if (error) {
        console.error('[SubscriptionService] 終身方案續約失敗:', error)
        return { success: false, error: '續約失敗' }
      }

      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'quota_renewal',
        amount: subscription.monthlyTokenQuota,
        balance_before: 0,
        balance_after: subscription.monthlyTokenQuota,
        description: '終身方案月配額續約',
      })

      return { success: true }
    }

    if (subscription.status !== 'active') {
      return { success: false, error: '訂閱狀態不正常' }
    }

    const now = new Date()
    const nextPeriodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()

    const { error: updateError } = await this.supabase
      .from('company_subscriptions')
      .update({
        monthly_quota_balance: subscription.monthlyTokenQuota,
        current_period_start: now.toISOString(),
        current_period_end: nextPeriodEnd,
      })
      .eq('company_id', companyId)

    if (updateError) {
      console.error('[SubscriptionService] 續約失敗:', updateError)
      return { success: false, error: '續約失敗' }
    }

    await this.supabase.from('token_balance_changes').insert({
      company_id: companyId,
      change_type: 'quota_renewal',
      amount: subscription.monthlyTokenQuota,
      balance_before: 0,
      balance_after: subscription.monthlyTokenQuota,
      description: '月配額續約',
    })

    return { success: true }
  }

  async purchaseTokenPackage(
    companyId: string,
    packageId: string,
    paymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: packageData, error: packageError } = await this.supabase
      .from('token_packages')
      .select<'*', Database['public']['Tables']['token_packages']['Row']>('*')
      .eq('id', packageId)
      .single()

    if (packageError || !packageData) {
      return { success: false, error: '找不到指定的 Token 包' }
    }

    const subscription = await this.getCompanySubscription(companyId)

    if (!subscription) {
      return { success: false, error: '找不到訂閱' }
    }

    let actualPrice = Number(packageData.price)

    if (subscription.isLifetime && subscription.lifetimeDiscount < 1.0) {
      actualPrice = actualPrice * subscription.lifetimeDiscount
    }

    const { data: purchaseData, error: purchaseError } = await this.supabase
      .from('payment_orders')
      .insert({
        company_id: companyId,
        order_no: `TOKEN-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        order_type: 'onetime',
        payment_type: 'token_package',
        amount: actualPrice,
        currency: 'TWD',
        item_description: packageData.name,
        related_id: packageId,
        newebpay_trade_no: paymentId,
        status: 'success',
        paid_at: new Date().toISOString(),
      })
      .select<'*', Database['public']['Tables']['payment_orders']['Row']>()
      .single()

    if (purchaseError) {
      console.error('[SubscriptionService] 購買記錄建立失敗:', purchaseError)
      return { success: false, error: '購買失敗' }
    }

    const newBalance = subscription.purchasedTokenBalance + packageData.tokens

    const { error: updateError } = await this.supabase
      .from('company_subscriptions')
      .update({ purchased_token_balance: newBalance })
      .eq('company_id', companyId)

    if (updateError) {
      console.error('[SubscriptionService] Token 增加失敗:', updateError)
      return { success: false, error: 'Token 增加失敗' }
    }

    await this.supabase.from('token_balance_changes').insert({
      company_id: companyId,
      change_type: 'purchase',
      amount: packageData.tokens,
      balance_before: subscription.purchasedTokenBalance,
      balance_after: newBalance,
      reference_id: purchaseData.id,
      description: `購買 ${packageData.name}${subscription.isLifetime ? ' (8折)' : ''}`,
    })

    return { success: true }
  }
}
