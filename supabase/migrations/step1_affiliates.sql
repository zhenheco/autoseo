-- =====================================================
-- 步驟 1：創建 affiliates 表（核心表）
-- =====================================================

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 創建 affiliates 表
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  affiliate_code VARCHAR(20) UNIQUE NOT NULL,

  -- 基本資料
  full_name VARCHAR(100) NOT NULL,
  id_number VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,

  -- 銀行資訊
  bank_code VARCHAR(10),
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30),
  bank_account_name VARCHAR(100),

  -- 稅務資訊
  is_resident BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 10.00,
  tax_id_verified BOOLEAN DEFAULT false,

  -- 證件
  id_document_url TEXT,
  bank_document_url TEXT,
  tax_document_url TEXT,
  documents_verified BOOLEAN DEFAULT false,
  documents_verified_at TIMESTAMPTZ,

  -- 佣金統計
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  locked_commission DECIMAL(10,2) DEFAULT 0,
  withdrawn_commission DECIMAL(10,2) DEFAULT 0,
  lifetime_commission DECIMAL(10,2) DEFAULT 0,

  -- 狀態追蹤
  last_referral_at TIMESTAMPTZ,
  last_active_payment_at TIMESTAMPTZ,
  inactive_since TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',

  -- 審核
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_affiliates_company_id ON affiliates(company_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- 測試：查詢表結構
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'affiliates'
ORDER BY ordinal_position;

-- 測試：生成一個測試推薦碼看看
SELECT upper(substring(md5(random()::text) from 1 for 8)) as test_code;
