#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testClearJobs() {
  console.log('📊 測試清除任務功能\n');

  // 取得目前 pending/processing 的任務
  const { data: jobs, error: fetchError } = await supabase
    .from('article_jobs')
    .select('id, status, keywords, created_at')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error('❌ 取得任務失敗:', fetchError);
    return;
  }

  console.log(`📝 找到 ${jobs?.length || 0} 個 pending/processing 任務\n`);

  if (!jobs || jobs.length === 0) {
    console.log('✅ 沒有任務需要清除');
    return;
  }

  jobs.forEach((job, index) => {
    console.log(`${index + 1}. ID: ${job.id.slice(0, 8)}..., Status: ${job.status}, Keywords: ${job.keywords.join(', ')}`);
  });

  console.log('\n🗑️  執行刪除...');

  // 模擬 API 的刪除邏輯
  const { data: deletedJobs, error: deleteError } = await supabase
    .from('article_jobs')
    .delete()
    .in('status', ['pending', 'processing'])
    .select('id');

  if (deleteError) {
    console.error('❌ 刪除失敗:', deleteError);
    return;
  }

  console.log(`✅ 成功刪除 ${deletedJobs?.length || 0} 個任務\n`);

  // 驗證刪除結果
  const { data: remainingJobs } = await supabase
    .from('article_jobs')
    .select('id, status')
    .in('status', ['pending', 'processing']);

  console.log(`📊 剩餘 ${remainingJobs?.length || 0} 個 pending/processing 任務`);
}

testClearJobs();
