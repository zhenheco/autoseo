-- =====================================================
-- Migration: 擴充文章排程選項
-- 1. 每日上限從 1-3 擴充到 1-5 篇
-- 2. 新增排程模式欄位（daily/interval）
-- 3. 新增間隔天數欄位（2-7 天）
-- =====================================================

-- 1. 移除舊的 CHECK 約束
ALTER TABLE website_configs
DROP CONSTRAINT IF EXISTS website_configs_daily_article_limit_check;

-- 2. 新增放寬的 CHECK 約束（1-5 篇）
ALTER TABLE website_configs
ADD CONSTRAINT website_configs_daily_article_limit_check
CHECK (daily_article_limit >= 1 AND daily_article_limit <= 5);

-- 3. 新增排程模式欄位
-- 'daily': 每日發布 N 篇
-- 'interval': 每 X 天發布 1 篇
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'daily';

-- 4. 新增間隔天數欄位（1-7 天）
-- 1 = 每天（等同 daily 模式）
-- 2-7 = 每 2-7 天 1 篇
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS schedule_interval_days INTEGER DEFAULT 1;

-- 5. CHECK 約束：排程模式
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'website_configs_schedule_type_check'
  ) THEN
    ALTER TABLE website_configs
    ADD CONSTRAINT website_configs_schedule_type_check
    CHECK (schedule_type IN ('daily', 'interval'));
  END IF;
END $$;

-- 6. CHECK 約束：間隔天數（1-7 天）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'website_configs_schedule_interval_days_check'
  ) THEN
    ALTER TABLE website_configs
    ADD CONSTRAINT website_configs_schedule_interval_days_check
    CHECK (schedule_interval_days >= 1 AND schedule_interval_days <= 7);
  END IF;
END $$;

-- 欄位註解
COMMENT ON COLUMN website_configs.daily_article_limit IS '每日發布文章數上限（1-5 篇）';
COMMENT ON COLUMN website_configs.schedule_type IS '排程模式：daily（每日 N 篇）或 interval（每 X 天 1 篇）';
COMMENT ON COLUMN website_configs.schedule_interval_days IS '間隔天數（1-7 天），僅在 schedule_type=interval 時使用';
