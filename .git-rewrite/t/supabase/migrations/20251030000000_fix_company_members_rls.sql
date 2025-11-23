-- 修正 company_members RLS 策略的無限遞迴問題

-- 1. 移除原有的會造成遞迴的策略
DROP POLICY IF EXISTS "Users can view company members" ON company_members;
DROP POLICY IF EXISTS "Owners and Admins can insert members" ON company_members;
DROP POLICY IF EXISTS "Owners and Admins can update members" ON company_members;

-- 2. 建立不會造成遞迴的新策略

-- 使用者可以查看自己的成員記錄
CREATE POLICY "Users can view their own membership"
  ON company_members FOR SELECT
  USING (user_id = auth.uid());

-- 使用者可以查看同公司其他成員（透過 companies 表連接，避免遞迴）
CREATE POLICY "Users can view members of their companies"
  ON company_members FOR SELECT
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      WHERE c.owner_id = auth.uid()
    )
  );

-- Owner 可以新增成員（透過 companies 表檢查，避免遞迴）
CREATE POLICY "Owners can insert members"
  ON company_members FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE owner_id = auth.uid()
    )
  );

-- Owner 可以更新成員（透過 companies 表檢查，避免遞迴）
CREATE POLICY "Owners can update members"
  ON company_members FOR UPDATE
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE owner_id = auth.uid()
    )
  );
