-- 標題快取表
CREATE TABLE IF NOT EXISTS title_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(128) UNIQUE NOT NULL,
  keyword VARCHAR(500) NOT NULL,
  target_language VARCHAR(10) NOT NULL,
  titles JSONB NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_title_cache_key ON title_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_title_cache_expires ON title_cache(expires_at);

-- 標題模板表
CREATE TABLE IF NOT EXISTS title_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  region TEXT,
  language TEXT NOT NULL DEFAULT 'zh-TW',
  template TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_title_templates_lookup
  ON title_templates(industry, language, is_active);
CREATE INDEX IF NOT EXISTS idx_title_templates_region
  ON title_templates(region, is_active) WHERE region IS NOT NULL;

-- 插入預設標題模板
INSERT INTO title_templates (industry, region, language, template, category) VALUES
-- 通用模板（zh-TW）
('general', NULL, 'zh-TW', '{number} 個 {keyword} 必學技巧，專家都在用', 'listicle'),
('general', NULL, 'zh-TW', '{keyword} 完整教學：{number} 個步驟輕鬆上手', 'tutorial'),
('general', NULL, 'zh-TW', '新手必看！{number} 個 {keyword} 入門技巧', 'beginner'),
('general', NULL, 'zh-TW', '{number} 個你不知道的 {keyword} 秘訣', 'tips'),
('general', NULL, 'zh-TW', '{keyword} 懶人包：{number} 分鐘快速入門', 'quickstart'),
('general', NULL, 'zh-TW', '{number} 個 {keyword} 技巧，讓你事半功倍', 'productivity'),
('general', NULL, 'zh-TW', '{keyword} 完整攻略：{number} 個實戰經驗分享', 'guide'),
('general', NULL, 'zh-TW', '2024 年 {keyword} 趨勢分析：{number} 個關鍵洞察', 'trends'),
('general', NULL, 'zh-TW', '{keyword} 常見問題：{number} 個 FAQ 完整解答', 'faq'),
('general', NULL, 'zh-TW', '為什麼 {keyword} 很重要？{number} 個原因告訴你', 'why'),
-- 科技產業（zh-TW）
('tech', NULL, 'zh-TW', '{number} 個 {keyword} 最佳實踐，工程師必知', 'listicle'),
('tech', NULL, 'zh-TW', '{keyword} 效能優化：{number} 個實用方法', 'optimization'),
('tech', NULL, 'zh-TW', '{keyword} 入門到精通：{number} 個關鍵概念', 'tutorial'),
-- 金融產業（zh-TW）
('finance', NULL, 'zh-TW', '{number} 種 {keyword} 投資策略完整解析', 'strategy'),
('finance', NULL, 'zh-TW', '{keyword} 理財指南：{number} 個必知觀念', 'guide'),
('finance', NULL, 'zh-TW', '{number} 個 {keyword} 常見錯誤，你中了幾個？', 'mistakes'),
-- English templates
('general', NULL, 'en', '{number} {keyword} Tips You Need to Know', 'listicle'),
('general', NULL, 'en', 'The Complete Guide to {keyword}: {number} Steps', 'tutorial'),
('general', NULL, 'en', '{number} {keyword} Mistakes to Avoid', 'mistakes'),
('general', NULL, 'en', 'How to Master {keyword} in {number} Steps', 'howto'),
('general', NULL, 'en', '{number} {keyword} Secrets the Pros Won''t Tell You', 'secrets')
ON CONFLICT DO NOTHING;

-- RLS 策略
ALTER TABLE title_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_templates ENABLE ROW LEVEL SECURITY;

-- 允許服務角色完全訪問
CREATE POLICY "Service role full access on title_cache" ON title_cache
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access on title_templates" ON title_templates
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 允許認證用戶讀取模板
CREATE POLICY "Authenticated users can read templates" ON title_templates
  FOR SELECT TO authenticated USING (is_active = TRUE);
