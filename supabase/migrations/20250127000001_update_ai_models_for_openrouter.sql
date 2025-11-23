-- 更新 AI 模型表結構以支援 OpenRouter

-- 1. 先備份舊資料（如果需要）
-- CREATE TABLE ai_models_backup AS SELECT * FROM ai_models;

-- 2. 刪除舊的 ai_models 表和相關物件
DROP TABLE IF EXISTS ai_models CASCADE;
DROP TABLE IF EXISTS agent_executions CASCADE;

-- 3. 重新建立 ai_models 表（OpenRouter 版本）
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'openrouter',
    model_id TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('text', 'image', 'multimodal')),
    context_length INTEGER,
    capabilities JSONB DEFAULT '{}'::jsonb,
    pricing JSONB DEFAULT '{
        "prompt": 0,
        "completion": 0
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    openrouter_data JSONB,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_models_provider ON ai_models(provider);
CREATE INDEX idx_ai_models_type ON ai_models(model_type);
CREATE INDEX idx_ai_models_active ON ai_models(is_active);
CREATE INDEX idx_ai_models_featured ON ai_models(is_featured);

-- 4. 插入預設模型（OpenRouter 格式）
INSERT INTO ai_models (model_id, model_name, model_type, context_length, pricing, is_featured, sort_order) VALUES
-- OpenAI 模型
('openai/gpt-4-turbo', 'GPT-4 Turbo', 'text', 128000,
 '{"prompt": 0.01, "completion": 0.03}'::jsonb, true, 1),

('openai/gpt-4o', 'GPT-4o', 'text', 128000,
 '{"prompt": 0.005, "completion": 0.015}'::jsonb, true, 2),

('openai/gpt-3.5-turbo', 'GPT-3.5 Turbo', 'text', 16385,
 '{"prompt": 0.0005, "completion": 0.0015}'::jsonb, false, 3),

-- Anthropic 模型
('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'text', 200000,
 '{"prompt": 0.003, "completion": 0.015}'::jsonb, true, 4),

('anthropic/claude-3-opus', 'Claude 3 Opus', 'text', 200000,
 '{"prompt": 0.015, "completion": 0.075}'::jsonb, true, 5),

('anthropic/claude-3-haiku', 'Claude 3 Haiku', 'text', 200000,
 '{"prompt": 0.00025, "completion": 0.00125}'::jsonb, false, 6),

-- Google 模型
('google/gemini-pro-1.5', 'Gemini 1.5 Pro', 'text', 2000000,
 '{"prompt": 0.00125, "completion": 0.005}'::jsonb, true, 7),

('google/gemini-flash-1.5', 'Gemini 1.5 Flash', 'text', 1000000,
 '{"prompt": 0.000075, "completion": 0.0003}'::jsonb, false, 8),

-- Meta 模型
('meta-llama/llama-3.1-405b-instruct', 'Llama 3.1 405B', 'text', 131072,
 '{"prompt": 0.0027, "completion": 0.0027}'::jsonb, true, 9),

('meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 'text', 131072,
 '{"prompt": 0.00052, "completion": 0.00052}'::jsonb, false, 10);

-- 圖片模型
INSERT INTO ai_models (model_id, model_name, model_type, pricing, is_featured, sort_order) VALUES
('openai/dall-e-3', 'DALL-E 3', 'image',
 '{"prompt": 0.04, "completion": 0}'::jsonb, true, 1),

('openai/dall-e-2', 'DALL-E 2', 'image',
 '{"prompt": 0.02, "completion": 0}'::jsonb, false, 2);

-- 5. 新增公司 AI 模型偏好欄位
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ai_model_preferences JSONB DEFAULT '{
    "text_model": "anthropic/claude-3.5-sonnet",
    "image_model": "openai/dall-e-3",
    "fallback_text_model": "openai/gpt-4o",
    "fallback_image_model": "openai/dall-e-2"
}'::jsonb;

-- 6. 重新建立 agent_executions 表
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    ai_model_id UUID REFERENCES ai_models(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    token_usage JSONB DEFAULT '{
        "input_tokens": 0,
        "output_tokens": 0,
        "total_cost": 0
    }'::jsonb,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_executions_job_id ON agent_executions(article_job_id);
CREATE INDEX idx_agent_executions_agent_name ON agent_executions(agent_name);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_executions_started_at ON agent_executions(started_at);
CREATE INDEX idx_agent_executions_model_id ON agent_executions(ai_model_id);

-- 7. 自動更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_models_updated_at
    BEFORE UPDATE ON ai_models
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_models_updated_at();

-- 8. RLS 政策
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- 所有已登入使用者可以讀取活躍的 AI 模型
CREATE POLICY "policy_ai_models_select_authenticated"
    ON ai_models FOR SELECT
    TO authenticated
    USING (is_active = true);

-- 只有管理員可以修改 AI 模型
CREATE POLICY "policy_ai_models_admin_all"
    ON ai_models FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM company_members cm
            WHERE cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'admin')
        )
    );

-- Agent 執行記錄的存取控制
CREATE POLICY "policy_agent_executions_select_own_company"
    ON agent_executions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM article_jobs aj
            JOIN company_members cm ON aj.company_id = cm.company_id
            WHERE aj.id = agent_executions.article_job_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "policy_agent_executions_insert_system"
    ON agent_executions FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 9. 輔助函數：取得公司的 AI 模型偏好
CREATE OR REPLACE FUNCTION get_company_ai_models(company_id_param UUID)
RETURNS TABLE (
    text_model_id TEXT,
    text_model_name TEXT,
    image_model_id TEXT,
    image_model_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (ai_model_preferences->>'text_model')::TEXT as text_model_id,
        (SELECT model_name FROM ai_models WHERE model_id = (ai_model_preferences->>'text_model'))::TEXT as text_model_name,
        (ai_model_preferences->>'image_model')::TEXT as image_model_id,
        (SELECT model_name FROM ai_models WHERE model_id = (ai_model_preferences->>'image_model'))::TEXT as image_model_name
    FROM companies
    WHERE id = company_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 統計函數：Agent 執行統計
CREATE OR REPLACE FUNCTION get_agent_execution_stats(
    company_id_param UUID,
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    agent_name TEXT,
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    avg_execution_time_ms NUMERIC,
    total_cost NUMERIC,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ae.agent_name,
        COUNT(*)::BIGINT as total_executions,
        COUNT(*) FILTER (WHERE ae.status = 'completed')::BIGINT as successful_executions,
        COUNT(*) FILTER (WHERE ae.status = 'failed')::BIGINT as failed_executions,
        ROUND(AVG(ae.execution_time_ms)::NUMERIC, 2) as avg_execution_time_ms,
        ROUND(SUM((ae.token_usage->>'total_cost')::NUMERIC), 4) as total_cost,
        ROUND(
            (COUNT(*) FILTER (WHERE ae.status = 'completed')::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0) * 100),
            2
        ) as success_rate
    FROM agent_executions ae
    JOIN article_jobs aj ON ae.article_job_id = aj.id
    WHERE aj.company_id = company_id_param
    AND ae.started_at >= start_date
    AND ae.started_at <= end_date
    GROUP BY ae.agent_name
    ORDER BY total_executions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 註解
COMMENT ON TABLE ai_models IS 'AI 模型配置表（透過 OpenRouter 統一管理）';
COMMENT ON TABLE agent_executions IS 'Agent 執行記錄表，用於監控和分析';
COMMENT ON COLUMN companies.ai_model_preferences IS '公司的 AI 模型偏好設定（OpenRouter 模型 ID）';
COMMENT ON FUNCTION get_company_ai_models IS '取得公司設定的 AI 模型資訊';
COMMENT ON FUNCTION get_agent_execution_stats IS '取得 Agent 執行統計資料（過去 30 天）';
