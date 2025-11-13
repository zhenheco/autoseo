#!/usr/bin/env node

/**
 * GitHub Actions 批次文章處理器
 * 處理所有待處理的文章任務
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

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function processSingleJob(job) {
  const startTime = Date.now();
  console.log(`\n📝 處理 Job: ${job.id}`);
  console.log(`   標題: ${job.metadata?.title || 'Untitled'}`);

  try {
    // 更新狀態為 processing
    await supabase
      .from('article_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        metadata: {
          ...job.metadata,
          processor: 'github-actions-batch',
          workflow_run_id: process.env.GITHUB_RUN_ID,
        }
      })
      .eq('id', job.id);

    // 初始化 Orchestrator
    const orchestrator = new ParallelOrchestrator();

    // 準備輸入
    const input = {
      articleJobId: job.id,
      companyId: job.company_id,
      websiteId: job.website_id,
      userId: job.user_id,
      title: job.metadata?.title,
      targetLanguage: job.metadata?.targetLanguage || 'zh-TW',
      wordCount: job.metadata?.wordCount || 2000,
      imageCount: job.metadata?.imageCount || 3,
    };

    // 執行生成
    console.log(`   ⏱️ 開始生成...`);
    const result = await orchestrator.execute(input);

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`   ✅ 完成！耗時: ${elapsedTime} 秒`);

    // 更新完成狀態
    await supabase
      .from('article_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        generated_content: result.writing?.html || result.writing?.content || null,
        article_title: result.writing?.title || result.meta?.title || input.title,
        metadata: {
          ...job.metadata,
          execution_time_seconds: elapsedTime,
          processor: 'github-actions-batch',
          result: result,  // 將完整結果存到 metadata
        }
      })
      .eq('id', job.id);

    return { success: true, jobId: job.id, elapsedTime };

  } catch (error) {
    console.error(`   ❌ 失敗: ${error.message}`);

    // 更新失敗狀態
    await supabase
      .from('article_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        metadata: {
          ...job.metadata,
          error: error.message,
          failed_at: new Date().toISOString(),
          processor: 'github-actions-batch',
        }
      })
      .eq('id', job.id);

    return { success: false, jobId: job.id, error: error.message };
  }
}

async function processBatch() {
  console.log('🚀 開始批次處理文章生成任務');
  console.log('⏰ 時間:', new Date().toISOString());

  try {
    // 1. 查詢待處理的任務
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: jobs, error: queryError } = await supabase
      .from('article_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .or(`started_at.is.null,started_at.lt.${tenMinutesAgo}`)
      .order('created_at', { ascending: true })
      .limit(5);  // 每次最多處理 5 個

    if (queryError) {
      throw new Error(`查詢失敗: ${queryError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('✅ 沒有待處理的任務');
      return;
    }

    console.log(`\n📊 找到 ${jobs.length} 個待處理任務`);

    // 2. 逐個處理任務
    const results = [];
    for (const job of jobs) {
      // 先檢查是否已被其他進程鎖定
      const { data: lockCheck } = await supabase
        .from('article_jobs')
        .select('status, started_at')
        .eq('id', job.id)
        .single();

      if (lockCheck?.status === 'processing' &&
          lockCheck?.started_at &&
          new Date(lockCheck.started_at) > new Date(Date.now() - 10 * 60 * 1000)) {
        console.log(`\n⏭️ Job ${job.id} 已被其他進程處理，跳過`);
        continue;
      }

      const result = await processSingleJob(job);
      results.push(result);

      // 避免同時處理太多任務
      if (results.filter(r => r.success).length >= 3) {
        console.log('\n⚠️ 已處理 3 個任務，結束批次');
        break;
      }
    }

    // 3. 輸出統計
    console.log('\n📈 批次處理統計:');
    console.log(`   總處理: ${results.length}`);
    console.log(`   成功: ${results.filter(r => r.success).length}`);
    console.log(`   失敗: ${results.filter(r => !r.success).length}`);

    const totalTime = results.reduce((sum, r) => sum + (r.elapsedTime || 0), 0);
    console.log(`   總耗時: ${Math.floor(totalTime / 60)} 分 ${totalTime % 60} 秒`);

    console.log('\n🎉 批次處理完成！');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 批次處理失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行批次處理
processBatch().catch(console.error);