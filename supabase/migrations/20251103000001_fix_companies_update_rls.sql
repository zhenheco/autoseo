-- 修正 companies 表缺少 UPDATE 策略的問題
-- 允許 Service Role Key 更新公司訂閱資料（subscription_tier, subscription_ends_at, seo_token_balance）

-- 刪除舊策略（如果存在）
DROP POLICY IF EXISTS "系統可更新公司訂閱資料" ON companies;
DROP POLICY IF EXISTS "Owners can update their companies" ON companies;

-- 創建新的 UPDATE 策略：允許 Service Role 和公司 owner 更新
CREATE POLICY "系統和擁有者可更新公司資料" ON companies
  FOR UPDATE
  USING (
    -- Service Role Key 可更新（auth.uid() 為 NULL）
    auth.uid() IS NULL OR
    -- 或者當前使用者是公司 owner
    owner_id = auth.uid()
  )
  WITH CHECK (
    -- Service Role Key 可更新
    auth.uid() IS NULL OR
    -- 或者當前使用者是公司 owner
    owner_id = auth.uid()
  );

-- 同樣確保 company_subscriptions 表也有正確的策略
DROP POLICY IF EXISTS "系統可插入公司訂閱" ON company_subscriptions;
DROP POLICY IF EXISTS "系統可更新公司訂閱" ON company_subscriptions;

CREATE POLICY "系統可插入公司訂閱（包含Service Role）" ON company_subscriptions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "系統可更新公司訂閱（包含Service Role）" ON company_subscriptions
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- 確保 token_balance_changes 表也有正確的策略
DROP POLICY IF EXISTS "系統可插入代幣變動記錄" ON token_balance_changes;

CREATE POLICY "系統可插入代幣變動記錄（包含Service Role）" ON token_balance_changes
  FOR INSERT WITH CHECK (TRUE);
