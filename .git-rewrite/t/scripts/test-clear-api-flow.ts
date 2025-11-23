#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testClearFlow() {
  console.log('🧪 測試完整的清除流程（模擬前端+API）\n');

  // 1. 取得第一個活躍用戶和公司
  const { data: member, error: memberError } = await supabase
    .from('company_members')
    .select('user_id, company_id')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (memberError || !member) {
    console.error('❌ 找不到活躍成員:', memberError);
    return;
  }

  console.log(`👤 測試用戶: ${member.user_id.slice(0, 8)}...`);
  console.log(`🏢 公司 ID: ${member.company_id}\n`);

  // 2. 檢查該公司的 pending/processing 任務（模擬 GET /api/articles/jobs）
  const { data: jobsBefore, error: jobsError } = await supabase
    .from('article_jobs')
    .select('id, keywords, status, created_at, metadata')
    .eq('company_id', member.company_id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (jobsError) {
    console.error('❌ 查詢任務失敗:', jobsError);
    return;
  }

  console.log(`📊 前端顯示: ${jobsBefore?.length || 0} 個任務\n`);
  if (jobsBefore && jobsBefore.length > 0) {
    jobsBefore.slice(0, 3).forEach((job, index) => {
      console.log(`${index + 1}. ${job.keywords.join(', ')} - ${job.status}`);
    });
    console.log();
  }

  // 3. 執行清除（模擬 DELETE /api/articles/jobs/clear）
  console.log('🗑️  執行清除（使用 API 的邏輯）...\n');

  const { data: deletedJobs, error: deleteError } = await supabase
    .from('article_jobs')
    .delete()
    .eq('company_id', member.company_id)  // ⚠️ 關鍵：必須過濾 company_id
    .in('status', ['pending', 'processing'])
    .select('id');

  if (deleteError) {
    console.error('❌ 刪除失敗:', deleteError);
    return;
  }

  console.log(`✅ API 回應: deletedCount = ${deletedJobs?.length || 0}\n`);

  // 4. 驗證結果
  const { data: jobsAfter } = await supabase
    .from('article_jobs')
    .select('id')
    .eq('company_id', member.company_id)
    .in('status', ['pending', 'processing']);

  console.log(`📊 清除後剩餘: ${jobsAfter?.length || 0} 個任務\n`);

  // 5. 診斷：如果有任務但刪除數為 0
  if ((jobsBefore?.length || 0) > 0 && (deletedJobs?.length || 0) === 0) {
    console.log('⚠️  診斷：發現問題！');
    console.log('   - 前端顯示有任務');
    console.log('   - 但 API 刪除數為 0');
    console.log('   - 可能原因：company_id 不匹配\n');

    console.log('🔍 檢查任務的 company_id...');
    const { data: allJobs } = await supabase
      .from('article_jobs')
      .select('company_id, status')
      .in('status', ['pending', 'processing'])
      .limit(10);

    const companyMap = new Map<string, number>();
    allJobs?.forEach(job => {
      companyMap.set(job.company_id, (companyMap.get(job.company_id) || 0) + 1);
    });

    console.log('\n公司分佈:');
    for (const [companyId, count] of companyMap.entries()) {
      const isCurrent = companyId === member.company_id;
      console.log(`  ${companyId}: ${count} 個任務 ${isCurrent ? '✅ (當前公司)' : '❌ (其他公司)'}`);
    }
  } else {
    console.log('✅ 清除功能正常運作');
  }
}

testClearFlow();
