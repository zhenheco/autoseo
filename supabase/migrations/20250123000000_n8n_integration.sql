-- N8N Workflow 整合所需的資料庫調整
-- 建立日期: 2025-01-23
-- 說明: 擴充 article_jobs 和 website_configs 表以支援 N8N workflow 整合

-- ============================================
-- 1. 擴充 article_jobs 表
-- ============================================

-- 新增欄位（相容原有 schema）
ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS article_title TEXT,
ADD COLUMN IF NOT EXISTS input_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS input_content JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS wp_post_id INTEGER,
ADD COLUMN IF NOT EXISTS generated_content JSONB,
ADD COLUMN IF NOT EXISTS workflow_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS serp_analysis JSONB,
ADD COLUMN IF NOT EXISTS competitor_analysis JSONB,
ADD COLUMN IF NOT EXISTS content_plan JSONB,
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS quality_report JSONB,
ADD COLUMN IF NOT EXISTS processing_stages JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;

-- 新增欄位註解
COMMENT ON COLUMN article_jobs.workflow_data IS 'N8N workflow 執行的所有中間資料，包含各階段的完整輸出';
COMMENT ON COLUMN article_jobs.serp_analysis IS 'SERP 分析結果（快取用），包含 top 10 URLs、common topics、search intent';
COMMENT ON COLUMN article_jobs.competitor_analysis IS '競爭對手分析結果，包含 content gaps、average word count、keyword opportunities';
COMMENT ON COLUMN article_jobs.content_plan IS 'Preliminary Plan 內容大綱，包含 title suggestions、outline、target word count';
COMMENT ON COLUMN article_jobs.quality_score IS '文章品質分數 (0-100)，由品質檢查節點計算';
COMMENT ON COLUMN article_jobs.quality_report IS '品質檢查詳細報告，包含各項檢查的通過狀態和具體數值';
COMMENT ON COLUMN article_jobs.processing_stages IS '各處理階段的狀態追蹤，格式: {stage_name: {status, completed_at/failed_at, error}}';

-- ============================================
-- 2. 擴充 website_configs 表
-- ============================================

-- 新增欄位
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS workflow_settings JSONB DEFAULT '{}';

-- 新增欄位註解
COMMENT ON COLUMN website_configs.n8n_webhook_url IS 'N8N workflow webhook URL（每個網站可有不同 workflow）';
COMMENT ON COLUMN website_configs.workflow_settings IS 'Workflow 自訂設定，包含 serp_analysis_enabled、quality_threshold、auto_publish 等';

-- ============================================
-- 3. 建立索引以提升查詢效能
-- ============================================

-- 為 quality_score 建立索引（用於查詢高品質文章）
CREATE INDEX IF NOT EXISTS idx_article_jobs_quality_score
ON article_jobs(quality_score);

-- 為 processing_stages 建立 GIN 索引（用於查詢特定階段狀態）
CREATE INDEX IF NOT EXISTS idx_article_jobs_processing_stages
ON article_jobs USING GIN(processing_stages);

-- 為 workflow_data 建立 GIN 索引（用於查詢 workflow 資料）
CREATE INDEX IF NOT EXISTS idx_article_jobs_workflow_data
ON article_jobs USING GIN(workflow_data);

-- ============================================
-- 4. 更新 RLS 政策（如果需要）
-- ============================================

-- article_jobs 的 RLS 政策已經在 20250101000002_rls_and_functions.sql 中定義
-- 新欄位會自動繼承現有的 RLS 政策，不需要額外設定

-- ============================================
-- 5. 建立輔助函數（可選）
-- ============================================

-- 函數: 取得文章的當前處理階段
CREATE OR REPLACE FUNCTION get_current_processing_stage(job_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stages JSONB;
  stage_name TEXT;
  stage_data JSONB;
  latest_stage TEXT := NULL;
  latest_time TIMESTAMP := NULL;
  stage_time TIMESTAMP;
BEGIN
  -- 取得 processing_stages
  SELECT processing_stages INTO stages
  FROM article_jobs
  WHERE id = job_id;

  -- 如果沒有 stages，返回 NULL
  IF stages IS NULL OR stages = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  -- 遍歷所有 stages，找出最新的
  FOR stage_name, stage_data IN SELECT * FROM jsonb_each(stages)
  LOOP
    -- 取得完成或失敗時間
    IF stage_data->>'completed_at' IS NOT NULL THEN
      stage_time := (stage_data->>'completed_at')::timestamp;
    ELSIF stage_data->>'failed_at' IS NOT NULL THEN
      stage_time := (stage_data->>'failed_at')::timestamp;
    ELSE
      CONTINUE;
    END IF;

    -- 更新最新階段
    IF latest_time IS NULL OR stage_time > latest_time THEN
      latest_stage := stage_name;
      latest_time := stage_time;
    END IF;
  END LOOP;

  RETURN latest_stage;
END;
$$;

COMMENT ON FUNCTION get_current_processing_stage IS '取得文章當前的處理階段（基於最新的完成時間）';

-- 函數: 計算 workflow 總執行時間（秒）
CREATE OR REPLACE FUNCTION calculate_workflow_duration(job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stages JSONB;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration INTEGER;
BEGIN
  -- 取得 processing_stages
  SELECT processing_stages INTO stages
  FROM article_jobs
  WHERE id = job_id;

  -- 如果沒有 stages，返回 NULL
  IF stages IS NULL OR stages = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  -- 取得開始時間（workflow_triggered 的 started_at）
  start_time := (stages->'workflow_triggered'->>'started_at')::timestamp;

  -- 取得結束時間（wordpress_publish 的完成或失敗時間）
  IF stages->'wordpress_publish'->>'completed_at' IS NOT NULL THEN
    end_time := (stages->'wordpress_publish'->>'completed_at')::timestamp;
  ELSIF stages->'wordpress_publish'->>'failed_at' IS NOT NULL THEN
    end_time := (stages->'wordpress_publish'->>'failed_at')::timestamp;
  ELSE
    -- 如果還沒完成，返回 NULL
    RETURN NULL;
  END IF;

  -- 計算時間差（秒）
  duration := EXTRACT(EPOCH FROM (end_time - start_time))::integer;

  RETURN duration;
END;
$$;

COMMENT ON FUNCTION calculate_workflow_duration IS '計算 workflow 從觸發到完成的總執行時間（秒）';

-- ============================================
-- 6. 建立視圖（方便查詢）
-- ============================================

-- 視圖: 文章處理進度摘要
CREATE OR REPLACE VIEW v_article_processing_summary AS
SELECT
  aj.id,
  aj.article_title,
  aj.status,
  aj.quality_score,
  aj.created_at,
  aj.published_at,
  get_current_processing_stage(aj.id) as current_stage,
  calculate_workflow_duration(aj.id) as duration_seconds,
  CASE
    WHEN aj.processing_stages->'serp_analysis'->>'status' = 'completed' THEN true
    ELSE false
  END as serp_completed,
  CASE
    WHEN aj.processing_stages->'content_plan'->>'status' = 'completed' THEN true
    ELSE false
  END as plan_completed,
  CASE
    WHEN aj.processing_stages->'content_generation'->>'status' = 'completed' THEN true
    ELSE false
  END as content_completed,
  CASE
    WHEN aj.processing_stages->'quality_check'->>'status' = 'completed' THEN true
    ELSE false
  END as quality_completed,
  CASE
    WHEN aj.processing_stages->'wordpress_publish'->>'status' = 'completed' THEN true
    ELSE false
  END as publish_completed
FROM article_jobs aj
WHERE aj.processing_stages IS NOT NULL
  AND aj.processing_stages != '{}'::jsonb;

COMMENT ON VIEW v_article_processing_summary IS '文章處理進度摘要視圖，方便查詢各階段完成狀態';

-- ============================================
-- 7. 建立觸發器（可選，用於自動更新）
-- ============================================

-- 函數: 自動更新文章狀態（基於 processing_stages）
CREATE OR REPLACE FUNCTION auto_update_article_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 如果 wordpress_publish 完成，更新狀態為 published
  IF NEW.processing_stages->'wordpress_publish'->>'status' = 'completed'
     AND NEW.status != 'published' THEN
    NEW.status := 'published';
  END IF;

  -- 如果任何階段失敗，更新狀態為 failed
  IF NEW.processing_stages ? 'workflow_triggered'
     AND NEW.processing_stages->'workflow_triggered'->>'status' = 'failed'
     AND NEW.status != 'failed' THEN
    NEW.status := 'failed';
  END IF;

  RETURN NEW;
END;
$$;

-- 建立觸發器
DROP TRIGGER IF EXISTS trg_auto_update_article_status ON article_jobs;
CREATE TRIGGER trg_auto_update_article_status
  BEFORE UPDATE OF processing_stages ON article_jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_article_status();

COMMENT ON FUNCTION auto_update_article_status IS '自動更新文章狀態（基於 processing_stages 的變化）';

-- ============================================
-- 8. 插入預設 workflow_settings（可選）
-- ============================================

-- 為現有的 website_configs 設定預設 workflow_settings
UPDATE website_configs
SET workflow_settings = jsonb_build_object(
  'serp_analysis_enabled', true,
  'competitor_count', 10,
  'quality_threshold', 80,
  'auto_publish', true,
  'internal_links_count', '3-5',
  'image_generation_enabled', false,
  'ai_model_preferences', jsonb_build_object(
    'content_generation', 'gpt-4',
    'serp_analysis', 'perplexity',
    'quality_check', 'gpt-3.5-turbo'
  )
)
WHERE workflow_settings = '{}'::jsonb
   OR workflow_settings IS NULL;

-- ============================================
-- Migration 完成
-- ============================================

-- 驗證：檢查新欄位是否已建立
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'article_jobs'
    AND column_name IN (
      'workflow_data',
      'serp_analysis',
      'competitor_analysis',
      'content_plan',
      'quality_score',
      'quality_report',
      'processing_stages'
    );

  IF column_count = 7 THEN
    RAISE NOTICE 'Migration 成功: article_jobs 表已新增 7 個欄位';
  ELSE
    RAISE WARNING 'Migration 可能不完整: article_jobs 表只新增了 % 個欄位', column_count;
  END IF;

  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'website_configs'
    AND column_name IN ('n8n_webhook_url', 'workflow_settings');

  IF column_count = 2 THEN
    RAISE NOTICE 'Migration 成功: website_configs 表已新增 2 個欄位';
  ELSE
    RAISE WARNING 'Migration 可能不完整: website_configs 表只新增了 % 個欄位', column_count;
  END IF;
END $$;
