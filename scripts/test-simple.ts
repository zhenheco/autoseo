#!/usr/bin/env tsx

import 'dotenv/config';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import { createClient } from '@supabase/supabase-js';

async function testSimple() {
  console.log('🚀 簡化測試 - 直接執行 Orchestrator\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const openrouterKey = process.env.OPENROUTER_API_KEY!;

  if (!supabaseUrl || !supabaseKey || !openrouterKey) {
    console.error('❌ 缺少環境變數');
    console.log('需要：NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📋 請先在 Supabase Dashboard 手動準備資料：');
  console.log('1. 在 companies 表新增一筆資料');
  console.log('2. 在 website_configs 表新增一筆資料');
  console.log('3. 在 brand_voices 表新增一筆資料');
  console.log('4. 在 workflow_settings 表新增一筆資料\n');

  try {
    const { data: websites, error } = await supabase
      .from('website_configs')
      .select('id, company_id, website_name, wordpress_url')
      .limit(1);

    if (error) {
      console.error('❌ 資料庫錯誤:', error.message);
      process.exit(1);
    }

    if (!websites || websites.length === 0) {
      console.error('❌ 找不到網站配置，請先在 Supabase Dashboard 建立資料');
      console.log('\n建議 SQL：');
      console.log(`
        -- 1. 建立公司
        INSERT INTO companies (name, ai_model_preferences)
        VALUES ('Test Company', '{
          "text_model": "openai/gpt-4o",
          "research_model": "openai/gpt-4o",
          "meta_model": "google/gemini-2.0-flash-exp:free",
          "image_model": "none"
        }'::jsonb)
        RETURNING id;

        -- 2. 建立網站（使用上面的 company id）
        INSERT INTO website_configs (company_id, name, wordpress_url)
        VALUES ('[COMPANY_ID]', 'X-Marks', 'https://x-marks.com')
        RETURNING id;

        -- 3. 建立 Brand Voice（使用上面的 website id）
        INSERT INTO brand_voices (website_id, tone, style, vocabulary_level, target_audience)
        VALUES ('[WEBSITE_ID]', 'professional', 'informative', 'advanced', 'business professionals');

        -- 4. 建立 Workflow Settings（使用上面的 website id）
        INSERT INTO workflow_settings (
          website_id,
          competitor_count,
          content_length_min,
          content_length_max,
          quality_threshold,
          keyword_density_min,
          keyword_density_max,
          auto_publish
        )
        VALUES ('[WEBSITE_ID]', 5, 1500, 3000, 80, 0.01, 0.03, false);
      `);
      process.exit(1);
    }

    const website = websites[0];
    console.log(`✅ 找到網站: ${website.website_name || 'Unnamed'}\n`);

    const { data: job, error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        website_id: website.id,
        keywords: ['AI content generation'],
        status: 'pending',
        region: 'en-US',
        metadata: {}
      })
      .select()
      .single();

    if (jobError) {
      console.error('❌ 建立任務失敗:', jobError.message);
      process.exit(1);
    }

    console.log(`✅ 任務已建立: ${job.id}\n`);
    console.log('🎯 開始執行文章生成...\n');

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
    console.log(`  - 成功: ${result.success ? '✅' : '❌'}`);

    if (result.quality) {
      console.log(`  - 品質分數: ${result.quality.overallScore}/100`);
      console.log(`  - 通過: ${result.quality.passed ? '✅' : '❌'}`);
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤:', error.message);
    }
    process.exit(1);
  }
}

testSimple();
