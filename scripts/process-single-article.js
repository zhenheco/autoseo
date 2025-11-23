#!/usr/bin/env node

/**
 * GitHub Actions 文章生成處理器
 * 直接調用 Orchestrator 處理單個文章，無 5 分鐘限制
 */

// 載入環境變數
require('dotenv').config({ path: '.env.local' });

// 註冊路徑別名解析
const path = require('path');
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, '..', 'dist', request.substring(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

const { createClient } = require('@supabase/supabase-js');
const { ParallelOrchestrator } = require('../dist/lib/agents/orchestrator.js');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].substring(2);
    const value = args[i + 1];
    params[key] = value;
    i++;
  }
}

const jobId = params.jobId;
const title = params.title;

if (!jobId) {
  console.error('❌ 錯誤：需要提供 jobId');
  process.exit(1);
}

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function processArticle() {
  const startTime = Date.now();
  console.log('🚀 開始處理文章生成任務');
  console.log('📝 Job ID:', jobId);
  console.log('📌 標題:', title || '從資料庫載入');

  let job = null;  // 提升到函數作用域

  try {
    // 1. 獲取 Job 詳細資訊
    const { data: jobData, error: jobError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    job = jobData;

    if (jobError || !job) {
      throw new Error(`找不到 Job: ${jobId}`);
    }

    console.log('✅ 找到 Job，狀態:', job.status);

    // 2. 檢查並更新狀態為 processing
    if (job.status === 'completed') {
      console.log('⚠️ Job 已完成，跳過處理');
      return;
    }

    const { error: updateError } = await supabase
      .from('article_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        metadata: {
          ...job.metadata,
          processor: 'github-actions',
          workflow_run_id: process.env.GITHUB_RUN_ID,
          workflow_run_number: process.env.GITHUB_RUN_NUMBER,
        }
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('⚠️ 更新狀態失敗:', updateError);
    }

    // 3. 處理 website_id（如果為 null，嘗試查詢）
    let websiteId = job.website_id;

    if (!websiteId || websiteId === 'null') {
      console.log('⚠️ Job 沒有 website_id，嘗試查詢公司的網站配置...');
      const { data: websites } = await supabase
        .from('website_configs')
        .select('id')
        .eq('company_id', job.company_id)
        .limit(1);

      if (websites && websites.length > 0) {
        websiteId = websites[0].id;
        console.log('✅ 找到網站配置:', websiteId);

        // 更新 job 的 website_id
        await supabase
          .from('article_jobs')
          .update({ website_id: websiteId })
          .eq('id', jobId);
      } else {
        console.log('⚠️ 沒有找到網站配置，文章將在沒有網站 ID 的情況下生成');
        websiteId = null;
      }
    }

    // 4. 初始化 Orchestrator
    console.log('\n🤖 初始化 Orchestrator...');
    const orchestrator = new ParallelOrchestrator();

    // 5. 準備輸入參數
    const input = {
      articleJobId: job.id,
      companyId: job.company_id,
      websiteId: websiteId,
      userId: job.user_id,
      title: title || job.metadata?.title,
      targetLanguage: job.metadata?.targetLanguage || 'zh-TW',
      wordCount: job.metadata?.wordCount || 2000,
      imageCount: job.metadata?.imageCount || 3,
    };

    console.log('\n📊 執行參數:');
    console.log('  - 公司 ID:', input.companyId);
    console.log('  - 網站 ID:', input.websiteId || '（無）');
    console.log('  - 標題:', input.title);
    console.log('  - 目標語言:', input.targetLanguage);
    console.log('  - 字數:', input.wordCount);
    console.log('  - 圖片數:', input.imageCount);

    // 5. 執行文章生成（無時間限制！）
    console.log('\n⏱️ 開始生成文章...');
    console.log('💡 GitHub Actions 最多可執行 30 分鐘，足夠處理複雜文章');

    const result = await orchestrator.execute(input);

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ 文章生成完成！耗時: ${Math.floor(elapsedTime / 60)} 分 ${elapsedTime % 60} 秒`);

    // 6. 更新 Job 狀態為完成
    const { error: completeError } = await supabase
      .from('article_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        generated_content: result.writing?.html || result.writing?.content || null,
        article_title: result.writing?.title || result.meta?.title || input.title,
        metadata: {
          ...job.metadata,
          execution_time_seconds: elapsedTime,
          processor: 'github-actions',
          result: result,  // 將完整結果存到 metadata
        }
      })
      .eq('id', jobId);

    if (completeError) {
      console.error('⚠️ 更新完成狀態失敗:', completeError);
    }

    console.log('\n🎉 任務完成！');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 處理失敗:', error.message);
    console.error(error.stack);

    // 更新失敗狀態
    await supabase
      .from('article_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        metadata: {
          ...job?.metadata,
          error: error.message,
          error_stack: error.stack,
          failed_at: new Date().toISOString(),
          processor: 'github-actions',
        }
      })
      .eq('id', jobId);

    process.exit(1);
  }
}

// 執行主函數
processArticle().catch(console.error);