import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';

async function main() {
  console.log('=== 完整工作流測試（含 WordPress 發布）===\n');

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY',
    'SERPAPI_API_KEY',
    'WORDPRESS_URL',
    'WORDPRESS_USERNAME',
    'WORDPRESS_APP_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的環境變數:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n請在 .env 檔案中設定這些變數');
    process.exit(1);
  }

  console.log('✓ 環境變數檢查通過\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('步驟 1/8: 準備測試資料...');

  const { data: testCompany, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .limit(1)
    .single();

  if (companyError || !testCompany) {
    console.error('❌ 找不到測試公司，請先建立測試資料');
    process.exit(1);
  }

  console.log(`✓ 測試公司: ${testCompany.name} (${testCompany.id})\n`);

  console.log('步驟 2/8: 檢查或建立測試網站...');

  let testWebsite;
  const { data: existingWebsite } = await supabase
    .from('website_configs')
    .select('*')
    .eq('company_id', testCompany.id)
    .limit(1)
    .single();

  if (existingWebsite) {
    testWebsite = existingWebsite;
    console.log(`✓ 使用現有網站: ${testWebsite.site_name}`);
  } else {
    const { data: newWebsite, error: websiteError } = await supabase
      .from('website_configs')
      .insert({
        company_id: testCompany.id,
        site_name: 'Test WordPress Site',
        site_url: process.env.WORDPRESS_URL!,
        wordpress_url: process.env.WORDPRESS_URL!,
        wordpress_username: process.env.WORDPRESS_USERNAME!,
        wordpress_password: process.env.WORDPRESS_APP_PASSWORD!,
        status: 'active',
      })
      .select()
      .single();

    if (websiteError || !newWebsite) {
      console.error('❌ 建立測試網站失敗:', websiteError);
      process.exit(1);
    }

    testWebsite = newWebsite;
    console.log(`✓ 建立測試網站: ${testWebsite.site_name}`);
  }

  console.log('');

  console.log('步驟 3/8: 建立文章任務...');

  const { data: articleJob, error: jobError } = await supabase
    .from('article_jobs')
    .insert({
      website_id: testWebsite.id,
      keyword: 'AI 內容生成自動化工具',
      region: 'zh-TW',
      status: 'pending',
    })
    .select()
    .single();

  if (jobError || !articleJob) {
    console.error('❌ 建立文章任務失敗:', jobError);
    process.exit(1);
  }

  console.log(`✓ 文章任務 ID: ${articleJob.id}\n`);

  console.log('步驟 4/8: 初始化 Orchestrator...');
  const orchestrator = new ParallelOrchestrator(supabase);
  console.log('✓ Orchestrator 已初始化\n');

  console.log('步驟 5/8: 執行完整文章生成流程...');
  console.log('這將包含以下階段:');
  console.log('  1. 研究分析 (Research)');
  console.log('  2. 策略規劃 (Strategy)');
  console.log('  3. 內容撰寫 (Writing) + 圖片生成 (Image)');
  console.log('  4. SEO 元數據 (Meta)');
  console.log('  5. HTML 優化 (HTML)');
  console.log('  6. 品質檢查 (Quality)');
  console.log('  7. 分類標籤 (Category)');
  console.log('  8. WordPress 發布 (Publish)');
  console.log('');

  const startTime = Date.now();

  try {
    const result = await orchestrator.execute({
      articleJobId: articleJob.id,
      companyId: testCompany.id,
      websiteId: testWebsite.id,
      keyword: articleJob.keyword,
      region: articleJob.region,
    });

    const totalTime = Date.now() - startTime;

    console.log('\n=== 測試完成 ===\n');

    if (result.success) {
      console.log('✅ 文章生成成功！\n');
    } else {
      console.log('⚠️  文章生成完成，但品質檢查未通過\n');
    }

    console.log('執行結果:');
    console.log(`  - 總執行時間: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  - 研究階段: ${(result.executionStats!.phases.research / 1000).toFixed(2)}s`);
    console.log(`  - 策略階段: ${(result.executionStats!.phases.strategy / 1000).toFixed(2)}s`);
    console.log(`  - 內容生成: ${(result.executionStats!.phases.contentGeneration / 1000).toFixed(2)}s`);
    console.log(`  - 元數據生成: ${(result.executionStats!.phases.metaGeneration / 1000).toFixed(2)}s`);
    console.log(`  - 品質檢查: ${(result.executionStats!.phases.qualityCheck / 1000).toFixed(2)}s`);
    console.log(`  - 並行加速比: ${result.executionStats!.parallelSpeedup.toFixed(2)}x\n`);

    if (result.quality) {
      console.log('品質檢查結果:');
      console.log(`  - 總分: ${result.quality.score}/100`);
      console.log(`  - 通過: ${result.quality.passed ? '✓' : '✗'}`);
      console.log(`  - 字數: ${result.quality.checks.wordCount.actual} 字`);
      console.log(`  - 關鍵字密度: ${result.quality.checks.keywordDensity.actual.toFixed(2)}%`);
      console.log(`  - H1 標題: ${result.quality.checks.structure.h1Count} 個`);
      console.log(`  - H2 標題: ${result.quality.checks.structure.h2Count} 個`);
      console.log(`  - H3 標題: ${result.quality.checks.structure.h3Count} 個`);
      console.log(`  - 內部連結: ${result.quality.checks.internalLinks.count} 個`);
      console.log('');
    }

    if (result.wordpress) {
      console.log('WordPress 發布結果:');
      console.log(`  ✓ 文章 ID: ${result.wordpress.postId}`);
      console.log(`  ✓ 文章連結: ${result.wordpress.postUrl}`);
      console.log(`  ✓ 狀態: ${result.wordpress.status}`);
      console.log('');
      console.log('請前往 WordPress 查看文章顯示效果：');
      console.log(result.wordpress.postUrl);
      console.log('');
      console.log('檢查項目：');
      console.log('  1. HTML 標題層級是否正確');
      console.log('  2. 段落和列表格式是否正常');
      console.log('  3. 圖片是否正確顯示');
      console.log('  4. 內部和外部連結是否有效');
      console.log('  5. SEO 元數據是否正確設定');
      console.log('  6. 分類和標籤是否正確');
    } else {
      console.log('⚠️  WordPress 發布未啟用或失敗');
      console.log('請檢查 website_configs 表中的 WordPress 配置');
    }

    console.log('\n步驟 6/8: 更新文章任務狀態...');
    const { error: updateError } = await supabase
      .from('article_jobs')
      .update({
        status: result.success ? 'completed' : 'quality_failed',
        quality_score: result.quality?.score,
        wordpress_post_id: result.wordpress?.postId,
      })
      .eq('id', articleJob.id);

    if (updateError) {
      console.error('⚠️  更新任務狀態失敗:', updateError);
    } else {
      console.log('✓ 任務狀態已更新\n');
    }

    console.log('步驟 7/8: 檢查資料庫中的文章記錄...');
    const { data: updatedJob, error: fetchError } = await supabase
      .from('article_jobs')
      .select('*')
      .eq('id', articleJob.id)
      .single();

    if (fetchError || !updatedJob) {
      console.error('❌ 無法獲取文章記錄');
    } else {
      console.log('✓ 文章記錄:');
      console.log(`  - 狀態: ${updatedJob.status}`);
      console.log(`  - 品質分數: ${updatedJob.quality_score || 'N/A'}`);
      console.log(`  - WordPress Post ID: ${updatedJob.wordpress_post_id || 'N/A'}`);
      console.log('');
    }

    console.log('步驟 8/8: 測試總結');
    console.log('━'.repeat(60));
    console.log('✅ 完整工作流測試成功完成！');
    console.log('');
    console.log('後續步驟：');
    console.log('1. 前往 WordPress 檢查文章顯示效果');
    console.log('2. 驗證 SEO 元數據是否正確');
    console.log('3. 檢查圖片、連結是否正常');
    console.log('4. 測試不同關鍵字和語言');
    console.log('5. 優化 HTML 格式（如需要）');
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('\n❌ 測試過程中發生錯誤:');
    console.error(error);

    if (error instanceof Error) {
      console.error('\n錯誤訊息:', error.message);
      if (error.stack) {
        console.error('\n錯誤堆疊:');
        console.error(error.stack);
      }
    }

    process.exit(1);
  }
}

main().catch(console.error);
