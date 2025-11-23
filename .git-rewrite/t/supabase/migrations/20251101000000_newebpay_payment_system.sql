-- =====================================================
-- NewebPay 支付系統整合
-- 支援單次支付和定期定額
-- =====================================================

-- 1. 支付訂單表（統一記錄所有支付訂單）
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  order_no TEXT UNIQUE NOT NULL,

  order_type TEXT NOT NULL CHECK (order_type IN ('onetime', 'recurring_first', 'recurring_renewal')),

  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'token_package', 'lifetime')),

  amount DECIMAL(10,2) NOT NULL,

  currency TEXT DEFAULT 'TWD',

  item_description TEXT NOT NULL,

  related_id UUID,

  newebpay_status TEXT,
  newebpay_message TEXT,
  newebpay_trade_no TEXT,
  newebpay_response JSONB,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'success',
    'failed',
    'cancelled',
    'refunded'
  )),

  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE payment_orders IS '支付訂單統一記錄表';
COMMENT ON COLUMN payment_orders.order_type IS '訂單類型：onetime（單次），recurring_first（定期首次），recurring_renewal（定期續約）';
COMMENT ON COLUMN payment_orders.payment_type IS '支付用途：subscription（月費），token_package（Token包），lifetime（終身）';
COMMENT ON COLUMN payment_orders.related_id IS '關聯ID：subscription_plans.id 或 token_packages.id';
COMMENT ON COLUMN payment_orders.newebpay_trade_no IS '藍新金流交易序號';

CREATE INDEX idx_payment_orders_company ON payment_orders(company_id);
CREATE INDEX idx_payment_orders_order_no ON payment_orders(order_no);
CREATE INDEX idx_payment_orders_status ON payment_orders(status);
CREATE INDEX idx_payment_orders_created ON payment_orders(created_at DESC);

-- 2. 定期定額委託表
CREATE TABLE IF NOT EXISTS recurring_mandates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  mandate_no TEXT UNIQUE NOT NULL,

  newebpay_period_no TEXT UNIQUE,

  period_type TEXT NOT NULL CHECK (period_type IN ('D', 'W', 'M', 'Y')),
  period_point TEXT,

  period_times INTEGER,

  period_amount DECIMAL(10,2) NOT NULL,

  total_amount DECIMAL(10,2),

  next_payment_date DATE,

  periods_paid INTEGER DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'active',
    'suspended',
    'terminated',
    'completed',
    'failed'
  )),

  newebpay_response JSONB,

  first_payment_order_id UUID REFERENCES payment_orders(id),

  activated_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  terminated_at TIMESTAMP WITH TIME ZONE,
  termination_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE recurring_mandates IS '定期定額委託記錄';
COMMENT ON COLUMN recurring_mandates.mandate_no IS '系統內部委託編號';
COMMENT ON COLUMN recurring_mandates.newebpay_period_no IS '藍新金流定期定額編號';
COMMENT ON COLUMN recurring_mandates.period_type IS '週期類型：D（天）W（週）M（月）Y（年）';
COMMENT ON COLUMN recurring_mandates.period_point IS '扣款時間點（格式依 period_type 而定）';
COMMENT ON COLUMN recurring_mandates.period_times IS '授權期數（NULL 表示不限期）';
COMMENT ON COLUMN recurring_mandates.periods_paid IS '已扣款期數';

CREATE INDEX idx_recurring_mandates_company ON recurring_mandates(company_id);
CREATE INDEX idx_recurring_mandates_plan ON recurring_mandates(plan_id);
CREATE INDEX idx_recurring_mandates_mandate_no ON recurring_mandates(mandate_no);
CREATE INDEX idx_recurring_mandates_period_no ON recurring_mandates(newebpay_period_no);
CREATE INDEX idx_recurring_mandates_status ON recurring_mandates(status);
CREATE INDEX idx_recurring_mandates_next_payment ON recurring_mandates(next_payment_date);

-- 3. 定期定額扣款記錄表
CREATE TABLE IF NOT EXISTS recurring_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mandate_id UUID NOT NULL REFERENCES recurring_mandates(id) ON DELETE CASCADE,
  payment_order_id UUID REFERENCES payment_orders(id),

  period_number INTEGER NOT NULL,

  amount DECIMAL(10,2) NOT NULL,

  scheduled_date DATE NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'success',
    'failed',
    'skipped'
  )),

  newebpay_trade_no TEXT,
  newebpay_response JSONB,

  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE recurring_payments IS '定期定額每期扣款記錄';

CREATE INDEX idx_recurring_payments_mandate ON recurring_payments(mandate_id);
CREATE INDEX idx_recurring_payments_order ON recurring_payments(payment_order_id);
CREATE INDEX idx_recurring_payments_status ON recurring_payments(status);
CREATE INDEX idx_recurring_payments_scheduled ON recurring_payments(scheduled_date);

-- 4. RLS 政策

-- payment_orders
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司成員可查看自己公司的支付訂單" ON payment_orders
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可插入支付訂單" ON payment_orders
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可更新支付訂單" ON payment_orders
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- recurring_mandates
ALTER TABLE recurring_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司成員可查看自己公司的定期定額委託" ON recurring_mandates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可插入定期定額委託" ON recurring_mandates
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可更新定期定額委託" ON recurring_mandates
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- recurring_payments
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司成員可查看定期扣款記錄" ON recurring_payments
  FOR SELECT USING (
    mandate_id IN (
      SELECT id FROM recurring_mandates WHERE company_id IN (
        SELECT company_id FROM company_members WHERE user_id = auth.uid()
      )
    )
  );

-- 5. 自動更新 updated_at 的觸發器

CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();

CREATE TRIGGER trigger_recurring_mandates_updated_at
  BEFORE UPDATE ON recurring_mandates
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();

CREATE TRIGGER trigger_recurring_payments_updated_at
  BEFORE UPDATE ON recurring_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();

-- 6. 定期定額扣款成功後自動更新 mandate 的函數
CREATE OR REPLACE FUNCTION update_mandate_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND OLD.status != 'success' THEN
    UPDATE recurring_mandates
    SET
      periods_paid = periods_paid + 1,
      next_payment_date = CASE
        WHEN period_type = 'M' THEN (next_payment_date + INTERVAL '1 month')::DATE
        WHEN period_type = 'Y' THEN (next_payment_date + INTERVAL '1 year')::DATE
        WHEN period_type = 'W' THEN (next_payment_date + INTERVAL '1 week')::DATE
        WHEN period_type = 'D' THEN (next_payment_date + INTERVAL '1 day')::DATE
      END,
      status = CASE
        WHEN period_times IS NOT NULL AND periods_paid + 1 >= period_times THEN 'completed'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.mandate_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mandate_after_payment
  AFTER UPDATE ON recurring_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_mandate_after_payment();
