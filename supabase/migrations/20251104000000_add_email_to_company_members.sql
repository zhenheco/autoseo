-- 為 company_members 表添加 email 欄位
-- 用於邀請尚未註冊的用戶

-- 添加 email 欄位（允許 NULL，因為已存在的 active 成員不需要）
ALTER TABLE company_members
ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- 為 email 創建索引以加快查詢
CREATE INDEX IF NOT EXISTS idx_company_members_invited_email
ON company_members(invited_email);

-- 添加註解說明
COMMENT ON COLUMN company_members.invited_email IS '受邀者的電子郵件地址（用於尚未註冊的用戶）';

-- 修改 user_id 允許 NULL（用於 pending 狀態的邀請）
ALTER TABLE company_members
ALTER COLUMN user_id DROP NOT NULL;

-- 添加檢查約束：確保 pending 狀態必須有 email，active 狀態必須有 user_id
ALTER TABLE company_members
DROP CONSTRAINT IF EXISTS check_member_identity;

ALTER TABLE company_members
ADD CONSTRAINT check_member_identity CHECK (
  (status = 'pending' AND invited_email IS NOT NULL) OR
  (status = 'active' AND user_id IS NOT NULL)
);

-- 修改唯一性約束：允許同一 email 有多個 pending 邀請（不同公司）
-- 但同一用戶在同一公司只能有一個記錄
DROP INDEX IF EXISTS company_members_company_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_member
ON company_members(company_id, user_id)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation
ON company_members(company_id, invited_email)
WHERE status = 'pending' AND invited_email IS NOT NULL;
