/**
 * 查詢用戶 ID
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vdjzeregvyimgzflfalv.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ 錯誤：請設定 SUPABASE_SERVICE_ROLE_KEY 環境變數");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = process.argv[2] || "nelsonjou1101@gmail.com";

  console.log(`🔍 查詢用戶: ${email}\n`);

  // 使用 admin API 查詢用戶
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error("❌ 查詢失敗:", error.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email === email);

  if (!user) {
    console.log("❌ 找不到此用戶");
    console.log("\n所有用戶郵件列表 (前 20 個):");
    users.users.slice(0, 20).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email} (${u.id})`);
    });
    process.exit(1);
  }

  console.log("📋 用戶資訊:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created At: ${user.created_at}`);
  console.log(`   Last Sign In: ${user.last_sign_in_at}`);
  console.log(`   Email Confirmed: ${user.email_confirmed_at ? "Yes" : "No"}`);

  // 查詢公司資訊
  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select(
      `
      company_id,
      role,
      companies (
        id,
        name,
        email
      )
    `,
    )
    .eq("user_id", user.id)
    .single();

  if (member) {
    console.log("\n🏢 公司資訊:");
    console.log(`   Company ID: ${member.company_id}`);
    console.log(`   Role: ${member.role}`);
    if (member.companies) {
      const c = member.companies as { name: string; email: string };
      console.log(`   Company Name: ${c.name}`);
      console.log(`   Company Email: ${c.email}`);
    }
  }

  console.log("\n✅ 可用於補建推薦關係的 user ID:");
  console.log(`   ${user.id}`);
}

main().catch(console.error);
