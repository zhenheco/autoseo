import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const jobId = 'c78d9a4c-afda-49af-bf41-83a8e8b44a86';

  const { data: job, error } = await supabase
    .from('article_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Article Job 詳細資訊 ===\n');
  console.log('Job ID:', job.id);
  console.log('標題:', job.metadata?.title || job.article_title || '(無標題)');
  console.log('狀態:', job.status);
  console.log('進度:', job.progress, '%');
  console.log('當前階段:', job.metadata?.current_phase || '未知');
  console.log('建立時間:', new Date(job.created_at).toLocaleString('zh-TW'));
  console.log('開始時間:', job.started_at ? new Date(job.started_at).toLocaleString('zh-TW') : '未開始');
  console.log('完成時間:', job.completed_at ? new Date(job.completed_at).toLocaleString('zh-TW') : '未完成');
  console.log('錯誤訊息:', job.error_message || '無');

  if (job.metadata) {
    console.log('\n=== Metadata ===');
    if (job.metadata.research) {
      console.log('Research 完成:', '✓');
    }
    if (job.metadata.strategy) {
      console.log('Strategy 完成:', '✓');
    }
    if (job.metadata.writing) {
      console.log('Writing 完成:', '✓');
    }
    if (job.metadata.image) {
      console.log('Image 完成:', '✓');
    }
    if (job.metadata.html) {
      console.log('HTML 完成:', '✓');
    }
    if (job.metadata.meta) {
      console.log('Meta 完成:', '✓');
    }
  }

  const { data: article } = await supabase
    .from('generated_articles')
    .select('*')
    .eq('article_job_id', jobId)
    .single();

  if (article) {
    console.log('\n=== Generated Article ===');
    console.log('Article ID:', article.id);
    console.log('標題:', article.title);
    console.log('Slug:', article.slug);
    console.log('字數:', article.word_count || 0);
    console.log('內容長度:', article.content?.length || 0, '字元');
    console.log('建立時間:', new Date(article.created_at).toLocaleString('zh-TW'));
    console.log('圖片 URL:', article.featured_image_url ? '✓' : '✗');
  } else {
    console.log('\n=== Generated Article ===');
    console.log('尚未生成文章記錄');
  }
}

main().catch(console.error);
