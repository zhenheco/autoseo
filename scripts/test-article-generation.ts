import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import type { ArticleGenerationInput } from '../src/types/agents';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testArticleGeneration() {
  console.log('🚀 開始測試文章生成流程\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. 檢查必要的環境變數
    console.log('📋 檢查環境設定...');
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENROUTER_API_KEY',
    ];

    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
    if (missingVars.length > 0) {
      console.error('❌ 缺少必要的環境變數:', missingVars.join(', '));
      process.exit(1);
    }
    console.log('✅ 環境變數檢查通過\n');

    // 2. 檢查資料庫連線
    console.log('🔌 檢查資料庫連線...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (healthError) {
      console.error('❌ 資料庫連線失敗:', healthError.message);
      process.exit(1);
    }
    console.log('✅ 資料庫連線正常\n');

    // 3. 檢查 AI 模型
    console.log('🤖 檢查 AI 模型配置...');
    const { data: models, error: modelsError } = await supabase
      .from('ai_models')
      .select('model_id, model_name, model_type, is_active')
      .eq('is_active', true);

    if (modelsError || !models || models.length === 0) {
      console.error('❌ 無法載入 AI 模型:', modelsError?.message);
      process.exit(1);
    }
    console.log(`✅ 找到 ${models.length} 個可用的 AI 模型`);
    console.log('   文字模型:', models.filter((m) => m.model_type === 'text').length);
    console.log('   圖片模型:', models.filter((m) => m.model_type === 'image').length);
    console.log('');

    // 4. 取得或建立測試公司
    console.log('🏢 準備測試資料...');
    let testCompanyId: string;
    let testUserId: string;

    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (existingCompany) {
      testCompanyId = existingCompany.id;
      console.log('✅ 使用現有公司:', testCompanyId);
    } else {
      console.error('❌ 找不到測試公司，請先建立公司資料');
      process.exit(1);
    }

    // 取得公司成員
    const { data: members } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', testCompanyId)
      .limit(1);

    if (!members || members.length === 0) {
      console.error('❌ 找不到公司成員');
      process.exit(1);
    }
    testUserId = members[0].user_id;
    console.log('✅ 使用測試使用者:', testUserId);

    // 5. 取得或建立測試網站
    let testWebsiteId: string;
    const { data: existingWebsite } = await supabase
      .from('website_configs')
      .select('id')
      .eq('company_id', testCompanyId)
      .limit(1)
      .single();

    if (existingWebsite) {
      testWebsiteId = existingWebsite.id;
      console.log('✅ 使用現有網站:', testWebsiteId);
    } else {
      console.log('📝 建立測試網站...');
      const { data: newWebsite, error: websiteError } = await supabase
        .from('website_configs')
        .insert({
          company_id: testCompanyId,
          website_url: 'https://test-blog.example.com',
          wordpress_username: 'test_user',
          wordpress_app_password: 'test_password',
          cname_verified: false,
        })
        .select('id')
        .single();

      if (websiteError || !newWebsite) {
        console.error('❌ 建立網站失敗:', websiteError?.message);
        process.exit(1);
      }
      testWebsiteId = newWebsite.id;
      console.log('✅ 測試網站已建立:', testWebsiteId);
    }

    // 6. 建立測試文章任務
    console.log('\n📝 建立測試文章任務...');
    const testKeyword = 'Next.js 15 新功能介紹';

    const { data: articleJob, error: jobError } = await supabase
      .from('article_jobs')
      .insert({
        company_id: testCompanyId,
        website_id: testWebsiteId,
        input_type: 'keyword',
        keywords: [testKeyword],
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobError || !articleJob) {
      console.error('❌ 建立文章任務失敗:', jobError?.message);
      process.exit(1);
    }

    console.log('✅ 文章任務已建立:', articleJob.id);
    console.log('   關鍵字:', testKeyword);
    console.log('');

    // 7. 執行 Orchestrator
    console.log('🎯 開始執行文章生成流程...\n');
    console.log('=' .repeat(60));

    const input: ArticleGenerationInput = {
      articleJobId: articleJob.id,
      companyId: testCompanyId,
      websiteId: testWebsiteId,
      keyword: testKeyword,
      region: 'TW',
    };

    const orchestrator = new ParallelOrchestrator();
    const startTime = Date.now();

    try {
      const result = await orchestrator.execute(input);
      const totalTime = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log('🎉 文章生成完成！\n');

      // 顯示結果
      console.log('📊 執行統計:');
      console.log(`   總執行時間: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`   成功: ${result.success ? '✅' : '❌'}`);
      console.log('');

      console.log('⏱️  各階段執行時間:');
      console.log(`   Research: ${(result.executionStats.phases.research / 1000).toFixed(2)}s`);
      console.log(`   Strategy: ${(result.executionStats.phases.strategy / 1000).toFixed(2)}s`);
      console.log(`   Content: ${(result.executionStats.phases.contentGeneration / 1000).toFixed(2)}s`);
      console.log(`   Meta: ${(result.executionStats.phases.metaGeneration / 1000).toFixed(2)}s`);
      console.log(`   Quality: ${(result.executionStats.phases.qualityCheck / 1000).toFixed(2)}s`);
      console.log(`   並行加速: ${result.executionStats.parallelSpeedup.toFixed(2)}x`);
      console.log('');

      if (result.quality) {
        console.log('✨ 品質檢查結果:');
        console.log(`   分數: ${result.quality.score}/100`);
        console.log(`   通過: ${result.quality.passed ? '✅' : '❌'}`);
        console.log('');
      }

      if (result.writing) {
        console.log('📝 文章資訊:');
        console.log(`   字數: ${result.writing.statistics.wordCount}`);
        console.log(`   段落數: ${result.writing.statistics.paragraphCount}`);
        console.log(`   閱讀時間: ${result.writing.statistics.readingTime} 分鐘`);
        console.log('');
      }

      if (result.errors && Object.keys(result.errors).length > 0) {
        console.log('⚠️  錯誤:');
        Object.entries(result.errors).forEach(([agent, error]) => {
          console.log(`   ${agent}: ${error.message}`);
        });
        console.log('');
      }

      // 查看資料庫中的記錄
      const { data: finalJob } = await supabase
        .from('article_jobs')
        .select('status, generated_content')
        .eq('id', articleJob.id)
        .single();

      console.log('💾 資料庫狀態:');
      console.log(`   任務狀態: ${finalJob?.status || 'unknown'}`);
      console.log(`   內容長度: ${finalJob?.generated_content?.length || 0} 字元`);
      console.log('');

    } catch (error: any) {
      console.error('\n❌ 執行失敗:', error.message);
      console.error('錯誤詳情:', error);
      process.exit(1);
    }

    console.log('✅ 測試完成！');

  } catch (error: any) {
    console.error('❌ 測試過程發生錯誤:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testArticleGeneration();
