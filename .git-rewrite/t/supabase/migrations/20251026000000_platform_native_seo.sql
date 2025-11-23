-- Migration: Platform Native SEO
-- Description: 新增品牌聲音、工作流設定、關鍵字管理功能
-- 讓 Platform 可以獨立執行 SEO 文章生成，不依賴 N8N

-- ============================================
-- 1. 更新 website_configs 表
-- ============================================
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'zh-TW',
ADD COLUMN IF NOT EXISTS wp_username TEXT,
ADD COLUMN IF NOT EXISTS wp_app_password TEXT,
ADD COLUMN IF NOT EXISTS wp_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN website_configs.language IS '網站語言（zh-TW, zh-CN, en, ja）';
COMMENT ON COLUMN website_configs.wp_username IS 'WordPress 使用者名稱';
COMMENT ON COLUMN website_configs.wp_app_password IS 'WordPress 應用程式密碼（加密）';
COMMENT ON COLUMN website_configs.wp_enabled IS '是否啟用 WordPress 整合';

-- ============================================
-- 2. 建立品牌聲音表
-- ============================================
CREATE TABLE IF NOT EXISTS brand_voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

    tone_of_voice TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',

    sentence_style TEXT,
    interactivity TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_website FOREIGN KEY (website_id) REFERENCES website_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brand_voices_website_id ON brand_voices(website_id);

COMMENT ON TABLE brand_voices IS '品牌聲音設定表';
COMMENT ON COLUMN brand_voices.tone_of_voice IS '語調（如：Friendly and professional）';
COMMENT ON COLUMN brand_voices.target_audience IS '目標受眾（如：年輕專業人士）';
COMMENT ON COLUMN brand_voices.keywords IS '品牌必用詞彙陣列';
COMMENT ON COLUMN brand_voices.sentence_style IS '句式風格';
COMMENT ON COLUMN brand_voices.interactivity IS '互動性描述';

-- ============================================
-- 3. 建立工作流設定表
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

    serp_analysis_enabled BOOLEAN DEFAULT true,
    competitor_count INTEGER DEFAULT 10 CHECK (competitor_count >= 1 AND competitor_count <= 20),

    content_length_min INTEGER DEFAULT 1500 CHECK (content_length_min >= 500),
    content_length_max INTEGER DEFAULT 2500 CHECK (content_length_max >= content_length_min),
    keyword_density_min DECIMAL(5,2) DEFAULT 1.5 CHECK (keyword_density_min >= 0),
    keyword_density_max DECIMAL(5,2) DEFAULT 2.5 CHECK (keyword_density_max >= keyword_density_min),

    quality_threshold INTEGER DEFAULT 80 CHECK (quality_threshold >= 0 AND quality_threshold <= 100),
    auto_publish BOOLEAN DEFAULT false,

    serp_model TEXT DEFAULT 'perplexity-sonar',
    content_model TEXT DEFAULT 'gpt-4',
    meta_model TEXT DEFAULT 'gpt-3.5-turbo',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_website FOREIGN KEY (website_id) REFERENCES website_configs(id) ON DELETE CASCADE,
    CONSTRAINT unique_website_workflow UNIQUE (website_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_settings_website_id ON workflow_settings(website_id);

COMMENT ON TABLE workflow_settings IS '工作流設定表';
COMMENT ON COLUMN workflow_settings.serp_analysis_enabled IS '是否啟用 SERP 分析';
COMMENT ON COLUMN workflow_settings.competitor_count IS '競爭對手分析數量';
COMMENT ON COLUMN workflow_settings.content_length_min IS '內容最小字數';
COMMENT ON COLUMN workflow_settings.content_length_max IS '內容最大字數';
COMMENT ON COLUMN workflow_settings.keyword_density_min IS '關鍵字密度下限（%）';
COMMENT ON COLUMN workflow_settings.keyword_density_max IS '關鍵字密度上限（%）';
COMMENT ON COLUMN workflow_settings.quality_threshold IS '品質門檻分數（0-100）';
COMMENT ON COLUMN workflow_settings.auto_publish IS '是否自動發布';
COMMENT ON COLUMN workflow_settings.serp_model IS 'SERP 分析使用的 AI 模型';
COMMENT ON COLUMN workflow_settings.content_model IS '內容生成使用的 AI 模型';
COMMENT ON COLUMN workflow_settings.meta_model IS 'SEO 元數據生成使用的 AI 模型';

-- ============================================
-- 4. 建立關鍵字管理表
-- ============================================
CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

    keyword TEXT NOT NULL,
    region TEXT,
    search_volume INTEGER,
    difficulty INTEGER CHECK (difficulty >= 0 AND difficulty <= 100),

    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'archived')),
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    CONSTRAINT fk_website FOREIGN KEY (website_id) REFERENCES website_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keywords_website_id ON keywords(website_id);
CREATE INDEX IF NOT EXISTS idx_keywords_status ON keywords(status);
CREATE INDEX IF NOT EXISTS idx_keywords_priority ON keywords(priority DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_website_status ON keywords(website_id, status);

COMMENT ON TABLE keywords IS '關鍵字管理表';
COMMENT ON COLUMN keywords.keyword IS '主要關鍵字';
COMMENT ON COLUMN keywords.region IS '目標地區';
COMMENT ON COLUMN keywords.search_volume IS '搜尋量';
COMMENT ON COLUMN keywords.difficulty IS '難度（0-100）';
COMMENT ON COLUMN keywords.status IS '狀態：active（可用）、used（已使用）、archived（封存）';
COMMENT ON COLUMN keywords.priority IS '優先級（1-5，5 最高）';
COMMENT ON COLUMN keywords.last_used_at IS '最後使用時間';

-- ============================================
-- 5. 更新 article_jobs 表
-- ============================================
ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS keyword_id UUID REFERENCES keywords(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selected_region TEXT;

COMMENT ON COLUMN article_jobs.keyword_id IS '使用的關鍵字 ID';
COMMENT ON COLUMN article_jobs.selected_region IS '選擇的目標地區';

-- ============================================
-- 6. 建立 updated_at 觸發器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_brand_voices_updated_at ON brand_voices;
CREATE TRIGGER update_brand_voices_updated_at
    BEFORE UPDATE ON brand_voices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_settings_updated_at ON workflow_settings;
CREATE TRIGGER update_workflow_settings_updated_at
    BEFORE UPDATE ON workflow_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. RLS Policies
-- ============================================

-- Brand Voices RLS
ALTER TABLE brand_voices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view brand voices for their websites" ON brand_voices;
CREATE POLICY "Users can view brand voices for their websites"
    ON brand_voices FOR SELECT
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

DROP POLICY IF EXISTS "Users can manage brand voices for their websites" ON brand_voices;
CREATE POLICY "Users can manage brand voices for their websites"
    ON brand_voices FOR ALL
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

-- Workflow Settings RLS
ALTER TABLE workflow_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workflow settings for their websites" ON workflow_settings;
CREATE POLICY "Users can view workflow settings for their websites"
    ON workflow_settings FOR SELECT
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

DROP POLICY IF EXISTS "Users can manage workflow settings for their websites" ON workflow_settings;
CREATE POLICY "Users can manage workflow settings for their websites"
    ON workflow_settings FOR ALL
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

-- Keywords RLS
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view keywords for their websites" ON keywords;
CREATE POLICY "Users can view keywords for their websites"
    ON keywords FOR SELECT
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

DROP POLICY IF EXISTS "Users can manage keywords for their websites" ON keywords;
CREATE POLICY "Users can manage keywords for their keywords"
    ON keywords FOR ALL
    USING (
        website_id IN (
            SELECT wc.id
            FROM website_configs wc
            WHERE wc.company_id IN (
                SELECT company_id
                FROM company_members
                WHERE user_id = auth.uid()
                AND role IN ('owner', 'admin', 'editor', 'writer')
            )
        )
    );

-- ============================================
-- 8. 建立 Helper Views
-- ============================================

-- 網站完整配置 View
CREATE OR REPLACE VIEW website_full_configs AS
SELECT
    wc.*,
    bv.tone_of_voice,
    bv.target_audience,
    bv.keywords as brand_keywords,
    ws.serp_analysis_enabled,
    ws.quality_threshold,
    ws.auto_publish,
    ws.content_model,
    (
        SELECT COUNT(*)
        FROM keywords k
        WHERE k.website_id = wc.id AND k.status = 'active'
    ) as active_keywords_count
FROM website_configs wc
LEFT JOIN brand_voices bv ON bv.website_id = wc.id
LEFT JOIN workflow_settings ws ON ws.website_id = wc.id;

COMMENT ON VIEW website_full_configs IS '網站完整配置視圖（包含品牌聲音和工作流設定）';

-- 可用關鍵字 View
CREATE OR REPLACE VIEW available_keywords AS
SELECT
    k.*,
    wc.company_id,
    wc.website_name
FROM keywords k
INNER JOIN website_configs wc ON k.website_id = wc.id
WHERE k.status = 'active'
ORDER BY k.priority DESC, k.created_at ASC;

COMMENT ON VIEW available_keywords IS '可用關鍵字視圖（已排序）';

-- ============================================
-- 9. 建立 Helper Functions
-- ============================================

-- 取得網站的下一個可用關鍵字
CREATE OR REPLACE FUNCTION get_next_keyword(p_website_id UUID)
RETURNS TABLE (
    keyword_id UUID,
    keyword TEXT,
    region TEXT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.keyword,
        k.region,
        k.priority
    FROM keywords k
    WHERE k.website_id = p_website_id
        AND k.status = 'active'
    ORDER BY k.priority DESC, k.created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_keyword IS '取得網站的下一個可用關鍵字（按優先級和建立時間排序）';

-- 標記關鍵字為已使用
CREATE OR REPLACE FUNCTION mark_keyword_used(p_keyword_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE keywords
    SET
        status = 'used',
        last_used_at = NOW()
    WHERE id = p_keyword_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_keyword_used IS '標記關鍵字為已使用';

-- 建立預設工作流設定
CREATE OR REPLACE FUNCTION create_default_workflow_settings(p_website_id UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO workflow_settings (website_id)
    VALUES (p_website_id)
    ON CONFLICT (website_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_workflow_settings IS '為網站建立預設工作流設定';

-- ============================================
-- 10. 初始化現有網站的預設設定
-- ============================================

-- 為現有網站建立預設工作流設定
INSERT INTO workflow_settings (website_id)
SELECT id FROM website_configs
ON CONFLICT (website_id) DO NOTHING;
