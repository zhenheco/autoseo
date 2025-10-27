/**
 * 簡化版收費模式
 * 統一使用 GPT-5 虛擬計價，避免複雜性
 */

export interface SimplePricing {
  baseRate: number;      // 基礎費率（按 GPT-5 價格）
  markup: number;        // 加價倍數
  minCharge: number;     // 最低收費
}

/**
 * 統一虛擬計價系統
 * 不管後端用什麼模型，都按 GPT-5 價格計算給客戶
 */
export const VIRTUAL_PRICING = {
  // GPT-5 基準價格
  baseTokenPricing: {
    input: 0.00125,    // $1.25/1M input tokens
    output: 0.01,      // $10/1M output tokens
  },

  // 簡單的加價策略（不分方案）
  universalMarkup: 2.5,  // 統一 2.5 倍加價

  // 每篇文章預估 token 使用
  estimatedTokensPerArticle: {
    input: 5000,       // 平均 5K input tokens
    output: 3000,      // 平均 3K output tokens
  }
};

/**
 * 計算單篇文章的虛擬成本
 */
export function calculateVirtualCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1000) * VIRTUAL_PRICING.baseTokenPricing.input;
  const outputCost = (outputTokens / 1000) * VIRTUAL_PRICING.baseTokenPricing.output;
  return inputCost + outputCost;
}

/**
 * 計算客戶收費（簡化版）
 */
export function calculateCustomerCharge(
  inputTokens: number,
  outputTokens: number
): {
  virtualCost: number;    // 虛擬成本
  customerCharge: number; // 客戶收費
  profit: number;         // 利潤
} {
  const virtualCost = calculateVirtualCost(inputTokens, outputTokens);
  const customerCharge = virtualCost * VIRTUAL_PRICING.universalMarkup;
  const profit = customerCharge - virtualCost;

  return {
    virtualCost,
    customerCharge,
    profit
  };
}

/**
 * 預估每篇文章收費
 */
export function estimateArticleCharge(): {
  estimated: number;
  breakdown: {
    virtualCost: number;
    markup: number;
    total: number;
  };
} {
  const { input, output } = VIRTUAL_PRICING.estimatedTokensPerArticle;
  const charge = calculateCustomerCharge(input, output);

  return {
    estimated: charge.customerCharge,
    breakdown: {
      virtualCost: charge.virtualCost,
      markup: charge.profit,
      total: charge.customerCharge
    }
  };
}

/**
 * 模型選擇策略（內部使用）
 * 客戶不需要知道我們用什麼模型
 */
export const INTERNAL_MODEL_STRATEGY = {
  // 根據客戶付費等級自動選擇模型
  autoSelect: (monthlySpend: number): string => {
    if (monthlySpend < 50) {
      return 'experimental';  // 全免費模型
    } else if (monthlySpend < 200) {
      return 'costEffective'; // 高 CP 值模型
    } else {
      return 'balanced';      // 平衡模型
    }
  },

  // 實際成本（內部追蹤）
  actualCosts: {
    experimental: 0.00,   // 免費
    costEffective: 0.08,  // $0.08/篇
    balanced: 0.18,       // $0.18/篇
    premium: 0.45         // $0.45/篇
  }
};

/**
 * 利潤計算（內部使用）
 */
export function calculateProfit(
  customerCharge: number,
  modelPreset: string
): {
  actualCost: number;
  grossProfit: number;
  profitMargin: number;
} {
  const actualCost = (INTERNAL_MODEL_STRATEGY.actualCosts as any)[modelPreset] || 0;
  const grossProfit = customerCharge - actualCost;
  const profitMargin = customerCharge > 0 ? (grossProfit / customerCharge) * 100 : 0;

  return {
    actualCost,
    grossProfit,
    profitMargin
  };
}

/**
 * 月度帳單範例
 */
export function generateMonthlyBill(
  articlesGenerated: number,
  totalInputTokens: number,
  totalOutputTokens: number
): {
  itemizedCharges: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
} {
  const virtualCost = calculateVirtualCost(totalInputTokens, totalOutputTokens);
  const charge = virtualCost * VIRTUAL_PRICING.universalMarkup;

  const itemizedCharges = [
    {
      description: 'AI 文章生成服務',
      quantity: articlesGenerated,
      unitPrice: charge / articlesGenerated,
      total: charge
    },
    {
      description: 'Token 使用費（輸入）',
      quantity: totalInputTokens / 1000,
      unitPrice: VIRTUAL_PRICING.baseTokenPricing.input * VIRTUAL_PRICING.universalMarkup,
      total: (totalInputTokens / 1000) * VIRTUAL_PRICING.baseTokenPricing.input * VIRTUAL_PRICING.universalMarkup
    },
    {
      description: 'Token 使用費（輸出）',
      quantity: totalOutputTokens / 1000,
      unitPrice: VIRTUAL_PRICING.baseTokenPricing.output * VIRTUAL_PRICING.universalMarkup,
      total: (totalOutputTokens / 1000) * VIRTUAL_PRICING.baseTokenPricing.output * VIRTUAL_PRICING.universalMarkup
    }
  ];

  const subtotal = charge;
  const tax = 0; // 可根據地區調整
  const total = subtotal + tax;

  return {
    itemizedCharges,
    subtotal,
    tax,
    total
  };
}

/**
 * 優點：
 * 1. 客戶看到的價格統一且透明（都是按 GPT-5 計算）
 * 2. 後端可以靈活切換模型（客戶無感）
 * 3. 利潤空間大（免費模型時利潤接近 100%）
 * 4. 簡單易懂，避免複雜的方案選擇
 */

export default {
  VIRTUAL_PRICING,
  calculateVirtualCost,
  calculateCustomerCharge,
  estimateArticleCharge,
  calculateProfit,
  generateMonthlyBill
};