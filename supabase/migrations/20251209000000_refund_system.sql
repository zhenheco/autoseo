-- Migration: 退款系統
-- 創建 refund_requests 表，用於管理退款申請

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,

  -- 退款單號
  refund_no TEXT UNIQUE NOT NULL,  -- REF{timestamp}{random}

  -- 金額資訊
  original_amount DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,

  -- 慰留方案
  retention_offered BOOLEAN DEFAULT false,   -- 是否已提供慰留方案
  retention_accepted BOOLEAN DEFAULT false,  -- 用戶是否接受慰留
  retention_credits INTEGER DEFAULT 0,       -- 慰留贈送的 credits 數量

  -- 自動/人工判斷
  is_auto_eligible BOOLEAN DEFAULT false,
  days_since_purchase INTEGER,

  -- 退款原因
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'product_issue',       -- 產品功能不符合預期
    'service_unsatisfied', -- 服務品質不滿意
    'billing_error',       -- 帳務問題/重複扣款
    'change_of_mind',      -- 改變心意
    'other'                -- 其他
  )),
  reason_detail TEXT,

  -- 狀態
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',            -- 待處理（新申請，等待用戶決定是否接受慰留）
    'retention_accepted', -- 已接受慰留（結束）
    'auto_processing',    -- 自動處理中
    'pending_review',     -- 待人工審核
    'approved',           -- 已核准（待執行退款）
    'processing',         -- 退款執行中
    'completed',          -- 退款完成
    'rejected',           -- 已拒絕
    'failed'              -- 退款失敗
  )),

  -- 審核資訊
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  reject_reason TEXT,

  -- 藍新退款 API 回應
  newebpay_trade_no TEXT,
  newebpay_status TEXT,
  newebpay_message TEXT,
  newebpay_response JSONB,

  -- 退款後處理記錄
  credits_deducted INTEGER DEFAULT 0,
  subscription_downgraded BOOLEAN DEFAULT false,

  -- 時間戳記
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_refund_requests_company ON refund_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON refund_requests(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_refund_no ON refund_requests(refund_no);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created ON refund_requests(created_at DESC);

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION update_refund_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_refund_requests_updated_at ON refund_requests;
CREATE TRIGGER trigger_update_refund_requests_updated_at
  BEFORE UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_refund_requests_updated_at();

-- RLS 政策
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- 用戶可查看自己公司的退款申請
CREATE POLICY "Users can view own company refund requests" ON refund_requests
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- 用戶可建立自己公司的退款申請
CREATE POLICY "Users can create refund requests for own company" ON refund_requests
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- 用戶可更新自己公司的退款申請（僅限接受慰留）
CREATE POLICY "Users can update own company refund requests" ON refund_requests
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Service role 可以執行所有操作
CREATE POLICY "Service role has full access to refund_requests" ON refund_requests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 註解
COMMENT ON TABLE refund_requests IS '退款申請記錄表';
COMMENT ON COLUMN refund_requests.refund_no IS '退款單號，格式：REF{timestamp}{random}';
COMMENT ON COLUMN refund_requests.retention_offered IS '是否已向用戶提供慰留方案';
COMMENT ON COLUMN refund_requests.retention_accepted IS '用戶是否接受慰留方案（接受則贈送 50% credits）';
COMMENT ON COLUMN refund_requests.retention_credits IS '慰留方案贈送的 credits 數量';
COMMENT ON COLUMN refund_requests.is_auto_eligible IS '是否符合自動退款條件（購買後 7 天內）';
COMMENT ON COLUMN refund_requests.days_since_purchase IS '申請退款時距離購買的天數';
