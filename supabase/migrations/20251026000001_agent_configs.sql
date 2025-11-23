-- Migration: Agent Configs
-- Description: 新增 Agent 配置表，支援每個 Agent 的模型選擇和參數配置

-- ============================================
-- 1. 建立 Agent 配置表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

    research_enabled BOOLEAN DEFAULT true,
    research_model TEXT DEFAULT 'perplexity-sonar',
    research_temperature DECIMAL(3,2) DEFAULT 0.3 CHECK (research_temperature >= 0 AND research_temperature <= 1),
    research_max_tokens INTEGER DEFAULT 2000 CHECK (research_max_tokens > 0),

    strategy_enabled BOOLEAN DEFAULT true,
    strategy_model TEXT DEFAULT 'gpt-4',
    strategy_temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (strategy_temperature >= 0 AND strategy_temperature <= 1),
    strategy_max_tokens INTEGER DEFAULT 3000 CHECK (strategy_max_tokens > 0),

    writing_enabled BOOLEAN DEFAULT true,
    writing_model TEXT DEFAULT 'gpt-4',
    writing_temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (writing_temperature >= 0 AND writing_temperature <= 1),
    writing_max_tokens INTEGER DEFAULT 4000 CHECK (writing_max_tokens > 0),

    image_enabled BOOLEAN DEFAULT true,
    image_model TEXT DEFAULT 'dall-e-3',
    image_quality TEXT DEFAULT 'standard' CHECK (image_quality IN ('standard', 'hd')),
    image_size TEXT DEFAULT '1024x1024',
    image_count INTEGER DEFAULT 3 CHECK (image_count >= 0 AND image_count <= 10),

    meta_enabled BOOLEAN DEFAULT true,
    meta_model TEXT DEFAULT 'gpt-3.5-turbo',
    meta_temperature DECIMAL(3,2) DEFAULT 0.5 CHECK (meta_temperature >= 0 AND meta_temperature <= 1),
    meta_max_tokens INTEGER DEFAULT 500 CHECK (meta_max_tokens > 0),

    quality_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_website FOREIGN KEY (website_id)
        REFERENCES website_configs(id) ON DELETE CASCADE,
    CONSTRAINT unique_website_agent_config UNIQUE (website_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_website_id ON agent_configs(website_id);

COMMENT ON TABLE agent_configs IS 'Agent 配置表（每個網站一組配置）';
COMMENT ON COLUMN agent_configs.research_enabled IS '是否啟用 Research Agent';
COMMENT ON COLUMN agent_configs.research_model IS 'Research Agent 使用的 AI 模型';
COMMENT ON COLUMN agent_configs.research_temperature IS 'Temperature 參數（0-1）';
COMMENT ON COLUMN agent_configs.research_max_tokens IS '最大 token 數量';

-- ============================================
-- 2. 建立 Agent 執行記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,

    CONSTRAINT fk_article_job FOREIGN KEY (article_job_id)
        REFERENCES article_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_job_id ON agent_executions(article_job_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_name ON agent_executions(agent_name);

COMMENT ON TABLE agent_executions IS 'Agent 執行記錄表';
COMMENT ON COLUMN agent_executions.agent_name IS 'Agent 名稱（research, strategy, writing, image, meta, quality）';
COMMENT ON COLUMN agent_executions.execution_time_ms IS '執行時間（毫秒）';

-- ============================================
-- 3. 建立成本追蹤表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd DECIMAL(10,6),
    cost_twd DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_article_job FOREIGN KEY (article_job_id)
        REFERENCES article_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_cost_tracking_job_id ON agent_cost_tracking(article_job_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_tracking_created_at ON agent_cost_tracking(created_at);

COMMENT ON TABLE agent_cost_tracking IS 'Agent 成本追蹤表';
COMMENT ON COLUMN agent_cost_tracking.cost_usd IS '成本（美元）';
COMMENT ON COLUMN agent_cost_tracking.cost_twd IS '成本（新台幣）';

-- ============================================
-- 4. 更新觸發器
-- ============================================
DROP TRIGGER IF EXISTS update_agent_configs_updated_at ON agent_configs;
CREATE TRIGGER update_agent_configs_updated_at
    BEFORE UPDATE ON agent_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. RLS Policies
-- ============================================

-- Agent Configs RLS
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view agent configs for their websites" ON agent_configs;
CREATE POLICY "Users can view agent configs for their websites"
    ON agent_configs FOR SELECT
    USING (
        website_id IN (
            SELECT wc.id
            FROM website_configs wc
            WHERE wc.company_id IN (
                SELECT company_id
                FROM company_members
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage agent configs for their websites" ON agent_configs;
CREATE POLICY "Users can manage agent configs for their websites"
    ON agent_configs FOR ALL
    USING (
        website_id IN (
            SELECT wc.id
            FROM website_configs wc
            WHERE wc.company_id IN (
                SELECT company_id
                FROM company_members
                WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin')
            )
        )
    );

-- Agent Executions RLS
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view agent executions for their jobs" ON agent_executions;
CREATE POLICY "Users can view agent executions for their jobs"
    ON agent_executions FOR SELECT
    USING (
        article_job_id IN (
            SELECT aj.id
            FROM article_jobs aj
            INNER JOIN website_configs wc ON aj.website_id = wc.id
            WHERE wc.company_id IN (
                SELECT company_id
                FROM company_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Agent Cost Tracking RLS
ALTER TABLE agent_cost_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cost tracking for their jobs" ON agent_cost_tracking;
CREATE POLICY "Users can view cost tracking for their jobs"
    ON agent_cost_tracking FOR SELECT
    USING (
        article_job_id IN (
            SELECT aj.id
            FROM article_jobs aj
            INNER JOIN website_configs wc ON aj.website_id = wc.id
            WHERE wc.company_id IN (
                SELECT company_id
                FROM company_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================
-- 6. Helper Views
-- ============================================

-- Agent 執行統計 View
CREATE OR REPLACE VIEW agent_execution_stats AS
SELECT
    ae.agent_name,
    COUNT(*) as total_executions,
    SUM(CASE WHEN ae.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN ae.status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
    ROUND(AVG(ae.execution_time_ms), 2) as avg_execution_time_ms,
    MAX(ae.execution_time_ms) as max_execution_time_ms,
    MIN(ae.execution_time_ms) as min_execution_time_ms
FROM agent_executions ae
WHERE ae.status IN ('completed', 'failed')
GROUP BY ae.agent_name;

COMMENT ON VIEW agent_execution_stats IS 'Agent 執行統計視圖';

-- 每日成本統計 View
CREATE OR REPLACE VIEW daily_cost_stats AS
SELECT
    DATE(act.created_at) as date,
    act.agent_name,
    act.model,
    SUM(act.input_tokens) as total_input_tokens,
    SUM(act.output_tokens) as total_output_tokens,
    SUM(act.cost_usd) as total_cost_usd,
    SUM(act.cost_twd) as total_cost_twd,
    COUNT(*) as execution_count
FROM agent_cost_tracking act
GROUP BY DATE(act.created_at), act.agent_name, act.model
ORDER BY date DESC, total_cost_usd DESC;

COMMENT ON VIEW daily_cost_stats IS '每日成本統計視圖';

-- ============================================
-- 7. Helper Functions
-- ============================================

-- 取得或建立 Agent 配置
CREATE OR REPLACE FUNCTION get_or_create_agent_config(p_website_id UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT id INTO v_id
    FROM agent_configs
    WHERE website_id = p_website_id;

    IF v_id IS NULL THEN
        INSERT INTO agent_configs (website_id)
        VALUES (p_website_id)
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_agent_config IS '取得或建立 Agent 配置';

-- 記錄 Agent 執行
CREATE OR REPLACE FUNCTION log_agent_execution(
    p_article_job_id UUID,
    p_agent_name TEXT,
    p_status TEXT,
    p_execution_time_ms INTEGER,
    p_input_data JSONB DEFAULT NULL,
    p_output_data JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO agent_executions (
        article_job_id,
        agent_name,
        status,
        execution_time_ms,
        input_data,
        output_data,
        error_message,
        completed_at
    ) VALUES (
        p_article_job_id,
        p_agent_name,
        p_status,
        p_execution_time_ms,
        p_input_data,
        p_output_data,
        p_error_message,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_agent_execution IS '記錄 Agent 執行結果';

-- 記錄 Agent 成本
CREATE OR REPLACE FUNCTION log_agent_cost(
    p_article_job_id UUID,
    p_agent_name TEXT,
    p_model TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost_usd DECIMAL,
    p_cost_twd DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO agent_cost_tracking (
        article_job_id,
        agent_name,
        model,
        input_tokens,
        output_tokens,
        cost_usd,
        cost_twd
    ) VALUES (
        p_article_job_id,
        p_agent_name,
        p_model,
        p_input_tokens,
        p_output_tokens,
        p_cost_usd,
        p_cost_twd
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_agent_cost IS '記錄 Agent 成本';

-- ============================================
-- 8. 初始化現有網站的預設配置
-- ============================================

-- 為現有網站建立預設 Agent 配置
INSERT INTO agent_configs (website_id)
SELECT id FROM website_configs
ON CONFLICT (website_id) DO NOTHING;
