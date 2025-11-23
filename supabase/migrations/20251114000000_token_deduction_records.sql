-- 建立 token_deduction_records 表用於冪等性 Token 扣款
-- 參考 Stripe 的 idempotency 設計模式

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS token_deduction_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_id UUID REFERENCES generated_articles(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'compensated')),
  balance_before INTEGER,
  balance_after INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 建立索引以提升查詢效能
CREATE INDEX idx_token_deduction_idempotency ON token_deduction_records(idempotency_key);
CREATE INDEX idx_token_deduction_company ON token_deduction_records(company_id);
CREATE INDEX idx_token_deduction_status ON token_deduction_records(status);
CREATE INDEX idx_token_deduction_created ON token_deduction_records(created_at);

-- 為 token_usage_logs 加上 deduction_record_id 欄位（關聯扣款記錄）
ALTER TABLE token_usage_logs
ADD COLUMN IF NOT EXISTS deduction_record_id UUID REFERENCES token_deduction_records(id);

-- 為 company_subscriptions 加上 last_token_deduction_at 欄位
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS last_token_deduction_at TIMESTAMPTZ;

-- 加上註解
COMMENT ON TABLE token_deduction_records IS '冪等性 Token 扣款記錄，防止重複扣款';
COMMENT ON COLUMN token_deduction_records.idempotency_key IS '冪等性金鑰，通常為 article_job_id';
COMMENT ON COLUMN token_deduction_records.status IS 'pending: 處理中, completed: 完成, failed: 失敗, compensated: 已補償';
COMMENT ON COLUMN token_deduction_records.retry_count IS '重試次數，最多 3 次';
COMMENT ON COLUMN token_deduction_records.metadata IS '額外資訊（如使用的模型、Token 明細等）';
