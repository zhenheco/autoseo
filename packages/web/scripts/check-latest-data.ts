import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatest() {
  console.log('📊 檢查最新資料...\n');

  const { data: jobs, error: jobsError } = await supabase
    .from('article_jobs')
    .select('id, status, keywords, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError) {
    console.error('任務查詢錯誤:', jobsError);
  } else {
    console.log(`最新 ${jobs?.length || 0} 個任務:`);
    jobs?.forEach((j, i) => {
      console.log(`${i + 1}. [${j.status}] ${j.keywords.join(', ')}`);
      console.log(`   ID: ${j.id}`);
      console.log(`   建立時間: ${j.created_at}\n`);
    });
  }

  const { data: articles, error: articlesError } = await supabase
    .from('generated_articles')
    .select('id, title, article_job_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (articlesError) {
    console.error('文章查詢錯誤:', articlesError);
  } else {
    console.log(`\n最新 ${articles?.length || 0} 篇文章:`);
    articles?.forEach((a, i) => {
      console.log(`${i + 1}. ${a.title || '(無標題)'}`);
      console.log(`   ID: ${a.id}`);
      console.log(`   Job ID: ${a.article_job_id || 'N/A'}`);
      console.log(`   Status: ${a.status}`);
      console.log(`   建立時間: ${a.created_at}\n`);
    });
  }
}

checkLatest().catch(console.error);
