import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const jobIds = [
    '171e1ade-e020-4891-9969-ae34ee2318ac',
  ];

  console.log('[刪除任務] 開始刪除重複的文章任務...\n');

  for (const jobId of jobIds) {
    const { error } = await supabase
      .from('article_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      console.error(`❌ 刪除任務失敗 ${jobId}:`, error);
    } else {
      console.log(`✓ 已刪除任務: ${jobId}`);
    }
  }

  console.log('\n驗證刪除結果:\n');

  const { data: remainingJobs } = await supabase
    .from('article_jobs')
    .select('id, metadata, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (remainingJobs && remainingJobs.length > 0) {
    console.log(`剩餘 ${remainingJobs.length} 個任務:`);
    remainingJobs.forEach((job, index) => {
      console.log(`${index + 1}. ${job.metadata?.title || '(無標題)'}`);
      console.log(`   Job ID: ${job.id}`);
      console.log(`   狀態: ${job.status}`);
      console.log('');
    });
  } else {
    console.log('沒有剩餘任務\n');
  }
}

main().catch(console.error);
