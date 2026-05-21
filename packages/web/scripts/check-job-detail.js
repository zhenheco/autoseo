#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJobDetail() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('❌ 請提供 Job ID');
    process.exit(1);
  }

  const { data: job, error } = await supabase
    .from('article_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error('❌ 錯誤:', error);
    return;
  }

  console.log('\n📄 任務詳細資訊:\n');
  console.log('ID:', job.id);
  console.log('Job ID:', job.job_id);
  console.log('狀態:', job.status);
  console.log('公司 ID:', job.company_id);
  console.log('網站 ID:', job.website_id);
  console.log('使用者 ID:', job.user_id);
  console.log('');

  if (job.started_at) {
    console.log('開始時間:', new Date(job.started_at).toLocaleString('zh-TW'));
  }

  if (job.completed_at) {
    console.log('完成時間:', new Date(job.completed_at).toLocaleString('zh-TW'));
  }

  console.log('');

  if (job.error_message) {
    console.log('❌ 錯誤訊息:', job.error_message);
    console.log('');
  }

  if (job.generated_content) {
    console.log('✅ 生成內容長度:', job.generated_content.length, '字元');
  }

  if (job.article_title) {
    console.log('✅ 文章標題:', job.article_title);
  }

  console.log('');

  if (job.metadata) {
    console.log('📊 Metadata:');

    if (job.metadata.title) {
      console.log('  - 標題:', job.metadata.title);
    }

    if (job.metadata.execution_time_seconds) {
      const mins = Math.floor(job.metadata.execution_time_seconds / 60);
      const secs = job.metadata.execution_time_seconds % 60;
      console.log(`  - 執行時間: ${mins} 分 ${secs} 秒`);
    }

    if (job.metadata.processor) {
      console.log('  - 處理器:', job.metadata.processor);
    }

    if (job.metadata.result) {
      console.log('\n  ✅ 完整結果已儲存在 metadata.result');

      const result = job.metadata.result;

      if (result.writing) {
        console.log('\n  📝 Writing 模組:');
        console.log('    - Markdown:', result.writing.markdown ? '✅' : '❌');
        console.log('    - HTML:', result.writing.html ? '✅' : '❌');
        console.log('    - Statistics:', result.writing.statistics ? '✅' : '❌');
        console.log('    - Readability:', result.writing.readability ? '✅' : '❌');
        console.log('    - Keyword Usage:', result.writing.keywordUsage ? '✅' : '❌');
      }

      if (result.meta) {
        console.log('\n  🔖 Meta 模組:');
        console.log('    - SEO:', result.meta.seo ? '✅' : '❌');
        console.log('    - Slug:', result.meta.slug ? '✅' : '❌');
        console.log('    - Focus Keyphrase:', result.meta.focusKeyphrase ? '✅' : '❌');
        console.log('    - Open Graph:', result.meta.openGraph ? '✅' : '❌');
        console.log('    - Twitter Card:', result.meta.twitterCard ? '✅' : '❌');
      }

      if (result.research) {
        console.log('\n  🔍 Research 模組: ✅');
      }

      if (result.strategy) {
        console.log('  📋 Strategy 模組: ✅');
      }

      if (result.quality) {
        console.log('  ✨ Quality 模組: ✅');
        console.log('    - 品質分數:', result.quality.score);
        console.log('    - 通過:', result.quality.passed ? '是' : '否');
      }
    }

    if (job.metadata.error) {
      console.log('\n  ❌ 錯誤詳情:', job.metadata.error);
    }

    if (job.metadata.error_stack) {
      console.log('\n  📚 錯誤堆疊:');
      console.log(job.metadata.error_stack);
    }
  }

  console.log('\n');
}

checkJobDetail().catch(console.error);
