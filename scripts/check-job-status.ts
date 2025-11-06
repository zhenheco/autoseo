import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: jobs } = await supabase
    .from('article_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n最近的文章任務:\n');

  if (jobs && jobs.length > 0) {
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. ${job.metadata?.title || '(無標題)'}`);
      console.log(`   Job ID: ${job.id}`);
      console.log(`   狀態: ${job.status}`);
      console.log(`   建立時間: ${new Date(job.created_at).toLocaleString('zh-TW')}`);
      console.log('');
    });
  } else {
    console.log('沒有任何文章任務');
  }
}

main();
