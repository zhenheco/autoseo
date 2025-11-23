#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJobs() {
  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('id, job_id, status, error_message, started_at, completed_at, metadata')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📋 最近 5 個文章生成任務:\n');

  if (error) {
    console.error('錯誤:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('沒有任務記錄');
    return;
  }

  jobs.forEach((job, i) => {
    console.log(`${i + 1}. ID: ${job.id}`);
    console.log(`   Job ID: ${job.job_id || 'N/A'}`);
    console.log(`   狀態: ${job.status}`);
    console.log(`   開始時間: ${job.started_at || '未開始'}`);
    console.log(`   完成時間: ${job.completed_at || '未完成'}`);

    if (job.error_message) {
      console.log(`   ❌ 錯誤: ${job.error_message}`);
    }

    if (job.metadata?.title) {
      console.log(`   標題: ${job.metadata.title}`);
    }

    if (job.metadata?.execution_time_seconds) {
      console.log(`   執行時間: ${job.metadata.execution_time_seconds} 秒`);
    }

    console.log('');
  });
}

checkJobs().catch(console.error);
