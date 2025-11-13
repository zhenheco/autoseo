-- 修正 companies 和 company_members RLS 策略的循環依賴問題

-- 1. 移除所有會造成循環的 policies
DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
DROP POLICY IF EXISTS "Users can view companies they own" ON companies;
DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON company_members;
DROP POLICY IF EXISTS "Owners can insert members" ON company_members;
DROP POLICY IF EXISTS "Owners can update members" ON company_members;

-- 2. 為 companies 建立簡單的 policy（只檢查 owner_id）
CREATE POLICY "Users can view their own companies"
  ON companies FOR SELECT
  USING (owner_id = auth.uid());

-- 3. 為 company_members 建立簡單的 policies（不依賴 companies 表的 RLS）
CREATE POLICY "Users can view their own company membership"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Company owners can insert members"
  ON company_members FOR INSERT
  WITH CHECK (
    -- 檢查當前使用者是否是該公司的 owner（透過直接的 company_id 比對）
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can update members"
  ON company_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );
