#!/usr/bin/env tsx

import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import { createClient } from '@supabase/supabase-js';

async function testManualWorkflow() {
  console.log('🚀 開始手動測試文章生成流程\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少 Supabase 環境變數');
    process.exit(1);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ 缺少 OPENROUTER_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📋 測試參數：');
  console.log('  - 網站: x-marks.com');
  console.log('  - 關鍵字: AI content generation');
  console.log('  - 地區: en-US\n');

  try {
    console.log('1️⃣ 檢查資料庫連線...');
    const { data: websites, error: websiteError } = await supabase
      .from('website_configs')
      .select('id, wordpress_url, name, company_id')
      .limit(1);

    if (websiteError) {
      console.error('❌ 資料庫連線失敗:', websiteError);
      process.exit(1);
    }

    console.log('✅ 資料庫連線成功');

    if (!websites || websites.length === 0) {
      console.log('\n⚠️  未找到網站記錄，需要先在資料庫中建立網站設定');
      console.log('   請先執行以下步驟：');
      console.log('   1. 登入 Supabase Dashboard');
      console.log('   2. 在 websites 表中新增 x-marks.com 的記錄');
      console.log('   3. 配置相關的 brand_voices 和 workflow_settings');
      process.exit(1);
    }

    const website = websites[0];
    console.log(`\n2️⃣ 找到網站: ${website.name || 'Unnamed'} (${website.wordpress_url || 'No URL'})`);

    console.log('\n3️⃣ 準備建立測試文章任務...');

    const { data: job, error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        website_id: website.id,
        keywords: ['AI content generation', 'automated writing'],
        status: 'pending',
        region: 'en-US'
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ 建立任務失敗:', jobError);
      process.exit(1);
    }

    console.log(`✅ 任務已建立: ${job.id}`);

    console.log('\n4️⃣ 開始執行文章生成流程...\n');

    const orchestrator = new ParallelOrchestrator(supabase);

    const result = await orchestrator.execute({
      articleJobId: job.id,
      websiteId: website.id,
      companyId: website.company_id,
      keyword: 'AI content generation',
      region: 'en-US'
    });

    console.log('\n✅ 文章生成完成！\n');
    console.log('📊 執行統計：');
    console.log(`  - 總時間: ${(result.executionStats.totalTime / 1000).toFixed(2)}s`);
    console.log(`  - Research: ${(result.executionStats.phases.research / 1000).toFixed(2)}s`);
    console.log(`  - Strategy: ${(result.executionStats.phases.strategy / 1000).toFixed(2)}s`);
    console.log(`  - Content: ${(result.executionStats.phases.contentGeneration / 1000).toFixed(2)}s`);
    console.log(`  - Meta: ${(result.executionStats.phases.metaGeneration / 1000).toFixed(2)}s`);
    console.log(`  - Quality: ${(result.executionStats.phases.qualityCheck / 1000).toFixed(2)}s`);
    console.log(`  - 平行加速比: ${result.executionStats.parallelSpeedup.toFixed(2)}x`);

    if (result.quality) {
      console.log('\n📝 品質檢查結果：');
      console.log(`  - 通過: ${result.quality.passed ? '✅' : '❌'}`);
      console.log(`  - 分數: ${result.quality.score}/100`);
      console.log(`  - 字數: ${result.quality.checks.wordCount.actual}`);
      console.log(`  - 關鍵字密度: ${(result.quality.checks.keywordDensity.actual * 100).toFixed(2)}%`);
    }

    if (result.wordpress) {
      console.log('\n🌐 WordPress 發布結果：');
      console.log(`  - 文章 ID: ${result.wordpress.postId}`);
      console.log(`  - 文章連結: ${result.wordpress.postUrl}`);
      console.log(`  - 狀態: ${result.wordpress.status}`);
    }

    if (result.category) {
      console.log('\n🏷️  分類和標籤：');
      console.log(`  - 主要分類: ${result.category.categories[0]?.name || 'N/A'}`);
      console.log(`  - 分類: ${result.category.categories.map(c => c.name).join(', ')}`);
      console.log(`  - 標籤: ${result.category.tags.slice(0, 5).map(t => t.name).join(', ')}`);
    }

    console.log('\n✨ 測試完成！');
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤詳情:', error.message);
      console.error('堆疊追蹤:', error.stack);
    }
    process.exit(1);
  }
}

testManualWorkflow();
