import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkJobs() {
  console.log('🔍 檢查 processing 狀態的 jobs...\n');

  const { data: jobs, error } = await supabase
    .from('article_jobs')
    .select('id, status, created_at, metadata, error_message')
    .eq('status', 'processing')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ 查詢錯誤:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('✅ 沒有卡在 processing 的 jobs');

    const { data: completedJobs } = await supabase
      .from('article_jobs')
      .select('id, status, created_at, metadata')
      .in('status', ['completed', 'failed'])
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('\n📊 最近的 jobs:');
    completedJobs?.forEach((job, i) => {
      const phase = (job.metadata as Record<string, unknown>)?.current_phase || 'N/A';
      const createdDate = new Date(job.created_at);
      console.log(`${i+1}. ${job.id} - ${job.status} (phase: ${phase})`);
      console.log(`   Created: ${createdDate.toLocaleString()}`);
    });
    return;
  }

  console.log(`⚠️ 找到 ${jobs.length} 個 processing 的 jobs:\n`);
  jobs.forEach((job, i) => {
    const phase = (job.metadata as Record<string, unknown>)?.current_phase || 'N/A';
    const createdDate = new Date(job.created_at);
    console.log(`${i+1}. Job ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Current Phase: ${phase}`);
    console.log(`   Created: ${createdDate.toLocaleString()}`);
    if (job.error_message) {
      console.log(`   Error: ${job.error_message}`);
    }
    console.log('');
  });
}

checkJobs().catch(console.error);
