-- AI 模型配置表
-- 支援動態新增和管理 AI 模型

-- 模型提供商枚舉
CREATE TYPE ai_provider AS ENUM ('openai', 'anthropic', 'deepseek', 'perplexity', 'nano');

-- 模型類型枚舉
CREATE TYPE ai_model_type AS ENUM ('text', 'image', 'embedding');

-- AI 模型配置表
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider ai_provider NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_type ai_model_type NOT NULL,
  description TEXT,

  -- 能力標籤
  capabilities JSONB DEFAULT '[]'::jsonb,

  -- 定價資訊
  pricing JSONB DEFAULT '{}'::jsonb,

  -- 模型參數限制
  context_window INTEGER,
  max_tokens INTEGER,
  supports_streaming BOOLEAN DEFAULT false,
  supports_json_mode BOOLEAN DEFAULT false,
  supports_function_calling BOOLEAN DEFAULT false,

  -- 圖片模型專用
  image_sizes TEXT[],
  image_quality_options TEXT[],

  -- 狀態
  is_active BOOLEAN DEFAULT true,
  is_deprecated BOOLEAN DEFAULT false,
  deprecated_at TIMESTAMPTZ,
  replacement_model_id UUID REFERENCES ai_models(id),

  -- 元資料
  release_date DATE,
  version TEXT,
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(provider, model_id)
);

-- 索引
CREATE INDEX idx_ai_models_provider ON ai_models(provider);
CREATE INDEX idx_ai_models_type ON ai_models(model_type);
CREATE INDEX idx_ai_models_active ON ai_models(is_active);
CREATE INDEX idx_ai_models_capabilities ON ai_models USING gin(capabilities);

-- RLS 政策（所有用戶可讀取）
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active models"
  ON ai_models FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can manage models"
  ON ai_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE '%@admin.com'
    )
  );

-- 插入預設模型配置

-- OpenAI Text Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, context_window, max_tokens, supports_streaming, supports_json_mode, supports_function_calling, release_date, version, tags) VALUES
('openai', 'gpt-4-turbo', 'GPT-4 Turbo', 'text', '最新的 GPT-4 Turbo 模型，效能優異且成本更低', '["reasoning", "analysis", "creativity", "coding"]', '{"input": 0.01, "output": 0.03, "currency": "USD", "per": 1000}', 128000, 4096, true, true, true, '2024-04-09', '0125-preview', '{"recommended", "latest"}'),
('openai', 'gpt-4', 'GPT-4', 'text', '最強大的 GPT-4 模型，適合複雜任務', '["reasoning", "analysis", "creativity", "coding"]', '{"input": 0.03, "output": 0.06, "currency": "USD", "per": 1000}', 8192, 4096, true, false, true, '2023-03-14', '0613', '{"powerful"}'),
('openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'text', '快速且經濟的模型，適合一般任務', '["general", "fast", "economical"]', '{"input": 0.0005, "output": 0.0015, "currency": "USD", "per": 1000}', 16385, 4096, true, true, true, '2023-03-01', '0125', '{"economical", "fast"}');

-- Anthropic Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, context_window, max_tokens, supports_streaming, supports_json_mode, supports_function_calling, release_date, version, tags) VALUES
('anthropic', 'claude-3-opus-20240229', 'Claude 3 Opus', 'text', 'Claude 3 最強大版本，適合複雜分析和長文寫作', '["reasoning", "analysis", "creativity", "long-form"]', '{"input": 0.015, "output": 0.075, "currency": "USD", "per": 1000}', 200000, 4096, true, false, false, '2024-02-29', '3.0', '{"powerful", "long-context"}'),
('anthropic', 'claude-3-sonnet-20240229', 'Claude 3 Sonnet', 'text', 'Claude 3 平衡版本，效能與成本兼顧', '["balanced", "analysis", "creativity"]', '{"input": 0.003, "output": 0.015, "currency": "USD", "per": 1000}', 200000, 4096, true, false, false, '2024-02-29', '3.0', '{"balanced", "recommended"}'),
('anthropic', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 'text', 'Claude 3 快速版本，適合簡單任務', '["fast", "economical"]', '{"input": 0.00025, "output": 0.00125, "currency": "USD", "per": 1000}', 200000, 4096, true, false, false, '2024-03-07', '3.0', '{"fast", "economical"}');

-- DeepSeek Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, context_window, max_tokens, supports_streaming, supports_json_mode, supports_function_calling, release_date, tags) VALUES
('deepseek', 'deepseek-chat', 'DeepSeek Chat', 'text', '高性價比的中文優化模型', '["chinese", "economical", "general"]', '{"input": 0.0001, "output": 0.0002, "currency": "USD", "per": 1000}', 32768, 4096, true, true, false, '2024-01-01', '{"economical", "chinese"}'),
('deepseek', 'deepseek-coder', 'DeepSeek Coder', 'text', '專為程式設計優化的模型', '["coding", "technical", "economical"]', '{"input": 0.0001, "output": 0.0002, "currency": "USD", "per": 1000}', 32768, 4096, true, true, false, '2024-01-01', '{"coding", "economical"}');

-- Perplexity Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, context_window, max_tokens, supports_streaming, release_date, tags) VALUES
('perplexity', 'sonar', 'Perplexity Sonar', 'text', '具備網路搜尋能力的 AI 模型', '["search", "real-time", "research"]', '{"input": 0.001, "output": 0.001, "currency": "USD", "per": 1000}', 12000, 4000, true, '2024-01-01', '{"search", "research"}'),
('perplexity', 'sonar-pro', 'Perplexity Sonar Pro', 'text', '進階版網路搜尋 AI 模型', '["search", "real-time", "research", "advanced"]', '{"input": 0.003, "output": 0.003, "currency": "USD", "per": 1000}', 12000, 4000, true, '2024-01-01', '{"search", "research", "pro"}');

-- OpenAI Image Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, image_sizes, image_quality_options, release_date, tags) VALUES
('openai', 'dall-e-3', 'DALL-E 3', 'image', '最新的 DALL-E 模型，圖片品質最佳', '["high-quality", "detailed", "creative"]', '{"standard_1024": 0.04, "standard_1792": 0.08, "hd_1024": 0.08, "hd_1792": 0.12, "currency": "USD", "per": "image"}', '{"1024x1024", "1024x1792", "1792x1024"}', '{"standard", "hd"}', '2023-11-01', '{"recommended", "high-quality"}'),
('openai', 'dall-e-2', 'DALL-E 2', 'image', '經濟實惠的圖片生成模型', '["economical", "general"]', '{"256": 0.016, "512": 0.018, "1024": 0.02, "currency": "USD", "per": "image"}', '{"256x256", "512x512", "1024x1024"}', '{"standard"}', '2022-04-06', '{"economical"}'),
('openai', 'chatgpt-image-mini', 'ChatGPT Image Mini', 'image', '輕量級圖片生成模型', '["fast", "economical"]', '{"1024": 0.015, "currency": "USD", "per": "image"}', '{"1024x1024"}', '{"standard"}', '2024-01-01', '{"economical", "fast"}');

-- Nano Image Models
INSERT INTO ai_models (provider, model_id, model_name, model_type, description, capabilities, pricing, image_sizes, image_quality_options, release_date, tags) VALUES
('nano', 'nano-banana', 'Nano Banana', 'image', '超快速且經濟的圖片生成模型', '["ultra-fast", "economical"]', '{"1024": 0.01, "currency": "USD", "per": "image"}', '{"1024x1024"}', '{"standard"}', '2024-01-01', '{"economical", "fast"}');

-- 更新時間戳記觸發器
CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_models_updated_at();

-- 輔助函數：取得活躍的文字模型
CREATE OR REPLACE FUNCTION get_active_text_models()
RETURNS TABLE (
  id UUID,
  provider ai_provider,
  model_id TEXT,
  model_name TEXT,
  description TEXT,
  capabilities JSONB,
  pricing JSONB,
  context_window INTEGER,
  max_tokens INTEGER,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.provider,
    m.model_id,
    m.model_name,
    m.description,
    m.capabilities,
    m.pricing,
    m.context_window,
    m.max_tokens,
    m.tags
  FROM ai_models m
  WHERE m.model_type = 'text'
    AND m.is_active = true
    AND m.is_deprecated = false
  ORDER BY m.provider, m.model_id;
END;
$$ LANGUAGE plpgsql;

-- 輔助函數：取得活躍的圖片模型
CREATE OR REPLACE FUNCTION get_active_image_models()
RETURNS TABLE (
  id UUID,
  provider ai_provider,
  model_id TEXT,
  model_name TEXT,
  description TEXT,
  capabilities JSONB,
  pricing JSONB,
  image_sizes TEXT[],
  image_quality_options TEXT[],
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.provider,
    m.model_id,
    m.model_name,
    m.description,
    m.capabilities,
    m.pricing,
    m.image_sizes,
    m.image_quality_options,
    m.tags
  FROM ai_models m
  WHERE m.model_type = 'image'
    AND m.is_active = true
    AND m.is_deprecated = false
  ORDER BY m.provider, m.model_id;
END;
$$ LANGUAGE plpgsql;

-- 輔助函數：依據 provider 取得模型
CREATE OR REPLACE FUNCTION get_models_by_provider(p_provider ai_provider)
RETURNS TABLE (
  id UUID,
  model_id TEXT,
  model_name TEXT,
  model_type ai_model_type,
  description TEXT,
  capabilities JSONB,
  pricing JSONB,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.model_id,
    m.model_name,
    m.model_type,
    m.description,
    m.capabilities,
    m.pricing,
    m.tags
  FROM ai_models m
  WHERE m.provider = p_provider
    AND m.is_active = true
    AND m.is_deprecated = false
  ORDER BY m.model_type, m.model_id;
END;
$$ LANGUAGE plpgsql;
