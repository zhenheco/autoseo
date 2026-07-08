const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const migrationsDir = path.join(__dirname, "../../../supabase/migrations");

const migrations = [
  "20250101000000_init_schema.sql",
  "20250101000001_advanced_features.sql",
  "20250101000003_rls_policies_only.sql",
  "20250127000001_update_ai_models_for_openrouter.sql",
  "20251030090000_transition_to_token_billing.sql",
  "20251030100000_token_billing_system.sql",
  "20251030110000_token_billing_mvp.sql",
  "20251030120000_final_pricing_update.sql",
];

async function runMigrations() {
  const sslRejectUnauthorized =
    process.env.SUPABASE_DB_SSL_REJECT_UNAUTHORIZED !== "false";

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: {
      rejectUnauthorized: sslRejectUnauthorized,
    },
  });

  try {
    await client.connect();
    console.log("✅ 已連線到 Supabase 資料庫\n");

    for (const migrationFile of migrations) {
      const filePath = path.join(migrationsDir, migrationFile);

      console.log(`📄 執行 Migration: ${migrationFile}`);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ 找不到檔案: ${filePath}`);
        continue;
      }

      const sql = fs.readFileSync(filePath, "utf8");

      try {
        await client.query(sql);
        console.log(`✅ ${migrationFile} 執行成功\n`);
      } catch (error) {
        console.error(`❌ ${migrationFile} 執行失敗:`);
        console.error(error.message);
        console.error("\n");

        // 繼續執行下一個 migration
        // throw error; // 如果要在錯誤時停止，可以取消註解
      }
    }

    // 驗證資料庫結構
    console.log("\n🔍 驗證資料庫結構...\n");

    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("📊 已建立的表 (共 " + tablesResult.rows.length + " 張):");
    tablesResult.rows.forEach((row) => {
      console.log("  - " + row.table_name);
    });

    // 檢查 RLS 是否啟用
    const rlsResult = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    console.log("\n🔒 Row Level Security 狀態:");
    rlsResult.rows.forEach((row) => {
      const status = row.rowsecurity ? "✅ 已啟用" : "❌ 未啟用";
      console.log(`  - ${row.tablename}: ${status}`);
    });

    // 檢查預設訂閱方案
    const plansResult = await client.query(`
      SELECT name, slug, monthly_price, base_tokens, is_lifetime, lifetime_price
      FROM subscription_plans
      ORDER BY is_lifetime, monthly_price;
    `);

    console.log("\n💰 訂閱方案:");
    plansResult.rows.forEach((plan) => {
      if (plan.is_lifetime) {
        console.log(
          `  - ${plan.name} (終身): NT$ ${plan.lifetime_price} - ${plan.base_tokens} tokens/月`,
        );
      } else {
        console.log(
          `  - ${plan.name}: NT$ ${plan.monthly_price}/月 - ${plan.base_tokens} tokens`,
        );
      }
    });

    // 檢查角色權限
    const rolesResult = await client.query(`
      SELECT role, COUNT(*) as permission_count
      FROM role_permissions
      GROUP BY role
      ORDER BY role;
    `);

    console.log("\n👥 角色權限數量:");
    rolesResult.rows.forEach((role) => {
      console.log(`  - ${role.role}: ${role.permission_count} 個權限`);
    });

    console.log("\n🎉 所有 Migration 執行完成！");
  } catch (error) {
    console.error("❌ 發生錯誤:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n👋 資料庫連線已關閉");
  }
}

runMigrations();
