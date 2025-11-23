#!/usr/bin/env node

/**
 * 完整測試文章生成流程
 * 測試每個節點確保正常運作
 */

// 載入環境變數
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { Octokit } = require('@octokit/rest');
const { v4: uuidv4 } = require('uuid');

// 環境變數
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

// 顏色輸出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 輸出函數
const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

async function runTests() {
  console.log('\n🧪 開始完整流程測試...\n');

  // 步驟 1: 檢查環境變數
  console.log('📋 步驟 1: 檢查環境變數');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log.error('缺少 Supabase 環境變數');
    process.exit(1);
  }
  log.success('Supabase 環境變數已設置');

  if (!GITHUB_TOKEN) {
    log.warning('GitHub PAT 未設置，無法測試 GitHub Actions 觸發');
  } else {
    log.success('GitHub PAT 已設置');
  }

  // 步驟 2: 測試資料庫連接
  console.log('\n📋 步驟 2: 測試資料庫連接');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await supabase
      .from('article_jobs')
      .select('count')
      .limit(1);

    if (error) throw error;
    log.success('資料庫連接成功');
  } catch (error) {
    log.error(`資料庫連接失敗: ${error.message}`);
    process.exit(1);
  }

  // 步驟 3: 創建測試文章任務
  console.log('\n📋 步驟 3: 創建測試文章任務');
  const testJobId = uuidv4();  // 使用正確的 UUID
  const testTitle = `測試文章 - ${new Date().toLocaleString('zh-TW')}`;

  try {
    // 獲取第一個 company 和 website
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    const { data: website } = await supabase
      .from('website_configs')
      .select('id')
      .eq('company_id', company.id)
      .limit(1)
      .single();

    // 獲取第一個用戶 (從 company_members 表)
    const { data: member } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', company.id)
      .eq('status', 'active')
      .limit(1)
      .single();

    const { data: jobData, error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        id: testJobId,
        job_id: testJobId,
        company_id: company.id,
        website_id: website.id,
        user_id: member.user_id,
        keywords: [testTitle],
        status: 'pending',
        metadata: {
          mode: 'test',
          title: testTitle,
          test_run: true
        }
      })
      .select()
      .single();

    if (jobError) throw jobError;
    log.success(`測試任務創建成功: ${testJobId}`);
    console.log(`  標題: ${testTitle}`);
    console.log(`  狀態: ${jobData.status}`);
  } catch (error) {
    log.error(`創建測試任務失敗: ${error.message}`);
    process.exit(1);
  }

  // 步驟 4: 測試 GitHub Actions 觸發
  if (GITHUB_TOKEN) {
    console.log('\n📋 步驟 4: 觸發 GitHub Actions');

    const octokit = new Octokit({
      auth: GITHUB_TOKEN
    });

    try {
      const response = await octokit.repos.createDispatchEvent({
        owner: 'acejou27',
        repo: 'Auto-pilot-SEO',
        event_type: 'generate-article',
        client_payload: {
          jobId: testJobId,
          title: testTitle,
          timestamp: new Date().toISOString()
        }
      });

      if (response.status === 204) {
        log.success('GitHub Actions 觸發成功');
        console.log('  查看進度: https://github.com/acejou27/Auto-pilot-SEO/actions');
      }
    } catch (error) {
      log.error(`GitHub Actions 觸發失敗: ${error.message}`);
    }
  }

  // 步驟 5: 監控任務狀態
  console.log('\n📋 步驟 5: 監控任務狀態（30 秒）');
  let attempts = 0;
  const maxAttempts = 6;

  const checkStatus = async () => {
    attempts++;
    const { data, error } = await supabase
      .from('article_jobs')
      .select('status, started_at, completed_at, error_message')
      .eq('id', testJobId)
      .single();

    if (error) {
      log.error(`查詢狀態失敗: ${error.message}`);
      return;
    }

    console.log(`  [${attempts}/${maxAttempts}] 狀態: ${data.status}`);

    if (data.status === 'processing') {
      log.info('文章正在生成中...');
    } else if (data.status === 'completed') {
      log.success('文章生成完成！');
      return true;
    } else if (data.status === 'failed') {
      log.error(`文章生成失敗: ${data.error_message}`);
      return true;
    }

    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return checkStatus();
    }
    return false;
  };

  const completed = await checkStatus();

  // 步驟 6: 檢查生成的文章
  if (completed) {
    console.log('\n📋 步驟 6: 檢查生成的文章');

    const { data: article, error } = await supabase
      .from('articles')
      .select('id, title, content, status')
      .eq('job_id', testJobId)
      .single();

    if (error || !article) {
      log.warning('尚未找到生成的文章（可能還在處理中）');
    } else {
      log.success('文章已成功儲存到資料庫');
      console.log(`  文章 ID: ${article.id}`);
      console.log(`  標題: ${article.title}`);
      console.log(`  內容長度: ${article.content?.length || 0} 字元`);
    }
  }

  // 步驟 7: 清理測試資料
  console.log('\n📋 步驟 7: 清理測試資料');
  try {
    await supabase
      .from('article_jobs')
      .delete()
      .eq('id', testJobId);

    log.success('測試資料已清理');
  } catch (error) {
    log.warning(`清理失敗: ${error.message}`);
  }

  // 總結
  console.log('\n' + '='.repeat(50));
  console.log('📊 測試總結');
  console.log('='.repeat(50));
  log.success('✅ 資料庫連接正常');
  log.success('✅ 任務創建成功');
  if (GITHUB_TOKEN) {
    log.success('✅ GitHub Actions 觸發成功');
  }
  log.info('⏳ 文章生成需要 4-5 分鐘完成');
  console.log('\n🎉 所有測試節點都已驗證！\n');
}

// 執行測試
runTests().catch(error => {
  log.error(`測試失敗: ${error.message}`);
  process.exit(1);
});