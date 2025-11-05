#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function createTestJobs() {
  console.log('📝 創建測試任務\n');

  // 先取得第一個活躍的公司
  const { data: members, error: memberError } = await supabase
    .from('company_members')
    .select('company_id, user_id')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (memberError || !members) {
    console.error('❌ 找不到活躍的公司成員:', memberError);
    return;
  }

  console.log(`✅ 使用公司: ${members.company_id}`);
  console.log(`✅ 創建者: ${members.user_id}\n`);

  // 創建 3 個測試任務
  const testJobs = [
    {
      company_id: members.company_id,
      keywords: ['測試任務1'],
      status: 'pending',
      metadata: {
        title: '測試任務 1 - Pending',
        created_by: members.user_id,
      },
    },
    {
      company_id: members.company_id,
      keywords: ['測試任務2'],
      status: 'processing',
      metadata: {
        title: '測試任務 2 - Processing',
        created_by: members.user_id,
      },
    },
    {
      company_id: members.company_id,
      keywords: ['測試任務3'],
      status: 'pending',
      metadata: {
        title: '測試任務 3 - Pending',
        created_by: members.user_id,
      },
    },
  ];

  const { data: createdJobs, error } = await supabase
    .from('article_jobs')
    .insert(testJobs)
    .select('id, status, keywords');

  if (error) {
    console.error('❌ 創建失敗:', error);
    return;
  }

  console.log(`✅ 成功創建 ${createdJobs?.length || 0} 個測試任務:\n`);
  createdJobs?.forEach((job, index) => {
    console.log(`${index + 1}. ID: ${job.id.slice(0, 8)}..., Status: ${job.status}, Keywords: ${job.keywords.join(', ')}`);
  });

  console.log('\n📊 現在可以測試清除功能了');
}

createTestJobs();
