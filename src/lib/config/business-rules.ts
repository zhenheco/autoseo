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
    orderNumberPrefix: "ORD",
    orderNumberLength: 14,
    paymentGateway: {
      version: "2.0",
      respondType: "JSON",
      defaultCurrency: "TWD",
    },
  },
  ai: {
    models: {
      research: {
        defaultModel: "deepseek-reasoner",
        temperature: 0.3,
        maxTokens: 64000,
      },
      strategy: {
        defaultModel: "deepseek-reasoner",
        temperature: 0.7,
        maxTokens: 64000,
      },
      outline: {
        defaultModel: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 8192,
      },
      writing: {
        defaultModel: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 8192,
      },
      seoOptimization: {
        defaultModel: "deepseek-chat",
        temperature: 0.5,
        maxTokens: 8192,
      },
      metaGeneration: {
        defaultModel: "deepseek-chat",
        temperature: 0.3,
        maxTokens: 4000,
      },
      featuredImage: {
        defaultModel: "gemini-3-pro-image-preview",
        quality: "low",
        size: "1024x1024",
      },
      contentImage: {
        defaultModel: "gpt-image-1-mini",
        quality: "low",
        size: "1024x1024",
      },
    },
  },
} as const;

export type BusinessRules = typeof BUSINESS_RULES;
