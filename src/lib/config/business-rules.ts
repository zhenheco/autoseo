/**
 * 集中管理所有業務規則和配置
 * 避免魔術數字散落在程式碼中
 */

export const BUSINESS_RULES = {
  referral: {
    signupReward: 2000,
    firstPaymentCommissionRate: 0.2,
    firstPurchaseDiscountRate: 0.8,
  },
  subscription: {
    lifetimeDiscountRate: 0.8,
    trialPeriodDays: 14,
    defaultTokenQuota: 100000,
  },
  payment: {
    orderNumberPrefix: 'ORD',
    orderNumberLength: 14,
    paymentGateway: {
      version: '2.0',
      respondType: 'JSON',
      defaultCurrency: 'TWD',
    },
  },
  ai: {
    models: {
      research: {
        defaultModel: 'deepseek/deepseek-reasoner',
        temperature: 0.3,
        maxTokens: 4000,
      },
      strategy: {
        defaultModel: 'deepseek/deepseek-chat',
        temperature: 0.7,
        maxTokens: 4000,
      },
      outline: {
        defaultModel: 'deepseek/deepseek-chat',
        temperature: 0.7,
        maxTokens: 8000,
      },
      seoOptimization: {
        defaultModel: 'openai/gpt-4o',
        temperature: 0.5,
        maxTokens: 2000,
      },
      metaGeneration: {
        defaultModel: 'openai/gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 1000,
      },
    },
  },
} as const

export type BusinessRules = typeof BUSINESS_RULES