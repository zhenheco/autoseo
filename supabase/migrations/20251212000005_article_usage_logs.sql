-- =====================================================
-- 篇數制訂閱系統 - Step 5: 建立 article_usage_logs 表
-- =====================================================
-- 說明：文章使用記錄，追蹤每篇文章的扣款來源

-- 1. 建立表
CREATE TABLE IF NOT EXISTS article_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_job_id UUID REFERENCES article_jobs(id),
  user_id UUID,

  -- 扣款來源
  deducted_from TEXT NOT NULL CHECK (deducted_from IN ('subscription', 'purchased')),
  purchased_credit_id UUID REFERENCES purchased_article_credits(id),

  -- 扣款前後餘額
  subscription_balance_before INTEGER,
  subscription_balance_after INTEGER,
  purchased_balance_before INTEGER,
  purchased_balance_after INTEGER,

  -- 文章資訊
  article_title TEXT,
  keywords TEXT[],

  -- 元數據
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_article_usage_company
  ON article_usage_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_article_usage_created
  ON article_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_usage_job
  ON article_usage_logs(article_job_id);
CREATE INDEX IF NOT EXISTS idx_article_usage_deducted_from
  ON article_usage_logs(company_id, deducted_from);

-- 3. 啟用 RLS
ALTER TABLE article_usage_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS 政策
DROP POLICY IF EXISTS "Company members can view usage logs" ON article_usage_logs;
CREATE POLICY "Company members can view usage logs"
ON article_usage_logs FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  )
);

-- 5. 註解
COMMENT ON TABLE article_usage_logs IS '文章使用記錄：
- 記錄每篇文章生成時的扣款詳情
- deducted_from: 扣款來源（subscription 或 purchased）
- 用於對帳、客訴處理和使用分析';

COMMENT ON COLUMN article_usage_logs.deducted_from IS '扣款來源：subscription（訂閱額度）或 purchased（加購額度）';
COMMENT ON COLUMN article_usage_logs.purchased_credit_id IS '若從加購額度扣款，記錄是哪筆加購記錄';
