#!/usr/bin/env node

/**
 * 創建測試用文章生成任務
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestJob() {
  console.log('📝 創建測試文章生成任務...');

  try {
    // 創建測試任務
    const { data: job, error } = await supabase
      .from('article_jobs')
      .insert({
        job_id: `test-job-${Date.now()}`,
        keywords: ['AI行銷', '數位轉型', 'SEO優化'],
        region: 'TW',
        article_type: 'blog_post',
        status: 'pending',
        metadata: {
          title: '測試文章：AI 如何改變數位行銷',
          targetLanguage: 'zh-TW',
          wordCount: 1500,
          imageCount: 2,
          test: true,
          created_by: 'test-script'
        }
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ 測試任務創建成功！');
    console.log('   ID:', job.id);
    console.log('   Job ID:', job.job_id);
    console.log('   標題:', job.metadata?.title || 'Untitled');
    console.log('   狀態:', job.status);

    return job;

  } catch (error) {
    console.error('❌ 創建測試任務失敗:', error.message);
    process.exit(1);
  }
}

// 執行創建
createTestJob().then(job => {
  console.log('\n📌 現在可以觸發 GitHub Actions 來處理這個任務');
  console.log('   或者使用單一處理命令：');
  console.log(`   node scripts/process-single-article.js --jobId ${job.id}`);
  process.exit(0);
});