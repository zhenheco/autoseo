import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import { v4 as uuidv4 } from 'uuid';

async function generateArticle() {
  console.log('=== 生成文章並發布到 WordPress ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 從資料庫取得第一個啟用的網站配置
  const { data: websites, error: websitesError } = await supabase
    .from('website_configs')
    .select('id, company_id, website_name, wordpress_url, wp_enabled')
    .eq('is_active', true)
    .eq('wp_enabled', true)
    .limit(1);

  if (websitesError || !websites || websites.length === 0) {
    console.error('❌ 無法從資料庫取得網站配置:', websitesError);
    console.error('提示: 請確保 website_configs 表中有啟用的網站（is_active=true, wp_enabled=true）');
    process.exit(1);
  }

  const website = websites[0];
  const websiteId = website.id;
  const companyId = website.company_id;

  // 測試關鍵字（可以從命令列參數或資料庫讀取）
  const keyword = process.argv[2] || '老虎機技巧教學';

  console.log(`網站名稱: ${website.website_name}`);
  console.log(`網站 ID: ${websiteId}`);
  console.log(`公司 ID: ${companyId}`);
  console.log(`WordPress URL: ${website.wordpress_url}`);
  console.log(`關鍵字: ${keyword}\n`);

  const orchestrator = new ParallelOrchestrator(supabase);

  console.log('開始生成文章...\n');

  try {
    const result = await orchestrator.execute({
      keyword,
      websiteId,
      companyId,
      articleJobId: uuidv4(),
      region: 'zh-TW',
    });

    console.log('\n=== 生成完成 ===\n');

    if (result.success) {
      console.log('✅ 生成成功');

      if (result.meta) {
        console.log('文章標題:', result.meta.seo?.title);
        console.log('SEO 描述:', result.meta.seo?.description);
        console.log('Focus Keyword:', result.meta.focusKeyphrase);
      }

      if (result.writing) {
        console.log('字數:', result.writing.statistics?.wordCount);

        const content = result.writing.html || result.writing.markdown || '';
        if (content) {
          console.log('\n文章內容預覽（前 500 字）:');
          console.log(content.substring(0, 500) + '...');
        }
      }

      if (result.wordpress) {
        console.log('\n✅ 已發布到 WordPress');
        console.log('文章 ID:', result.wordpress.postId);
        console.log('文章連結:', result.wordpress.postUrl);
        console.log('狀態:', result.wordpress.status);
      }

      if (result.category) {
        console.log('\n分類和標籤:');
        console.log('分類:', result.category.categories.map(c => c.name).join(', '));
        console.log('標籤:', result.category.tags.map(t => t.name).join(', '));
      }

      if (result.savedArticle) {
        console.log('\n✅ 已儲存到資料庫');
        console.log('文章 ID:', result.savedArticle.id);
        console.log('推薦數量:', result.savedArticle.recommendationsCount);
      }

    } else {
      console.log('❌ 生成失敗或品質未通過');

      if (result.quality) {
        console.log('\n品質檢查結果:');
        console.log('通過:', result.quality.passed);
        console.log('分數:', result.quality.score);
        if (result.quality.recommendations?.length > 0) {
          console.log('建議:', result.quality.recommendations.map(r => `${r.priority}: ${r.message}`).join('\n  '));
        }
      }
    }

    if (result.executionStats) {
      console.log('\n執行統計:');
      console.log('總時間:', (result.executionStats.totalTime / 1000).toFixed(2), '秒');
      console.log('各階段時間:', result.executionStats.phases);
    }

  } catch (error) {
    console.error('\n❌ 生成失敗:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      if (error.stack) {
        console.error('\n錯誤堆疊:', error.stack);
      }
    }
    process.exit(1);
  }
}

generateArticle().catch(console.error);
