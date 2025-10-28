import { createClient } from '@supabase/supabase-js';
import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';
import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  round: number;
  success: boolean;
  totalTime: number;
  researchModel?: string;
  strategyModel?: string;
  writingModel?: string;
  contentLength: number;
  categoryCount: number;
  tagCount: number;
  error?: string;
}

async function runMultiRoundTest(rounds: number = 5) {
  console.log(`🚀 開始執行 ${rounds} 輪測試\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: website, error: websiteError } = await supabase
    .from('website_configs')
    .select('id, company_id, website_name')
    .limit(1)
    .single();

  if (websiteError || !website) {
    console.error('❌ 找不到網站配置');
    process.exit(1);
  }

  console.log(`✅ 使用網站: ${website.website_name}\n`);

  const keywords = [
    'AI content generation',
    'machine learning automation',
    'content marketing strategy',
    'SEO optimization tools',
    'automated content creation'
  ];

  const results: TestResult[] = [];

  for (let i = 0; i < rounds; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 第 ${i + 1} 輪測試 (關鍵字: ${keywords[i % keywords.length]})`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = Date.now();
    let result: TestResult = {
      round: i + 1,
      success: false,
      totalTime: 0,
      contentLength: 0,
      categoryCount: 0,
      tagCount: 0
    };

    try {
      const { data: job, error: jobError } = await supabase
        .from('article_jobs')
        .insert({
          website_id: website.id,
          keywords: [keywords[i % keywords.length]],
          status: 'pending'
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to create job: ${jobError?.message}`);
      }

      console.log(`✅ 任務已建立: ${job.id}`);

      const orchestrator = new ParallelOrchestrator(supabase);
      const output = await orchestrator.execute({
        websiteId: website.id,
        companyId: website.company_id,
        articleJobId: job.id,
        keyword: keywords[i % keywords.length],
        region: 'en-US'
      });

      result.success = output.success;
      result.totalTime = Date.now() - startTime;
      result.contentLength = output.writing?.html?.length || 0;
      result.categoryCount = output.category?.categories?.length || 0;
      result.tagCount = output.category?.tags?.length || 0;
      result.researchModel = output.research?.executionInfo?.modelUsed;
      result.strategyModel = output.strategy?.executionInfo?.modelUsed;
      result.writingModel = output.writing?.executionInfo?.modelUsed;

      console.log(`\n✅ 第 ${i + 1} 輪測試完成`);
      console.log(`  - 總時間: ${(result.totalTime / 1000).toFixed(2)}s`);
      console.log(`  - Research 模型: ${result.researchModel || 'N/A'}`);
      console.log(`  - Strategy 模型: ${result.strategyModel || 'N/A'}`);
      console.log(`  - Writing 模型: ${result.writingModel || 'N/A'}`);
      console.log(`  - 內容長度: ${result.contentLength} 字元`);
      console.log(`  - 分類數量: ${result.categoryCount}`);
      console.log(`  - 標籤數量: ${result.tagCount}`);

    } catch (error: any) {
      result.error = error.message;
      result.totalTime = Date.now() - startTime;
      console.error(`\n❌ 第 ${i + 1} 輪測試失敗:`, error.message);
    }

    results.push(result);

    if (i < rounds - 1) {
      console.log(`\n⏳ 等待 5 秒後進行下一輪測試...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 測試結果統計');
  console.log(`${'='.repeat(60)}\n`);

  const successCount = results.filter(r => r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
  const avgLength = results.reduce((sum, r) => sum + r.contentLength, 0) / results.length;

  console.log(`✅ 成功: ${successCount}/${rounds} (${(successCount / rounds * 100).toFixed(1)}%)`);
  console.log(`⏱️  平均時間: ${(avgTime / 1000).toFixed(2)}s`);
  console.log(`📝 平均長度: ${Math.round(avgLength)} 字元`);

  console.log(`\n各輪詳細結果:`);
  console.table(results.map(r => ({
    輪次: r.round,
    成功: r.success ? '✅' : '❌',
    時間: `${(r.totalTime / 1000).toFixed(2)}s`,
    Research模型: r.researchModel || 'N/A',
    Strategy模型: r.strategyModel || 'N/A',
    Writing模型: r.writingModel || 'N/A',
    內容長度: r.contentLength,
    分類數: r.categoryCount,
    標籤數: r.tagCount,
    錯誤: r.error || '-'
  })));

  const reportPath = path.join(process.cwd(), 'test-results.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 完整報告已儲存至: ${reportPath}`);
}

const rounds = parseInt(process.argv[2]) || 5;
runMultiRoundTest(rounds).catch(console.error);
