import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const sql = `
-- 修正 companies 和 company_members RLS 策略的循環依賴問題

-- 1. 移除所有會造成循環的 policies
DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
DROP POLICY IF EXISTS "Users can view companies they own" ON companies;
DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON company_members;
DROP POLICY IF EXISTS "Owners can insert members" ON company_members;
DROP POLICY IF EXISTS "Owners can update members" ON company_members;
DROP POLICY IF EXISTS "Users can view their own company membership" ON company_members;
DROP POLICY IF EXISTS "Company owners can insert members" ON company_members;
DROP POLICY IF EXISTS "Company owners can update members" ON company_members;
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;

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
`

async function applySql() {
  console.log('🔧 套用 RLS 修正...')

  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) {
    console.error('❌ 無法從 URL 提取 project ref:', supabaseUrl)
    return
  }

  console.log('Project ref:', projectRef)

  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error('❌ 找不到 SUPABASE_DB_URL')
    return
  }

  console.log('\n請在 Supabase Dashboard 的 SQL Editor 手動執行以下 SQL:\n')
  console.log('=' .repeat(80))
  console.log(sql)
  console.log('=' .repeat(80))
}

applySql()
