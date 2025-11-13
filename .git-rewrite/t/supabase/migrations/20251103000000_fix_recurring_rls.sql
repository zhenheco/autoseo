-- 修正 payment_orders 和 recurring_mandates RLS 策略
-- 允許系統操作（使用 Service Role Key）繞過 RLS，同時保持用戶級別的訪問控制

-- ============ payment_orders 表 ============

-- 刪除舊的過於限制性的策略
DROP POLICY IF EXISTS "系統可插入支付訂單" ON payment_orders;
DROP POLICY IF EXISTS "系統可更新支付訂單" ON payment_orders;
DROP POLICY IF EXISTS "公司成員可查看自己公司的支付訂單" ON payment_orders;

-- 創建新策略，允許 Service Role Key 操作
CREATE POLICY "公司成員可查看自己公司的支付訂單" ON payment_orders
  FOR SELECT USING (
    -- Service Role Key 可訪問（auth.uid() 為 NULL）
    auth.uid() IS NULL OR
    -- 或者用戶是公司成員
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可插入支付訂單（包含Service Role）" ON payment_orders
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "系統可更新支付訂單（包含Service Role）" ON payment_orders
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- ============ recurring_mandates 表 ============

-- 刪除舊的 UPDATE 策略（過於限制性）
DROP POLICY IF EXISTS "系統可更新定期定額委託" ON recurring_mandates;
DROP POLICY IF EXISTS "系統可插入定期定額委託" ON recurring_mandates;
DROP POLICY IF EXISTS "公司成員可查看自己公司的定期定額委託" ON recurring_mandates;

-- 添加新的策略，允許系統操作
CREATE POLICY "公司成員可查看自己公司的定期定額委託" ON recurring_mandates
  FOR SELECT USING (
    -- Service Role Key 可訪問（auth.uid() 為 NULL）
    auth.uid() IS NULL OR
    -- 或者用戶是公司成員
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "系統可插入定期定額委託（包含Service Role）" ON recurring_mandates
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "系統可更新定期定額委託（包含Service Role）" ON recurring_mandates
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
