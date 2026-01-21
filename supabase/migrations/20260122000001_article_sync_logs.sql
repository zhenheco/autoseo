-- =============================================
-- Migration: article_sync_logs
-- 文章同步日誌表
-- 追蹤每次文章同步的狀態和結果
-- =============================================

-- 創建同步操作類型 enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_action_type') THEN
    CREATE TYPE sync_action_type AS ENUM ('create', 'update', 'delete');
  END IF;
END$$;

-- 創建同步狀態 enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status_type') THEN
    CREATE TYPE sync_status_type AS ENUM ('pending', 'processing', 'success', 'failed', 'retrying');
  END IF;
END$$;

-- 創建 article_sync_logs 表
CREATE TABLE IF NOT EXISTS article_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯
  article_id UUID NOT NULL REFERENCES generated_articles(id) ON DELETE CASCADE,
  sync_target_id UUID NOT NULL REFERENCES sync_targets(id) ON DELETE CASCADE,
  translation_id UUID REFERENCES article_translations(id) ON DELETE CASCADE, -- 如果是翻譯同步

  -- 同步資訊
  action sync_action_type NOT NULL,      -- create/update/delete
  status sync_status_type NOT NULL DEFAULT 'pending',

  -- Webhook 詳情
  webhook_url TEXT NOT NULL,             -- 實際呼叫的 URL
  request_payload JSONB,                 -- 發送的 payload（脫敏後）
  response_status INTEGER,               -- HTTP 回應狀態碼
  response_body TEXT,                    -- 回應內容

  -- 錯誤處理
  error_message TEXT,                    -- 錯誤訊息
  retry_count INTEGER DEFAULT 0,         -- 重試次數
  max_retries INTEGER DEFAULT 3,         -- 最大重試次數
  next_retry_at TIMESTAMPTZ,             -- 下次重試時間

  -- 時間追蹤
  started_at TIMESTAMPTZ,                -- 開始處理時間
  completed_at TIMESTAMPTZ,              -- 完成時間
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 元數據
  metadata JSONB DEFAULT '{}'            -- 額外資訊
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_article_id ON article_sync_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_sync_target_id ON article_sync_logs(sync_target_id);
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_status ON article_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_pending ON article_sync_logs(status, next_retry_at)
  WHERE status IN ('pending', 'failed', 'retrying');
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_created_at ON article_sync_logs(created_at DESC);

-- 複合索引：查詢特定文章的同步狀態
CREATE INDEX IF NOT EXISTS idx_article_sync_logs_article_target
  ON article_sync_logs(article_id, sync_target_id, created_at DESC);

-- RLS 政策
ALTER TABLE article_sync_logs ENABLE ROW LEVEL SECURITY;

-- 查詢政策：管理員可以查看所有日誌
CREATE POLICY "Admins can view all sync_logs" ON article_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role 可以執行所有操作（用於 background jobs）
-- 這是通過 service_role key 繞過 RLS 實現的

-- 添加註解
COMMENT ON TABLE article_sync_logs IS '文章同步日誌表，追蹤每次同步的狀態和結果';
COMMENT ON COLUMN article_sync_logs.action IS '同步操作類型：create（新建）、update（更新）、delete（刪除）';
COMMENT ON COLUMN article_sync_logs.request_payload IS '發送的 payload（已脫敏，不包含敏感資訊）';
COMMENT ON COLUMN article_sync_logs.retry_count IS '已重試次數，達到 max_retries 後停止重試';
