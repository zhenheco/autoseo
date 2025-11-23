import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('執行文章暫存系統 migration...');

  const migrationPath = path.join(
    __dirname,
    '../supabase/migrations/20251030000000_article_cache.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

  if (error) {
    console.error('Migration 失敗:', error);
    process.exit(1);
  }

  console.log('✅ Migration 完成！');
}

runMigration();
