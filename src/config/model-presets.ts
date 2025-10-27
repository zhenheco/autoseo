/**
 * 預設模型配置方案
 * 提供不同成本/品質等級的模型組合
 */

export interface ModelPreset {
  name: string;
  description: string;
  monthlyBudget: string;
  models: {
    research_model: string;
    strategy_model: string;
    writing_model: string;
    meta_model: string;
    image_model: string;
  };
  estimatedCostPerArticle: number;
  qualityScore: number; // 1-100
}

export const modelPresets: Record<string, ModelPreset> = {
  // 最高品質配置
  premium: {
    name: '專業版',
    description: '最高品質，適合要求嚴格的企業客戶',
    monthlyBudget: '$250+',
    models: {
      research_model: 'openai/gpt-5-turbo',
      strategy_model: 'openai/gpt-5-turbo',
      writing_model: 'openai/gpt-5',
      meta_model: 'google/gemini-2.5-pro',
      image_model: 'openai/dall-e-3'
    },
    estimatedCostPerArticle: 0.45,
    qualityScore: 98
  },

  // 平衡配置（推薦）
  balanced: {
    name: '標準版',
    description: '品質與成本的最佳平衡，適合大多數用戶',
    monthlyBudget: '$50-100',
    models: {
      research_model: 'google/gemini-2.5-pro',
      strategy_model: 'google/gemini-2.5-pro',
      writing_model: 'x-ai/grok-4-fast',
      meta_model: 'deepseek/deepseek-chat-v3.1:free',
      image_model: 'openai/gpt-5-image-mini'
    },
    estimatedCostPerArticle: 0.18,
    qualityScore: 92
  },

  // 高CP值配置（新增）
  costEffective: {
    name: '經濟版',
    description: '保持90%品質，成本降低60%',
    monthlyBudget: '$30-50',
    models: {
      research_model: 'google/gemini-2.5-pro',          // 保留付費（研究關鍵）
      strategy_model: 'google/gemini-2.5-pro',          // 保留付費（策略關鍵）
      writing_model: 'meta-llama/llama-4-maverick:free', // Meta免費模型（無隱私限制）
      meta_model: 'google/gemini-2.0-flash-exp:free',    // Google免費模型（穩定快速）
      image_model: 'none' // 可選擇性啟用
    },
    estimatedCostPerArticle: 0.08,
    qualityScore: 88
  },

  // 最大節省配置
  budget: {
    name: '入門版',
    description: '最低成本，適合個人部落格或測試',
    monthlyBudget: '$10-30',
    models: {
      research_model: 'google/gemini-2.0-flash-exp:free',
      strategy_model: 'deepseek/deepseek-r1:free',
      writing_model: 'deepseek/deepseek-chat-v3.1:free',
      meta_model: 'deepseek/deepseek-chat-v3.1:free',
      image_model: 'none'
    },
    estimatedCostPerArticle: 0.00, // 虛擬成本另計
    qualityScore: 75
  },

  // 實驗性全免費配置（優化版）
  experimental: {
    name: '實驗版',
    description: '全免費模型組合，品質約 75-80%',
    monthlyBudget: '$0',
    models: {
      research_model: 'google/gemini-2.0-flash-exp:free',  // Google 免費快速模型
      strategy_model: 'meta-llama/llama-4-maverick:free',  // Meta 開源模型（邏輯推理）
      writing_model: 'meta-llama/llama-4-maverick:free',   // Meta 開源模型（寫作）
      meta_model: 'google/gemini-2.0-flash-exp:free',      // Google 免費快速模型
      image_model: 'none'
    },
    estimatedCostPerArticle: 0.00,
    qualityScore: 75
  },

  // 激進全免費配置（最新測試）
  ultraFree: {
    name: '零成本版',
    description: '100% 免費模型，適合測試和個人專案',
    monthlyBudget: '$0',
    models: {
      research_model: 'google/gemini-2.0-flash-exp:free',    // 15 RPM，快速分析
      strategy_model: 'huggingface/qwen/qwen-2.5-72b-instruct:free', // HF 免費模型
      writing_model: 'meta-llama/llama-4-maverick:free',     // 30 RPM，創意寫作
      meta_model: 'google/gemini-2.0-flash-exp:free',        // 15 RPM，元數據
      image_model: 'none'
    },
    estimatedCostPerArticle: 0.00,
    qualityScore: 72
  }
};

// 根據月預算推薦配置
export function recommendPreset(monthlyBudget: number): ModelPreset {
  if (monthlyBudget >= 250) return modelPresets.premium;
  if (monthlyBudget >= 50) return modelPresets.balanced;
  if (monthlyBudget >= 30) return modelPresets.costEffective;
  if (monthlyBudget >= 10) return modelPresets.budget;
  return modelPresets.experimental;
}

// 計算虛擬成本（用於向客戶收費）
export function calculateVirtualCost(
  inputTokens: number,
  outputTokens: number
): number {
  // 按 GPT-5 價格計算
  const inputCost = (inputTokens / 1000) * 0.00125;
  const outputCost = (outputTokens / 1000) * 0.01;
  return inputCost + outputCost;
}

// 免費模型限制
export const freeModelLimits = {
  'deepseek/deepseek-chat-v3.1:free': {
    rpm: 50,      // 每分鐘請求數
    tpm: 1000000, // 每分鐘 token 數
    dailyLimit: 10000000 // 每日 token 限制
  },
  'google/gemini-2.0-flash-exp:free': {
    rpm: 15,
    tpm: 1000000,
    dailyLimit: 1500000
  },
  'meta-llama/llama-4-maverick:free': {
    rpm: 30,
    tpm: 500000,
    dailyLimit: 5000000
  },
  'z-ai/glm-4.5-air:free': {
    rpm: 20,
    tpm: 200000,
    dailyLimit: 2000000
  },
  'deepseek/deepseek-r1:free': {
    rpm: 10,
    tpm: 500000,
    dailyLimit: 5000000
  }
};

// 導出選擇器函數
export function selectModelPreset(presetName: string): ModelPreset | undefined {
  return modelPresets[presetName];
}

// 獲取所有預設名稱
export function getPresetNames(): string[] {
  return Object.keys(modelPresets);
}