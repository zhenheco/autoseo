import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { TokenCalculator } from './token-calculator'
import type { AIClient } from '@/lib/ai/ai-client'
import type { AICompletionOptions, AICompletionResponse } from '@/types/agents'
import {
  InsufficientBalanceError,
  DeductionInProgressError,
  DatabaseError,
} from './errors'

export interface BilledCompletionResult {
  response: AICompletionResponse
  billing: {
    chargedTokens: number
    officialTokens: number
    modelTier: 'basic' | 'advanced'
    modelMultiplier: number
    balanceBefore: number
    balanceAfter: number
  }
}

export interface TokenCheckResult {
  sufficient: boolean
  currentBalance: number
  requiredTokens: number
  deficit?: number
}

export interface DeductTokensIdempotentParams {
  idempotencyKey: string
  companyId: string
  articleId?: string
  amount: number
  metadata?: {
    modelName?: string
    articleTitle?: string
    [key: string]: unknown
  }
}

export interface DeductTokensResult {
  success: boolean
  idempotent: boolean
  recordId: string
  balanceBefore: number
  balanceAfter: number
  deductedFromMonthly: number
  deductedFromPurchased: number
}

export class TokenBillingService {
  private supabase: ReturnType<typeof createClient<Database>>
  private calculator: TokenCalculator

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase
    this.calculator = new TokenCalculator(supabase)
  }

  async checkTokenBalance(
    companyId: string,
    estimatedTokens: number
  ): Promise<TokenCheckResult> {
    const result = await this.calculator.hasEnoughTokens(companyId, estimatedTokens)

    if (!result.sufficient) {
      return {
        sufficient: false,
        currentBalance: result.current,
        requiredTokens: result.required,
        deficit: result.required - result.current,
      }
    }

    return {
      sufficient: true,
      currentBalance: result.current,
      requiredTokens: result.required,
    }
  }

  async completeWithBilling(
    aiClient: AIClient,
    companyId: string,
    userId: string,
    articleId: string | null,
    prompt: string,
    options: AICompletionOptions,
    usageType: 'article_generation' | 'title_generation' | 'image_description' | 'perplexity_analysis' = 'article_generation',
    metadata: Record<string, unknown> = {}
  ): Promise<BilledCompletionResult> {
    // 先檢查並重置配額（如果需要）
    await this.checkAndResetMonthlyQuota(companyId)

    const estimateResult = await this.calculator.estimateArticleTokens({
      wordCount: typeof prompt === 'string' ? prompt.length : 1000,
      model: options.model,
      includeImages: 0,
      includeSeo: false,
    })

    const balanceCheck = await this.checkTokenBalance(companyId, estimateResult.chargedTokens)

    if (!balanceCheck.sufficient) {
      throw new Error(
        `Token 餘額不足。當前: ${balanceCheck.currentBalance}, 需要: ${balanceCheck.requiredTokens}, 差額: ${balanceCheck.deficit}`
      )
    }

    const response = await aiClient.complete(prompt, options)

    const actualCalculation = await this.calculator.calculate({
      modelName: response.model || options.model,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
    })

    const { data: subscriptionData } = await this.supabase
      .from('company_subscriptions')
      .select('monthly_quota_balance, purchased_token_balance')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (!subscriptionData) {
      throw new Error('找不到有效的訂閱')
    }

    const monthlyQuotaBefore = subscriptionData.monthly_quota_balance
    const purchasedBefore = subscriptionData.purchased_token_balance
    const totalBefore = monthlyQuotaBefore + purchasedBefore

    let remainingToDeduct = actualCalculation.chargedTokens
    let newMonthlyQuota = monthlyQuotaBefore
    let newPurchased = purchasedBefore

    if (purchasedBefore > 0) {
      const deductFromPurchased = Math.min(remainingToDeduct, purchasedBefore)
      newPurchased -= deductFromPurchased
      remainingToDeduct -= deductFromPurchased

      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'usage',
        amount: -deductFromPurchased,
        balance_before: purchasedBefore,
        balance_after: newPurchased,
        reference_id: articleId,
        description: `${usageType} - ${options.model} (購買)`,
      })
    }

    if (remainingToDeduct > 0) {
      if (monthlyQuotaBefore < remainingToDeduct) {
        throw new Error('Token 餘額不足')
      }

      newMonthlyQuota -= remainingToDeduct

      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'usage',
        amount: -remainingToDeduct,
        balance_before: monthlyQuotaBefore,
        balance_after: newMonthlyQuota,
        reference_id: articleId,
        description: `${usageType} - ${options.model} (月配額)`,
      })
    }

    const { error: balanceError } = await this.supabase
      .from('company_subscriptions')
      .update({
        monthly_quota_balance: newMonthlyQuota,
        purchased_token_balance: newPurchased,
      })
      .eq('company_id', companyId)
      .eq('status', 'active')

    if (balanceError) {
      console.error('[TokenBillingService] Token 扣除失敗:', balanceError)
      throw new Error('Token 扣除失敗，請聯繫客服')
    }

    const { error: usageError } = await this.supabase.from('token_usage_logs').insert({
      company_id: companyId,
      article_id: articleId,
      user_id: userId,
      model_name: response.model || options.model,
      model_tier: actualCalculation.modelTier,
      model_multiplier: actualCalculation.modelMultiplier,
      input_tokens: actualCalculation.officialInputTokens,
      output_tokens: actualCalculation.officialOutputTokens,
      total_official_tokens: actualCalculation.officialTotalTokens,
      charged_tokens: actualCalculation.chargedTokens,
      official_cost_usd: actualCalculation.officialCostUsd,
      charged_cost_usd: actualCalculation.chargedCostUsd,
      usage_type: usageType,
      metadata: metadata as unknown as Database['public']['Tables']['token_usage_logs']['Insert']['metadata'],
    })

    if (usageError) {
      console.error('[TokenBillingService] 使用記錄寫入失敗:', usageError)
    }

    const totalAfter = newMonthlyQuota + newPurchased

    await this.updateMonthlyStats(companyId, actualCalculation, usageType)

    return {
      response,
      billing: {
        chargedTokens: actualCalculation.chargedTokens,
        officialTokens: actualCalculation.officialTotalTokens,
        modelTier: actualCalculation.modelTier,
        modelMultiplier: actualCalculation.modelMultiplier,
        balanceBefore: totalBefore,
        balanceAfter: totalAfter,
      },
    }
  }

  private async updateMonthlyStats(
    companyId: string,
    calculation: Awaited<ReturnType<typeof this.calculator.calculate>>,
    usageType: string
  ): Promise<void> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const { data: existingStats } = await this.supabase
      .from('monthly_token_usage_stats')
      .select<'*', Database['public']['Tables']['monthly_token_usage_stats']['Row']>('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (existingStats) {
      const tokensByModel = existingStats.tokens_by_model as Record<string, number> || {}
      const tokensByUsage = existingStats.tokens_by_usage as Record<string, number> || {}

      const modelKey = calculation.modelTier
      tokensByModel[modelKey] = (tokensByModel[modelKey] || 0) + calculation.chargedTokens
      tokensByUsage[usageType] = (tokensByUsage[usageType] || 0) + calculation.chargedTokens

      await this.supabase
        .from('monthly_token_usage_stats')
        .update({
          total_articles_generated: (existingStats.total_articles_generated || 0) + 1,
          total_tokens_used: (existingStats.total_tokens_used || 0) + calculation.chargedTokens,
          total_cost_usd: Number(existingStats.total_cost_usd || 0) + calculation.chargedCostUsd,
          tokens_by_model: tokensByModel,
          tokens_by_usage: tokensByUsage,
        })
        .eq('id', existingStats.id)
    } else {
      await this.supabase.from('monthly_token_usage_stats').insert({
        company_id: companyId,
        year,
        month,
        total_articles_generated: 1,
        total_tokens_used: calculation.chargedTokens,
        total_cost_usd: calculation.chargedCostUsd,
        tokens_by_model: { [calculation.modelTier]: calculation.chargedTokens },
        tokens_by_usage: { [usageType]: calculation.chargedTokens },
      })
    }
  }

  async estimateArticleTokens(params: {
    wordCount: number
    model: string
    includeImages: number
    includeSeo: boolean
  }) {
    return this.calculator.estimateArticleTokens(params)
  }

  async getAvailableModels() {
    return this.calculator.getAvailableModels()
  }

  /**
   * 檢查並重置每月配額（如果週期已過）
   * 僅適用於付費方案，免費方案使用一次性 tokens
   */
  async checkAndResetMonthlyQuota(companyId: string): Promise<void> {
    const { data: subscription } = await this.supabase
      .from('company_subscriptions')
      .select('id, current_period_end, monthly_token_quota, monthly_quota_balance')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (!subscription) {
      console.error('[TokenBillingService] 找不到有效訂閱')
      return
    }

    // 免費方案（月配額為 0）不需要重置
    if (subscription.monthly_token_quota === 0 || !subscription.current_period_end) {
      return
    }

    const now = new Date()
    const periodEnd = new Date(subscription.current_period_end)

    // 檢查週期是否已過
    if (now > periodEnd) {
      console.log(`[TokenBillingService] 重置公司 ${companyId} 的月配額`)

      // 計算新的週期
      const newPeriodStart = now
      const newPeriodEnd = new Date(now)
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

      // 重置月配額為完整配額
      const { error } = await this.supabase
        .from('company_subscriptions')
        .update({
          monthly_quota_balance: subscription.monthly_token_quota,
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq('id', subscription.id)

      if (error) {
        console.error('[TokenBillingService] 重置配額失敗:', error)
        return
      }

      // 記錄重置事件
      await this.supabase.from('token_balance_changes').insert({
        company_id: companyId,
        change_type: 'monthly_reset',
        amount: subscription.monthly_token_quota - subscription.monthly_quota_balance,
        balance_before: subscription.monthly_quota_balance,
        balance_after: subscription.monthly_token_quota,
        description: '每月配額重置',
      })
    }
  }

  async getCurrentBalance(
    companyId: string
  ): Promise<{
    total: number
    monthlyQuota: number
    purchased: number
  }> {
    // 先檢查並重置配額（如果需要）
    await this.checkAndResetMonthlyQuota(companyId)

    const { data } = await this.supabase
      .from('company_subscriptions')
      .select('monthly_quota_balance, purchased_token_balance')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (!data) {
      return { total: 0, monthlyQuota: 0, purchased: 0 }
    }

    return {
      total: data.monthly_quota_balance + data.purchased_token_balance,
      monthlyQuota: data.monthly_quota_balance,
      purchased: data.purchased_token_balance,
    }
  }

  async getUsageHistory(
    companyId: string,
    options: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
      usageType?: 'article_generation' | 'title_generation' | 'image_description' | 'perplexity_analysis'
    } = {}
  ) {
    let query = this.supabase
      .from('token_usage_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString())
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString())
    }

    if (options.usageType) {
      query = query.eq('usage_type', options.usageType)
    }

    const { data, error } = await query

    if (error) {
      console.error('[TokenBillingService] 查詢使用記錄失敗:', error)
      return []
    }

    return data || []
  }

  async getMonthlyStats(companyId: string, year: number, month: number) {
    const { data } = await this.supabase
      .from('monthly_token_usage_stats')
      .select('*')
      .eq('company_id', companyId)
      .eq('year', year)
      .eq('month', month)
      .single()

    return data
  }

  async deductTokensIdempotent(
    params: DeductTokensIdempotentParams
  ): Promise<DeductTokensResult> {
    const { idempotencyKey, companyId, articleId, amount, metadata } = params

    const { data, error } = (await this.supabase.rpc('deduct_tokens_atomic', {
      p_idempotency_key: idempotencyKey,
      p_company_id: companyId,
      p_article_id: articleId || null,
      p_amount: amount,
    } as never)) as {
      data: {
        success: boolean
        idempotent: boolean
        record_id: string
        balance_before: number
        balance_after: number
        deducted_from_monthly: number
        deducted_from_purchased: number
      } | null
      error: { message: string } | null
    }

    if (error || !data) {
      const errorMessage = error?.message || 'Unknown error'
      if (errorMessage.includes('Insufficient balance')) {
        throw new InsufficientBalanceError(
          `餘額不足：需要 ${amount} tokens，請升級方案或購買 Token`
        )
      }
      if (errorMessage.includes('already in progress')) {
        throw new DeductionInProgressError(
          `扣款正在處理中，請稍後再試（idempotency_key: ${idempotencyKey}）`
        )
      }
      throw new DatabaseError(errorMessage)
    }

    if (!data.idempotent) {
      await this.logTokenUsage({
        companyId,
        articleId,
        amount,
        recordId: data.record_id,
        metadata,
      })
    }

    return {
      success: data.success,
      idempotent: data.idempotent,
      recordId: data.record_id,
      balanceBefore: data.balance_before,
      balanceAfter: data.balance_after,
      deductedFromMonthly: data.deducted_from_monthly,
      deductedFromPurchased: data.deducted_from_purchased,
    }
  }

  private async logTokenUsage(params: {
    companyId: string
    articleId?: string
    amount: number
    recordId: string
    metadata?: DeductTokensIdempotentParams['metadata']
  }): Promise<void> {
    await this.supabase.from('token_usage_logs').insert({
      company_id: params.companyId,
      article_id: params.articleId || null,
      user_id: null,
      model_name: params.metadata?.modelName || 'unknown',
      model_tier: 'advanced',
      model_multiplier: 2.0,
      input_tokens: 0,
      output_tokens: 0,
      total_official_tokens: 0,
      charged_tokens: params.amount,
      official_cost_usd: 0,
      charged_cost_usd: 0,
      usage_type: 'article_generation',
      metadata: params.metadata as unknown as Database['public']['Tables']['token_usage_logs']['Insert']['metadata'],
    })
  }
}
