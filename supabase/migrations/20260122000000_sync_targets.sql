-- =============================================
-- Migration: sync_targets
-- 文章同步目標配置表
-- 用於儲存需要同步文章的外部專案配置
-- =============================================

-- 創建 sync_targets 表
CREATE TABLE IF NOT EXISTS sync_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本資訊
  name TEXT NOT NULL,                    -- 顯示名稱，如 "onehand"
  slug TEXT UNIQUE NOT NULL,             -- 唯一識別碼，如 "onehand"
  description TEXT,                      -- 描述說明

  -- Webhook 配置
  webhook_url TEXT NOT NULL,             -- 接收同步的 webhook URL
  webhook_secret TEXT NOT NULL,          -- HMAC 密鑰（加密儲存）

  -- 同步設定
  sync_on_publish BOOLEAN DEFAULT true,  -- 發布時自動同步
  sync_on_update BOOLEAN DEFAULT true,   -- 更新時自動同步
  sync_on_unpublish BOOLEAN DEFAULT true, -- 取消發布時同步刪除
  sync_translations BOOLEAN DEFAULT true, -- 是否同步翻譯版本
  sync_languages TEXT[] DEFAULT ARRAY['zh-TW', 'en-US'], -- 要同步的語言

  -- 狀態
  is_active BOOLEAN DEFAULT true,        -- 是否啟用
  last_synced_at TIMESTAMPTZ,            -- 最後同步時間
  last_sync_status TEXT,                 -- 最後同步狀態：success/failed
  last_sync_error TEXT,                  -- 最後同步錯誤訊息

  -- 元數據
  metadata JSONB DEFAULT '{}',           -- 額外配置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_sync_targets_slug ON sync_targets(slug);
CREATE INDEX IF NOT EXISTS idx_sync_targets_active ON sync_targets(is_active) WHERE is_active = true;

-- 創建 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_sync_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_targets_updated_at ON sync_targets;
CREATE TRIGGER trigger_sync_targets_updated_at
  BEFORE UPDATE ON sync_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_targets_updated_at();

-- RLS 政策（只有管理員可以管理 sync_targets）
ALTER TABLE sync_targets ENABLE ROW LEVEL SECURITY;

-- 查詢政策：只有管理員可以查看
CREATE POLICY "Admins can view sync_targets" ON sync_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 新增政策：只有管理員可以新增
CREATE POLICY "Admins can insert sync_targets" ON sync_targets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 更新政策：只有管理員可以更新
CREATE POLICY "Admins can update sync_targets" ON sync_targets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 刪除政策：只有管理員可以刪除
CREATE POLICY "Admins can delete sync_targets" ON sync_targets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 添加註解
COMMENT ON TABLE sync_targets IS '文章同步目標配置表，儲存需要同步文章的外部專案';
COMMENT ON COLUMN sync_targets.webhook_secret IS 'HMAC-SHA256 簽章密鑰，用於驗證 webhook 請求';
COMMENT ON COLUMN sync_targets.sync_languages IS '要同步的語言列表，如 ["zh-TW", "en-US", "ja-JP"]';
