require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSingleMigration(migrationFile) {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
  });

  try {
    await client.connect();
    console.log('✅ 已連線到 Supabase 資料庫\n');

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📄 執行 Migration: ${migrationFile}`);
    await client.query(sql);
    console.log(`✅ ${migrationFile} 執行成功\n`);

  } catch (error) {
    console.error(`❌ ${migrationFile} 執行失敗:`);
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 資料庫連線已關閉');
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ 請提供 migration 檔案名稱');
  console.error('使用方式: node scripts/run-single-migration.js <migration-file>');
  process.exit(1);
}

runSingleMigration(migrationFile);
