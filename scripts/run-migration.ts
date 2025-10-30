import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🚀 開始執行 migration...');

  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('❌ 缺少 SUPABASE_DB_URL 環境變數');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ 資料庫連接成功');

    const migrationPath = join(process.cwd(), 'supabase/migrations/20251029195904_generated_articles.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📄 讀取 migration 檔案');
    console.log('📝 SQL 長度:', sql.length, '字元');

    // 執行整個 SQL
    await client.query(sql);

    console.log('✅ Migration 執行成功！');
  } catch (error) {
    console.error('❌ Migration 失敗:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
