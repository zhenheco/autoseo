/**
 * Token 計費系統核心計算邏輯
 *
 * 計費公式：
 * 實際扣除 Token = 官方 Token × 模型倍率 × 200%
 *
 * 範例：
 * - DeepSeek-Chat (1x): 1000 官方 tokens → 扣 2000 tokens
 * - Claude 3.5 (2x): 1000 官方 tokens → 扣 4000 tokens
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface TokenUsage {
  modelName: string
  inputTokens: number
  outputTokens: number
}

export interface TokenCalculationResult {
  // 官方消耗
  officialInputTokens: number
  officialOutputTokens: number
  officialTotalTokens: number

  // 模型資訊
  modelTier: 'basic' | 'advanced'
  modelMultiplier: number

  // 成本計算 (USD)
  officialCostUsd: number
  chargedCostUsd: number

  // Token 扣除
  chargedTokens: number
}

export interface ModelPricing {
  modelName: string
  provider: string
  tier: 'basic' | 'advanced'
  multiplier: number
  inputPricePer1M: number
  outputPricePer1M: number
}

export class TokenCalculator {
  private supabase: ReturnType<typeof createClient<Database>>
  private modelPricingCache: Map<string, ModelPricing> = new Map()
  private cacheExpiry: number = 0
  private readonly CACHE_TTL = 1000 * 60 * 60 // 1 hour

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase
  }

  /**
   * 計算 Token 使用成本和扣除量
   */
  async calculate(usage: TokenUsage): Promise<TokenCalculationResult> {
    const pricing = await this.getModelPricing(usage.modelName)

    if (!pricing) {
      throw new Error(`Model pricing not found for: ${usage.modelName}`)
    }

    // 1. 計算官方成本 (USD)
    const officialCostUsd =
      (usage.inputTokens * pricing.inputPricePer1M / 1_000_000) +
      (usage.outputTokens * pricing.outputPricePer1M / 1_000_000)

    // 2. 計算收費成本 (官方 × 200%)
    const chargedCostUsd = officialCostUsd * 2.0

    // 3. 計算扣除 Token (官方 × 倍率 × 200%)
    const totalOfficialTokens = usage.inputTokens + usage.outputTokens
    const chargedTokens = Math.ceil(
      totalOfficialTokens * pricing.multiplier * 2.0
    )

    return {
      officialInputTokens: usage.inputTokens,
      officialOutputTokens: usage.outputTokens,
      officialTotalTokens: totalOfficialTokens,
      modelTier: pricing.tier,
      modelMultiplier: pricing.multiplier,
      officialCostUsd,
      chargedCostUsd,
      chargedTokens,
    }
  }

  /**
   * 取得模型定價（帶快取）
   */
  private async getModelPricing(modelName: string): Promise<ModelPricing | null> {
    // 檢查快取
    const now = Date.now()
    if (now < this.cacheExpiry && this.modelPricingCache.has(modelName)) {
      return this.modelPricingCache.get(modelName)!
    }

    // 快取過期，重新載入所有定價
    if (now >= this.cacheExpiry) {
      await this.refreshPricingCache()
    }

    return this.modelPricingCache.get(modelName) || null
  }

  /**
   * 刷新定價快取
   */
  private async refreshPricingCache(): Promise<void> {
    const { data, error } = await this.supabase
      .from('ai_model_pricing')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('Failed to refresh pricing cache:', error)
      return
    }

    this.modelPricingCache.clear()

    for (const row of data || []) {
      this.modelPricingCache.set(row.model_name, {
        modelName: row.model_name,
        provider: row.provider,
        tier: row.tier as 'basic' | 'advanced',
        multiplier: Number(row.multiplier),
        inputPricePer1M: Number(row.input_price_per_1m),
        outputPricePer1M: Number(row.output_price_per_1m),
      })
    }

    this.cacheExpiry = Date.now() + this.CACHE_TTL
  }

  /**
   * 取得所有可用模型
   */
  async getAvailableModels(): Promise<ModelPricing[]> {
    await this.refreshPricingCache()
    return Array.from(this.modelPricingCache.values())
  }

  /**
   * 檢查用戶是否有足夠 Token（購買的 + 月配額）
   */
  async hasEnoughTokens(
    companyId: string,
    requiredTokens: number
  ): Promise<{
    sufficient: boolean
    current: number
    required: number
    monthlyQuota: number
    purchased: number
  }> {
    const { data, error } = await this.supabase
      .from('company_subscriptions')
      .select('monthly_quota_balance, purchased_token_balance')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      return {
        sufficient: false,
        current: 0,
        required: requiredTokens,
        monthlyQuota: 0,
        purchased: 0,
      }
    }

    const totalBalance = data.monthly_quota_balance + data.purchased_token_balance

    return {
      sufficient: totalBalance >= requiredTokens,
      current: totalBalance,
      required: requiredTokens,
      monthlyQuota: data.monthly_quota_balance,
      purchased: data.purchased_token_balance,
    }
  }

  /**
   * 預估文章生成 Token 消耗
   */
  estimateArticleTokens(params: {
    wordCount: number
    model: string
    includeImages: number
    includeSeo: boolean
  }): Promise<TokenCalculationResult> {
    // 基於字數估算 Token
    // 中文：約 1.5 字 = 1 token
    // 英文：約 0.75 字 = 1 token
    const estimatedTokens = Math.ceil(params.wordCount / 1.2)

    // 文章生成通常 input 較少，output 較多
    const inputTokens = Math.ceil(estimatedTokens * 0.2) // 20% prompt
    const outputTokens = Math.ceil(estimatedTokens * 0.8) // 80% output

    // SEO 優化會增加 15% Token
    const seoMultiplier = params.includeSeo ? 1.15 : 1.0

    // 配圖描述每張約 50 tokens
    const imageTokens = params.includeImages * 50

    return this.calculate({
      modelName: params.model,
      inputTokens: Math.ceil((inputTokens + imageTokens) * seoMultiplier),
      outputTokens: Math.ceil(outputTokens * seoMultiplier),
    })
  }
}

/**
 * 使用範例：
 *
 * const calculator = new TokenCalculator(supabase)
 *
 * // 計算實際使用
 * const result = await calculator.calculate({
 *   modelName: 'deepseek-chat',
 *   inputTokens: 500,
 *   outputTokens: 1500
 * })
 * console.log(`需扣除 Token: ${result.chargedTokens}`)
 *
 * // 預估文章生成
 * const estimate = await calculator.estimateArticleTokens({
 *   wordCount: 1500,
 *   model: 'claude-3-5-sonnet',
 *   includeImages: 3,
 *   includeSeo: true
 * })
 * console.log(`預估消耗: ${estimate.chargedTokens} tokens`)
 */
