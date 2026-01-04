-- ============================================
-- 修復 social_accounts 表 RLS 政策
-- 問題：缺少 INSERT、DELETE、UPDATE 政策
-- 日期：2026-01-04
-- ============================================

-- INSERT 政策：公司成員可新增已連結帳號
CREATE POLICY "公司成員可寫已連結帳號" ON social_accounts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_accounts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- DELETE 政策：公司成員可刪除已連結帳號
CREATE POLICY "公司成員可刪已連結帳號" ON social_accounts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_accounts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- UPDATE 政策：公司成員可更新已連結帳號
CREATE POLICY "公司成員可更新已連結帳號" ON social_accounts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_accounts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );
