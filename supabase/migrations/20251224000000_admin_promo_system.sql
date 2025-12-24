-- ============================================
-- Admin 管理面板與優惠碼系統
-- 建立日期: 2025-12-24
-- ============================================

-- 1. 優惠碼表 (promo_codes)
-- 用於儲存優惠碼設定，目前只支援「每月加送 X 篇」類型
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本資訊
  code VARCHAR(50) NOT NULL UNIQUE,           -- 優惠碼（大小寫不敏感）
  name VARCHAR(100) NOT NULL,                 -- 優惠碼名稱（顯示用）
  description TEXT,                           -- 描述說明

  -- 優惠內容
  bonus_articles INTEGER NOT NULL DEFAULT 0,  -- 每月加送篇數

  -- 使用限制
  max_uses INTEGER DEFAULT NULL,              -- 總使用次數上限（NULL = 無限制）
  current_uses INTEGER DEFAULT 0,             -- 目前已使用次數

  -- 有效期間
  starts_at TIMESTAMPTZ DEFAULT NOW(),        -- 開始生效日期
  expires_at TIMESTAMPTZ DEFAULT NULL,        -- 過期日期（NULL = 永不過期）

  -- 狀態
  is_active BOOLEAN DEFAULT TRUE,             -- 是否啟用

  -- 元資料
  created_by UUID REFERENCES auth.users(id),  -- 建立者
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 優惠碼索引
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(LOWER(code));
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, starts_at, expires_at);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_codes_updated_at();

-- ============================================
-- 2. 優惠碼使用記錄表 (promo_code_usages)
-- ============================================
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL,  -- 關聯的付款訂單

  -- 套用詳情
  bonus_articles INTEGER NOT NULL,            -- 實際加送的篇數

  -- 時間
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- 使用記錄索引
CREATE INDEX IF NOT EXISTS idx_promo_usages_company ON promo_code_usages(company_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_promo ON promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_used_at ON promo_code_usages(used_at DESC);

-- ============================================
-- 3. Admin 操作記錄表 (admin_action_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 操作者資訊
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email VARCHAR(255) NOT NULL,

  -- 操作類型
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'extend_subscription',     -- 延長訂閱
    'grant_articles',          -- 贈送篇數
    'adjust_subscription',     -- 調整訂閱設定
    'create_promo_code',       -- 建立優惠碼
    'update_promo_code',       -- 更新優惠碼
    'deactivate_promo_code',   -- 停用優惠碼
    'manual_adjustment',       -- 手動調整
    'other'                    -- 其他
  )),

  -- 操作目標
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN (
    'company',
    'subscription',
    'promo_code'
  )),
  target_id UUID NOT NULL,
  target_name VARCHAR(255),                   -- 便於顯示的名稱

  -- 操作詳情（JSON 格式）
  -- 例如: { "previous_end_date": "2025-01-01", "new_end_date": "2025-02-01", "reason": "客戶要求" }
  action_details JSONB NOT NULL DEFAULT '{}',

  -- 時間
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 操作記錄索引
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_action_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_action_logs(action_type);

-- ============================================
-- 4. 輔助函數：增加優惠碼使用次數
-- ============================================
CREATE OR REPLACE FUNCTION increment_promo_code_usage(promo_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. RLS 政策
-- ============================================

-- promo_codes: 只有 admin 可以管理，所有人可以讀取活躍的優惠碼
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "任何人可以讀取活躍的優惠碼"
  ON promo_codes FOR SELECT
  USING (is_active = true AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Service role 完整存取優惠碼"
  ON promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- promo_code_usages: 公司成員可以看自己公司的使用記錄
ALTER TABLE promo_code_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司成員可以查看自己公司的優惠碼使用記錄"
  ON promo_code_usages FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Service role 完整存取優惠碼使用記錄"
  ON promo_code_usages FOR ALL
  USING (auth.role() = 'service_role');

-- admin_action_logs: 只有 service role 可以存取
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role 完整存取操作記錄"
  ON admin_action_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 6. 註解
-- ============================================
COMMENT ON TABLE promo_codes IS '優惠碼設定表，目前支援每月加送篇數類型';
COMMENT ON TABLE promo_code_usages IS '優惠碼使用記錄，追蹤每次優惠碼的套用';
COMMENT ON TABLE admin_action_logs IS 'Admin 操作記錄，用於審計和追蹤管理員操作';
COMMENT ON COLUMN promo_codes.bonus_articles IS '每月加送的文章篇數';
COMMENT ON COLUMN promo_codes.max_uses IS '總使用次數上限，NULL 表示無限制';
COMMENT ON COLUMN admin_action_logs.action_details IS '操作詳情，JSON 格式儲存變更前後的值';
