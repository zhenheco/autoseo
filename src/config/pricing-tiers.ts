/**
 * 分層收費系統配置
 * 根據不同的模型配置提供不同的收費方案
 */

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  modelPreset: string; // 對應 model-presets.ts 的配置
  pricing: {
    perArticle: number;      // 每篇文章收費
    monthlyBase: number;     // 月基礎費用
    includedArticles: number; // 包含文章數
    overagePrice: number;    // 超額單價
  };
  features: string[];
  limits: {
    maxArticlesPerDay: number;
    maxWordCount: number;
    supportLevel: 'basic' | 'standard' | 'premium' | 'enterprise';
  };
  costStructure: {
    actualCost: number;      // 實際 AI 成本
    grossMargin: number;     // 毛利率 %
    virtualMarkup: number;   // 虛擬加價倍數
  };
}

export const pricingTiers: Record<string, PricingTier> = {
  // 免費體驗版
  free: {
    id: 'free',
    name: '免費體驗',
    description: '適合個人部落格或測試',
    modelPreset: 'ultraFree',
    pricing: {
      perArticle: 0,
      monthlyBase: 0,
      includedArticles: 10,    // 每月 10 篇免費
      overagePrice: 0.5        // 超額每篇 $0.5
    },
    features: [
      '100% 免費 AI 模型',
      '每月 10 篇文章',
      '基礎 SEO 優化',
      '1000 字上限',
      'Email 支援'
    ],
    limits: {
      maxArticlesPerDay: 2,
      maxWordCount: 1000,
      supportLevel: 'basic'
    },
    costStructure: {
      actualCost: 0,
      grossMargin: 100,
      virtualMarkup: 0 // 無加價，超額才收費
    }
  },

  // 入門版
  starter: {
    id: 'starter',
    name: '入門版',
    description: '適合小型網站和新創',
    modelPreset: 'experimental',
    pricing: {
      perArticle: 0,
      monthlyBase: 29,
      includedArticles: 50,
      overagePrice: 0.8
    },
    features: [
      '免費 AI 模型組合',
      '每月 50 篇文章',
      '標準 SEO 優化',
      '1500 字上限',
      '關鍵字研究工具',
      'Email 支援'
    ],
    limits: {
      maxArticlesPerDay: 5,
      maxWordCount: 1500,
      supportLevel: 'basic'
    },
    costStructure: {
      actualCost: 0,
      grossMargin: 100,
      virtualMarkup: 0
    }
  },

  // 成長版
  growth: {
    id: 'growth',
    name: '成長版',
    description: '適合成長中的企業',
    modelPreset: 'costEffective',
    pricing: {
      perArticle: 0,
      monthlyBase: 99,
      includedArticles: 100,
      overagePrice: 1.2
    },
    features: [
      '高 CP 值模型組合',
      '每月 100 篇文章',
      '進階 SEO 優化',
      '2000 字上限',
      '競爭對手分析',
      '內部連結建議',
      '優先 Email 支援'
    ],
    limits: {
      maxArticlesPerDay: 10,
      maxWordCount: 2000,
      supportLevel: 'standard'
    },
    costStructure: {
      actualCost: 0.08,
      grossMargin: 85,    // 85% 毛利
      virtualMarkup: 15   // 15倍加價
    }
  },

  // 專業版
  professional: {
    id: 'professional',
    name: '專業版',
    description: '適合專業內容團隊',
    modelPreset: 'balanced',
    pricing: {
      perArticle: 0,
      monthlyBase: 299,
      includedArticles: 200,
      overagePrice: 1.8
    },
    features: [
      '平衡型高品質模型',
      '每月 200 篇文章',
      '完整 SEO 套件',
      '3000 字上限',
      'AI 圖片生成',
      '競爭對手監控',
      '內容策略建議',
      '即時聊天支援'
    ],
    limits: {
      maxArticlesPerDay: 20,
      maxWordCount: 3000,
      supportLevel: 'premium'
    },
    costStructure: {
      actualCost: 0.18,
      grossMargin: 80,
      virtualMarkup: 10
    }
  },

  // 企業版
  enterprise: {
    id: 'enterprise',
    name: '企業版',
    description: '適合大型企業和代理商',
    modelPreset: 'premium',
    pricing: {
      perArticle: 0,
      monthlyBase: 999,
      includedArticles: 500,
      overagePrice: 2.5
    },
    features: [
      '最高品質 AI 模型',
      '每月 500 篇文章',
      '企業級 SEO 優化',
      '無字數限制',
      'AI 圖片和影片',
      '多語言支援',
      'API 存取',
      '專屬客戶經理',
      'SLA 保證'
    ],
    limits: {
      maxArticlesPerDay: 100,
      maxWordCount: 10000,
      supportLevel: 'enterprise'
    },
    costStructure: {
      actualCost: 0.45,
      grossMargin: 75,
      virtualMarkup: 5.5
    }
  },

  // 客製化版
  custom: {
    id: 'custom',
    name: '客製化方案',
    description: '根據需求量身定制',
    modelPreset: 'custom',
    pricing: {
      perArticle: 0,        // 協商定價
      monthlyBase: 0,       // 協商定價
      includedArticles: 0,  // 協商定量
      overagePrice: 0       // 協商定價
    },
    features: [
      '自選 AI 模型組合',
      '彈性文章數量',
      '客製化功能開發',
      '專用伺服器部署',
      '白標服務',
      '現場培訓',
      '24/7 技術支援'
    ],
    limits: {
      maxArticlesPerDay: 999999,
      maxWordCount: 999999,
      supportLevel: 'enterprise'
    },
    costStructure: {
      actualCost: 0,      // 根據選擇計算
      grossMargin: 0,     // 協商決定
      virtualMarkup: 0    // 協商決定
    }
  }
};

/**
 * 計算實際收費
 */
export function calculateMonthlyCharge(
  tier: PricingTier,
  articlesUsed: number
): {
  baseCharge: number;
  overageCharge: number;
  totalCharge: number;
  actualCost: number;
  grossProfit: number;
  profitMargin: number;
} {
  const baseCharge = tier.pricing.monthlyBase;
  const overage = Math.max(0, articlesUsed - tier.pricing.includedArticles);
  const overageCharge = overage * tier.pricing.overagePrice;
  const totalCharge = baseCharge + overageCharge;

  const actualCost = articlesUsed * tier.costStructure.actualCost;
  const grossProfit = totalCharge - actualCost;
  const profitMargin = totalCharge > 0 ? (grossProfit / totalCharge) * 100 : 0;

  return {
    baseCharge,
    overageCharge,
    totalCharge,
    actualCost,
    grossProfit,
    profitMargin
  };
}

/**
 * 推薦合適的方案
 */
export function recommendTier(
  monthlyArticles: number,
  qualityRequirement: 'low' | 'medium' | 'high',
  budget: number
): PricingTier {
  // 根據文章數量篩選
  const suitableTiers = Object.values(pricingTiers).filter(tier => {
    if (tier.id === 'custom') return false;
    return tier.pricing.includedArticles >= monthlyArticles * 0.8;
  });

  // 根據品質要求篩選
  const qualityFiltered = suitableTiers.filter(tier => {
    if (qualityRequirement === 'high') {
      return ['professional', 'enterprise'].includes(tier.id);
    } else if (qualityRequirement === 'medium') {
      return ['growth', 'professional'].includes(tier.id);
    }
    return true; // low 接受所有
  });

  // 根據預算選擇
  const budgetFiltered = qualityFiltered.filter(tier => {
    const cost = calculateMonthlyCharge(tier, monthlyArticles).totalCharge;
    return cost <= budget;
  });

  // 返回最合適的（價格最接近預算的）
  if (budgetFiltered.length > 0) {
    return budgetFiltered.reduce((prev, current) => {
      const prevCost = calculateMonthlyCharge(prev, monthlyArticles).totalCharge;
      const currentCost = calculateMonthlyCharge(current, monthlyArticles).totalCharge;
      return currentCost > prevCost ? current : prev;
    });
  }

  // 如果沒有符合預算的，返回最便宜的
  return pricingTiers.free;
}

/**
 * 方案升級路徑
 */
export const upgradePaths = {
  free: ['starter'],
  starter: ['growth'],
  growth: ['professional'],
  professional: ['enterprise'],
  enterprise: ['custom']
};

/**
 * 折扣策略
 */
export const discounts = {
  annual: 0.15,      // 年付 15% 折扣
  biannual: 0.08,    // 半年付 8% 折扣
  quarterly: 0.03,   // 季付 3% 折扣
  nonprofit: 0.25,   // 非營利組織 25% 折扣
  education: 0.20,   // 教育機構 20% 折扣
  startup: 0.30,     // 新創公司前 6 個月 30% 折扣
};

export default pricingTiers;