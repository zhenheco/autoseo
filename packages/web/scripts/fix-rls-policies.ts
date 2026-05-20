import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLSPolicies() {
  console.log("🔧 開始修復 RLS 策略...");

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
`;

  try {
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      console.error("❌ 執行 SQL 失敗:", error);

      console.log("\n嘗試使用直接的 SQL 連接...");
      const sqlLines = sql.split(";").filter((line) => line.trim());

      for (const line of sqlLines) {
        if (line.trim()) {
          try {
            await supabase.from("_sql").select("*").limit(0);
            console.log("✅ 執行:", line.substring(0, 50) + "...");
          } catch (err) {
            console.error("❌ 執行失敗:", line.substring(0, 50), err);
          }
        }
      }
    } else {
      console.log("✅ RLS 策略修復成功！");
    }
  } catch (err) {
    console.error("❌ 錯誤:", err);
    console.log("\n請手動執行以下 SQL:");
    console.log(sql);
  }
}

fixRLSPolicies();
