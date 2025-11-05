#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkJobCompanies() {
  console.log('📊 檢查任務的公司歸屬\n');

  // 取得所有 pending 任務及其 company_id
  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('id, company_id, status, keywords, created_at')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ 查詢失敗:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('✅ 沒有 pending/processing 任務');
    return;
  }

  console.log(`📝 找到 ${jobs.length} 個任務:\n`);

  // 統計每個 company_id 的任務數
  const companyMap = new Map<string, number>();
  jobs.forEach(job => {
    const count = companyMap.get(job.company_id) || 0;
    companyMap.set(job.company_id, count + 1);
  });

  console.log('Company ID 分佈:');
  for (const [companyId, count] of companyMap.entries()) {
    console.log(`  ${companyId}: ${count} 個任務`);
  }

  console.log('\n最近 5 個任務詳情:');
  jobs.slice(0, 5).forEach((job, index) => {
    console.log(`${index + 1}. Company: ${job.company_id}, Status: ${job.status}, Keywords: ${job.keywords.join(', ')}`);
  });

  // 檢查公司成員表
  console.log('\n🔍 檢查活躍的公司成員...');
  const { data: members, error: memberError } = await supabase
    .from('company_members')
    .select('user_id, company_id, status')
    .eq('status', 'active');

  if (memberError) {
    console.error('❌ 查詢成員失敗:', memberError);
    return;
  }

  console.log(`\n👥 找到 ${members?.length || 0} 個活躍成員:`);
  members?.forEach((member, index) => {
    const jobCount = jobs.filter(j => j.company_id === member.company_id).length;
    console.log(`${index + 1}. User: ${member.user_id.slice(0, 8)}..., Company: ${member.company_id}, Jobs: ${jobCount}`);
  });
}

checkJobCompanies();
