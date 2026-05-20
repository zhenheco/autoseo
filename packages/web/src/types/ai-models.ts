/**
 * AI 模型相關型別定義
 * 支援混合 API 策略（DeepSeek 官方、OpenRouter、OpenAI 官方、Perplexity）
 */

// ============================================
// 基礎型別
// ============================================

/**
 * API Provider 類型
 */
export type APIProvider =
  | "deepseek"
  | "openai"
  | "openrouter"
  | "perplexity"
  | "gemini";

/**
 * 處理階段類型
 */
export type ProcessingTier = "complex" | "simple" | "both" | "fixed";

/**
 * 模型類型
 */
export type ModelType = "text" | "image" | "multimodal";

/**
 * AI 模型資訊
 */
export interface AIModel {
  id: string;
  provider: string;
  model_id: string;
  model_name: string;
  model_type: ModelType;
  api_provider: APIProvider;
  processing_tier: ProcessingTier;
  context_length?: number;
  pricing: {
    prompt: number;
    completion: number;
    currency?: string;
    per?: number | string;
  };
  token_billing_multiplier: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  metadata?: {
    description?: string;
    capabilities?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Agent 配置（更新版）
 */
export interface AgentConfigExtended {
  id: string;
  website_id: string;

  // 複雜處理階段（研究、策略）
  complex_processing_model: string;

  // 簡單功能階段（寫作、分類、標籤）
  simple_processing_model: string;

  // 圖片生成
  image_model: string;
  image_quality: "low" | "medium" | "high" | "auto";
  image_size: string;
  image_count: number;

  // 搜尋研究（Perplexity）
  research_model: string;
  research_temperature: number;
  research_max_tokens: number;

  // Meta 資料生成
  meta_enabled: boolean;
  meta_model: string;
  meta_temperature: number;
  meta_max_tokens: number;

  // 品質檢查
  quality_enabled: boolean;

  created_at: string;
  updated_at: string;
}

// ============================================
// Fallback 鏈相關
// ============================================

/**
 * Fallback 鏈配置
 */
export interface FallbackChain {
  processing_tier: ProcessingTier;
  models: string[];
}

/**
 * 預設 Fallback 鏈
 */
export const DEFAULT_FALLBACK_CHAINS: Record<string, string[]> = {
  complex: [
    "deepseek-reasoner",
    "openai/gpt-5",
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4.5",
  ],
  simple: [
    "deepseek-chat",
    "openai/gpt-5-mini",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-sonnet-4.5",
  ],
};

// ============================================
// Token 計費相關
// ============================================

/**
 * Token 使用統計
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  billing_input_tokens?: number;
  billing_output_tokens?: number;
  total_billing_tokens?: number;
}

/**
 * Token 計費計算結果
 */
export interface BillingTokens {
  billing_input_tokens: number;
  billing_output_tokens: number;
  total_billing_tokens: number;
}

/**
 * 成本計算結果
 */
export interface CostCalculation {
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
  billing_multiplier: number;
}

// ============================================
// API 客戶端相關
// ============================================

/**
 * DeepSeek API 選項
 */
export interface DeepSeekAPIOptions {
  model: "deepseek-reasoner" | "deepseek-chat";
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: "text" | "json";
}

/**
 * OpenAI Image API 選項
 */
export interface OpenAIImageAPIOptions {
  model: string;
  prompt: string;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  n?: number;
}

/**
 * Perplexity API 選項
 */
export interface PerplexityAPIOptions {
  model?: string;
  query: string;
  temperature?: number;
  max_tokens?: number;
  search_domain_filter?: string[];
  search_recency_filter?: "day" | "week" | "month" | "year";
}

/**
 * 統一 API 回應格式
 */
export interface UnifiedAPIResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  api_provider: APIProvider;
  cost?: CostCalculation;
}

// ============================================
// 模型選擇相關
// ============================================

/**
 * 模型選擇條件
 */
export interface ModelSelectionCriteria {
  processing_tier: ProcessingTier;
  model_type?: ModelType;
  max_tokens?: number;
  preferred_provider?: APIProvider;
  exclude_models?: string[];
}

/**
 * 模型選擇結果
 */
export interface ModelSelectionResult {
  model: AIModel;
  fallback_chain: string[];
  api_provider: APIProvider;
}

// ============================================
// 模型管理 API
// ============================================

/**
 * 取得模型列表請求
 */
export interface GetModelsRequest {
  processing_tier?: ProcessingTier;
  model_type?: ModelType;
  api_provider?: APIProvider;
  is_active?: boolean;
}

/**
 * 取得模型列表回應
 */
export interface GetModelsResponse {
  models: AIModel[];
  total: number;
}

/**
 * 更新 Agent 配置請求
 */
export interface UpdateAgentConfigRequest {
  website_id: string;
  complex_processing_model?: string;
  simple_processing_model?: string;
  image_model?: string;
  research_model?: string;
  meta_model?: string;
}

/**
 * 更新 Agent 配置回應
 */
export interface UpdateAgentConfigResponse {
  success: boolean;
  config: AgentConfigExtended;
}

// ============================================
// 成本追蹤相關
// ============================================

/**
 * Agent 成本追蹤記錄
 */
export interface AgentCostTracking {
  id: string;
  article_job_id: string;
  agent_name: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  billing_input_tokens: number;
  billing_output_tokens: number;
  cost_usd: number;
  cost_twd: number;
  created_at: string;
}

/**
 * 成本統計
 */
export interface CostStats {
  total_cost_usd: number;
  total_cost_twd: number;
  total_tokens: number;
  total_billing_tokens: number;
  by_agent: Record<
    string,
    {
      cost_usd: number;
      cost_twd: number;
      tokens: number;
      billing_tokens: number;
    }
  >;
  by_model: Record<
    string,
    {
      cost_usd: number;
      cost_twd: number;
      tokens: number;
      billing_tokens: number;
    }
  >;
}

// ============================================
// 輔助函數型別
// ============================================

/**
 * 模型驗證函數
 */
export type ModelValidator = (modelId: string) => boolean;

/**
 * 成本計算函數
 */
export type CostCalculator = (
  inputTokens: number,
  outputTokens: number,
  model: AIModel,
) => CostCalculation;

/**
 * Fallback 選擇函數
 */
export type FallbackSelector = (
  currentModel: string,
  processingTier: ProcessingTier,
) => string | null;
