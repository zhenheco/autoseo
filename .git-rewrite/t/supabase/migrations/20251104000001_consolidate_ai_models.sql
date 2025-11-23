-- ============================================
-- Migration: Consolidate AI Models
-- Description: 整合所有 AI 模型配置,支援混合 API 策略和處理階段分級
-- Author: Claude Code
-- Date: 2025-11-04
-- ============================================

-- ============================================
-- 1. 新增欄位到 ai_models 表
-- ============================================

-- 新增 api_provider 欄位（區分 API 來源）
ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS api_provider TEXT
CHECK (api_provider IN ('deepseek', 'openrouter', 'openai', 'perplexity'));

-- 新增 processing_tier 欄位（處理階段分級）
ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS processing_tier TEXT
CHECK (processing_tier IN ('complex', 'simple', 'both', 'fixed'));

-- 新增 token_billing_multiplier 欄位（token 計費倍數，預設 2.0）
ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS token_billing_multiplier DECIMAL(3,1) DEFAULT 2.0;

COMMENT ON COLUMN ai_models.api_provider IS 'API 來源：deepseek (官方API), openrouter (OpenRouter), openai (官方API), perplexity (官方API)';
COMMENT ON COLUMN ai_models.processing_tier IS '處理階段：complex (複雜處理), simple (簡單功能), both (兩者皆可), fixed (固定用途)';
COMMENT ON COLUMN ai_models.token_billing_multiplier IS 'Token 計費倍數（預設 2.0）';

-- ============================================
-- 2. 新增模型記錄
-- ============================================

-- 2.1 DeepSeek 官方 API 模型
INSERT INTO ai_models (
  provider,
  model_id,
  model_name,
  model_type,
  api_provider,
  processing_tier,
  context_length,
  pricing,
  token_billing_multiplier,
  is_active,
  is_featured,
  sort_order,
  metadata
) VALUES
-- DeepSeek Reasoner (複雜處理)
(
  'deepseek',
  'deepseek-reasoner',
  'DeepSeek Reasoner',
  'text',
  'deepseek',
  'complex',
  64000,
  '{"prompt": 0.00055, "completion": 0.00219}'::jsonb,
  2.0,
  true,
  true,
  1,
  '{"description": "DeepSeek 推理模型，適合研究與策略規劃", "capabilities": ["reasoning", "analysis", "research"]}'::jsonb
),
-- DeepSeek Chat (簡單功能)
(
  'deepseek',
  'deepseek-chat',
  'DeepSeek Chat',
  'text',
  'deepseek',
  'simple',
  64000,
  '{"prompt": 0.00014, "completion": 0.00028}'::jsonb,
  2.0,
  true,
  true,
  2,
  '{"description": "DeepSeek 對話模型，適合寫作、分類、標籤", "capabilities": ["writing", "classification", "tagging"]}'::jsonb
)
ON CONFLICT (model_id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  api_provider = EXCLUDED.api_provider,
  processing_tier = EXCLUDED.processing_tier,
  pricing = EXCLUDED.pricing,
  token_billing_multiplier = EXCLUDED.token_billing_multiplier,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2.2 OpenRouter API 模型（OpenAI）
INSERT INTO ai_models (
  provider,
  model_id,
  model_name,
  model_type,
  api_provider,
  processing_tier,
  context_length,
  pricing,
  token_billing_multiplier,
  is_active,
  is_featured,
  sort_order,
  metadata
) VALUES
-- GPT-5
(
  'openai',
  'openai/gpt-5',
  'GPT-5',
  'text',
  'openrouter',
  'complex',
  200000,
  '{"prompt": 0.0025, "completion": 0.01}'::jsonb,
  2.0,
  true,
  true,
  3,
  '{"description": "OpenAI GPT-5，頂級複雜任務處理", "capabilities": ["reasoning", "analysis", "creativity"]}'::jsonb
),
-- GPT-5 Mini
(
  'openai',
  'openai/gpt-5-mini',
  'GPT-5 Mini',
  'text',
  'openrouter',
  'simple',
  128000,
  '{"prompt": 0.0003, "completion": 0.0012}'::jsonb,
  2.0,
  true,
  true,
  4,
  '{"description": "OpenAI GPT-5 Mini，快速經濟的簡單任務", "capabilities": ["fast", "economical"]}'::jsonb
),
-- GPT-4o Mini (更新)
(
  'openai',
  'openai/gpt-4o-mini',
  'GPT-4o Mini',
  'text',
  'openrouter',
  'simple',
  128000,
  '{"prompt": 0.00015, "completion": 0.0006}'::jsonb,
  2.0,
  true,
  false,
  5,
  '{"description": "GPT-4o Mini，經濟實惠", "capabilities": ["fast", "economical"]}'::jsonb
)
ON CONFLICT (model_id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  api_provider = EXCLUDED.api_provider,
  processing_tier = EXCLUDED.processing_tier,
  pricing = EXCLUDED.pricing,
  token_billing_multiplier = EXCLUDED.token_billing_multiplier,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 更新現有的 GPT-4o
UPDATE ai_models
SET
  api_provider = 'openrouter',
  processing_tier = 'both',
  token_billing_multiplier = 2.0,
  updated_at = NOW()
WHERE model_id = 'openai/gpt-4o';

-- 2.3 OpenRouter API 模型（Google）
INSERT INTO ai_models (
  provider,
  model_id,
  model_name,
  model_type,
  api_provider,
  processing_tier,
  context_length,
  pricing,
  token_billing_multiplier,
  is_active,
  is_featured,
  sort_order,
  metadata
) VALUES
-- Gemini 2.5 Pro
(
  'google',
  'google/gemini-2.5-pro',
  'Gemini 2.5 Pro',
  'text',
  'openrouter',
  'complex',
  1000000,
  '{"prompt": 0.00125, "completion": 0.00375}'::jsonb,
  2.0,
  true,
  true,
  6,
  '{"description": "Google Gemini 2.5 Pro，強大複雜任務處理", "capabilities": ["reasoning", "multimodal", "long-context"]}'::jsonb
),
-- Gemini 2.5 Flash
(
  'google',
  'google/gemini-2.5-flash',
  'Gemini 2.5 Flash',
  'text',
  'openrouter',
  'complex',
  1000000,
  '{"prompt": 0.000075, "completion": 0.0003}'::jsonb,
  2.0,
  true,
  true,
  7,
  '{"description": "Google Gemini 2.5 Flash，快速複雜任務", "capabilities": ["fast", "multimodal"]}'::jsonb
)
ON CONFLICT (model_id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  api_provider = EXCLUDED.api_provider,
  processing_tier = EXCLUDED.processing_tier,
  pricing = EXCLUDED.pricing,
  token_billing_multiplier = EXCLUDED.token_billing_multiplier,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2.4 OpenRouter API 模型（Anthropic）
-- 更新 Claude Sonnet 4.5
UPDATE ai_models
SET
  model_id = 'anthropic/claude-sonnet-4.5',
  model_name = 'Claude Sonnet 4.5',
  api_provider = 'openrouter',
  processing_tier = 'both',
  pricing = '{"prompt": 0.003, "completion": 0.015}'::jsonb,
  token_billing_multiplier = 2.0,
  metadata = '{"description": "Claude Sonnet 4.5，最新平衡版本", "capabilities": ["balanced", "analysis", "creativity"]}'::jsonb,
  updated_at = NOW()
WHERE model_id = 'anthropic/claude-3.5-sonnet';

-- 如果舊記錄不存在，則插入新記錄
INSERT INTO ai_models (
  provider,
  model_id,
  model_name,
  model_type,
  api_provider,
  processing_tier,
  context_length,
  pricing,
  token_billing_multiplier,
  is_active,
  is_featured,
  sort_order,
  metadata
) VALUES
(
  'anthropic',
  'anthropic/claude-sonnet-4.5',
  'Claude Sonnet 4.5',
  'text',
  'openrouter',
  'both',
  200000,
  '{"prompt": 0.003, "completion": 0.015}'::jsonb,
  2.0,
  true,
  true,
  8,
  '{"description": "Claude Sonnet 4.5，最新平衡版本", "capabilities": ["balanced", "analysis", "creativity"]}'::jsonb
)
ON CONFLICT (model_id) DO NOTHING;

-- 2.5 OpenAI 官方 API（圖片生成）
INSERT INTO ai_models (
  provider,
  model_id,
  model_name,
  model_type,
  api_provider,
  processing_tier,
  pricing,
  token_billing_multiplier,
  is_active,
  is_featured,
  sort_order,
  metadata
) VALUES
(
  'openai',
  'gpt-image-1-mini',
  'GPT Image 1 Mini',
  'image',
  'openai',
  'fixed',
  '{"prompt": 0.015, "completion": 0}'::jsonb,
  1.0,
  true,
  true,
  1,
  '{"description": "輕量級圖片生成，快速經濟", "capabilities": ["image-generation", "fast", "economical"]}'::jsonb
)
ON CONFLICT (model_id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  api_provider = EXCLUDED.api_provider,
  processing_tier = EXCLUDED.processing_tier,
  pricing = EXCLUDED.pricing,
  token_billing_multiplier = EXCLUDED.token_billing_multiplier,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2.6 更新現有 OpenRouter 模型
UPDATE ai_models
SET
  api_provider = 'openrouter',
  token_billing_multiplier = 2.0,
  updated_at = NOW()
WHERE provider IN ('openai', 'anthropic', 'google', 'meta-llama')
  AND api_provider IS NULL;

-- ============================================
-- 3. 更新 agent_configs 表結構
-- ============================================

-- 新增複雜處理模型欄位
ALTER TABLE agent_configs
ADD COLUMN IF NOT EXISTS complex_processing_model TEXT DEFAULT 'deepseek-reasoner';

-- 新增簡單功能模型欄位
ALTER TABLE agent_configs
ADD COLUMN IF NOT EXISTS simple_processing_model TEXT DEFAULT 'deepseek-chat';

-- 新增圖片生成模型欄位（覆蓋現有 image_model）
ALTER TABLE agent_configs
ALTER COLUMN image_model SET DEFAULT 'gpt-image-1-mini';

-- 新增搜尋模型欄位（保持 research_model 不變，但加上說明）
COMMENT ON COLUMN agent_configs.research_model IS '搜尋研究模型（預設使用 Perplexity）';
COMMENT ON COLUMN agent_configs.complex_processing_model IS '複雜處理階段模型（研究、策略規劃）';
COMMENT ON COLUMN agent_configs.simple_processing_model IS '簡單功能階段模型（寫作、分類、標籤）';

-- 更新現有 agent_configs 記錄
UPDATE agent_configs
SET
  complex_processing_model = 'deepseek-reasoner',
  simple_processing_model = 'deepseek-chat',
  image_model = 'gpt-image-1-mini',
  updated_at = NOW()
WHERE complex_processing_model IS NULL;

-- ============================================
-- 4. 更新 agent_cost_tracking 以支援計費倍數
-- ============================================

-- 新增計費 tokens 欄位
ALTER TABLE agent_cost_tracking
ADD COLUMN IF NOT EXISTS billing_input_tokens INTEGER;

ALTER TABLE agent_cost_tracking
ADD COLUMN IF NOT EXISTS billing_output_tokens INTEGER;

COMMENT ON COLUMN agent_cost_tracking.billing_input_tokens IS '計費用的輸入 tokens（套用倍數後）';
COMMENT ON COLUMN agent_cost_tracking.billing_output_tokens IS '計費用的輸出 tokens（套用倍數後）';

-- 更新現有記錄的計費 tokens（假設倍數為 2.0）
UPDATE agent_cost_tracking
SET
  billing_input_tokens = input_tokens * 2,
  billing_output_tokens = output_tokens * 2
WHERE billing_input_tokens IS NULL;

-- ============================================
-- 5. 建立輔助函數
-- ============================================

-- 5.1 取得複雜處理模型列表
CREATE OR REPLACE FUNCTION get_complex_processing_models()
RETURNS TABLE (
  id UUID,
  model_id TEXT,
  model_name TEXT,
  api_provider TEXT,
  context_length INTEGER,
  pricing JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.model_id,
    m.model_name,
    m.api_provider,
    m.context_length,
    m.pricing
  FROM ai_models m
  WHERE m.model_type = 'text'
    AND m.processing_tier IN ('complex', 'both')
    AND m.is_active = true
  ORDER BY
    CASE m.api_provider
      WHEN 'deepseek' THEN 1
      WHEN 'openrouter' THEN 2
      ELSE 3
    END,
    m.sort_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_complex_processing_models IS '取得所有可用於複雜處理的模型';

-- 5.2 取得簡單功能模型列表
CREATE OR REPLACE FUNCTION get_simple_processing_models()
RETURNS TABLE (
  id UUID,
  model_id TEXT,
  model_name TEXT,
  api_provider TEXT,
  context_length INTEGER,
  pricing JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.model_id,
    m.model_name,
    m.api_provider,
    m.context_length,
    m.pricing
  FROM ai_models m
  WHERE m.model_type = 'text'
    AND m.processing_tier IN ('simple', 'both')
    AND m.is_active = true
  ORDER BY
    CASE m.api_provider
      WHEN 'deepseek' THEN 1
      WHEN 'openrouter' THEN 2
      ELSE 3
    END,
    m.sort_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_simple_processing_models IS '取得所有可用於簡單功能的模型';

-- 5.3 取得模型的實際計費 tokens
CREATE OR REPLACE FUNCTION calculate_billing_tokens(
  p_model_id TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
) RETURNS TABLE (
  billing_input_tokens INTEGER,
  billing_output_tokens INTEGER,
  total_billing_tokens INTEGER
) AS $$
DECLARE
  v_multiplier DECIMAL(3,1);
BEGIN
  -- 取得該模型的計費倍數
  SELECT token_billing_multiplier INTO v_multiplier
  FROM ai_models
  WHERE model_id = p_model_id
  LIMIT 1;

  -- 如果找不到模型，使用預設倍數 2.0
  IF v_multiplier IS NULL THEN
    v_multiplier := 2.0;
  END IF;

  -- 計算計費 tokens
  RETURN QUERY
  SELECT
    (p_input_tokens * v_multiplier)::INTEGER as billing_input_tokens,
    (p_output_tokens * v_multiplier)::INTEGER as billing_output_tokens,
    ((p_input_tokens + p_output_tokens) * v_multiplier)::INTEGER as total_billing_tokens;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_billing_tokens IS '計算模型的實際計費 tokens（套用倍數）';

-- 5.4 取得模型的 Fallback 鏈
CREATE OR REPLACE FUNCTION get_model_fallback_chain(
  p_processing_tier TEXT
) RETURNS TEXT[] AS $$
BEGIN
  IF p_processing_tier = 'complex' THEN
    -- 複雜處理 Fallback 鏈
    RETURN ARRAY[
      'deepseek-reasoner',
      'openai/gpt-5',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'anthropic/claude-sonnet-4.5'
    ];
  ELSIF p_processing_tier = 'simple' THEN
    -- 簡單功能 Fallback 鏈
    RETURN ARRAY[
      'deepseek-chat',
      'openai/gpt-5-mini',
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4.5'
    ];
  ELSE
    -- 預設返回空陣列
    RETURN ARRAY[]::TEXT[];
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_model_fallback_chain IS '取得指定處理階段的模型 Fallback 鏈';

-- ============================================
-- 6. 建立索引以優化查詢效能
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ai_models_api_provider ON ai_models(api_provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_processing_tier ON ai_models(processing_tier);
CREATE INDEX IF NOT EXISTS idx_ai_models_api_provider_tier ON ai_models(api_provider, processing_tier) WHERE is_active = true;
