/**
 * 測試高 CP 值模型配置
 * 驗證免費模型是否能達到 90% 品質標準
 */

import * as dotenv from 'dotenv';
import { ParallelOrchestrator } from '@/lib/agents/orchestrator';
import { createClient } from '@supabase/supabase-js';
import { modelPresets } from '@/config/model-presets';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
  preset: string;
  success: boolean;
  qualityScore?: number;
  executionTime?: number;
  tokenUsage?: {
    input: number;
    output: number;
    estimatedCost: number;
    virtualCost: number;
  };
  errors?: string[];
}

async function testPreset(presetName: string): Promise<TestResult> {
  console.log(`\n🔬 測試預設配置: ${presetName}`);
  console.log('━'.repeat(60));

  const preset = modelPresets[presetName];
  if (!preset) {
    return {
      preset: presetName,
      success: false,
      errors: ['預設配置不存在']
    };
  }

  console.log(`📊 配置詳情:`);
  console.log(`  - 名稱: ${preset.name}`);
  console.log(`  - 描述: ${preset.description}`);
  console.log(`  - 預估成本: $${preset.estimatedCostPerArticle}/篇`);
  console.log(`  - 品質分數: ${preset.qualityScore}/100`);
  console.log(`  - 模型配置:`);
  Object.entries(preset.models).forEach(([key, value]) => {
    console.log(`    ${key}: ${value}`);
  });

  try {
    // 準備測試資料
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
      .single();

    if (!company) {
      throw new Error('找不到測試公司');
    }

    const { data: website } = await supabase
      .from('websites')
      .select('*')
      .eq('company_id', company.id)
      .limit(1)
      .single();

    if (!website) {
      throw new Error('找不到測試網站');
    }

    // 更新公司的模型配置
    await supabase
      .from('companies')
      .update({
        ai_model_preferences: preset.models
      })
      .eq('id', company.id);

    // 創建測試文章任務
    const { data: articleJob } = await supabase
      .from('article_jobs')
      .insert({
        website_id: website.id,
        keyword: `測試文章 - ${presetName} 配置`,
        target_word_count: 1000,
        status: 'processing',
      })
      .select()
      .single();

    // 執行文章生成
    const startTime = Date.now();
    const orchestrator = new ParallelOrchestrator(supabase);

    const result = await orchestrator.execute({
      articleJobId: articleJob.id,
      websiteId: website.id,
      companyId: company.id,
      keyword: articleJob.keyword,
      region: 'TW',
    });

    const executionTime = Date.now() - startTime;

    // 計算 token 使用量和成本
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    if (result.research?.executionInfo) {
      totalInputTokens += result.research.executionInfo.tokenUsage?.input || 0;
      totalOutputTokens += result.research.executionInfo.tokenUsage?.output || 0;
    }
    if (result.strategy?.executionInfo) {
      totalInputTokens += result.strategy.executionInfo.tokenUsage?.input || 0;
      totalOutputTokens += result.strategy.executionInfo.tokenUsage?.output || 0;
    }
    if (result.writing?.executionInfo) {
      totalInputTokens += result.writing.executionInfo.tokenUsage?.input || 0;
      totalOutputTokens += result.writing.executionInfo.tokenUsage?.output || 0;
    }
    if (result.meta?.executionInfo) {
      totalInputTokens += result.meta.executionInfo.tokenUsage?.input || 0;
      totalOutputTokens += result.meta.executionInfo.tokenUsage?.output || 0;
    }

    // 計算虛擬成本（按 GPT-5 價格）
    const virtualCost = (totalInputTokens / 1000) * 0.00125 + (totalOutputTokens / 1000) * 0.01;

    // 品質評分
    const qualityScore = result.quality?.score || 0;

    console.log(`\n✅ 測試成功完成`);
    console.log(`  執行時間: ${(executionTime / 1000).toFixed(2)}秒`);
    console.log(`  Token 使用: ${totalInputTokens} input / ${totalOutputTokens} output`);
    console.log(`  虛擬成本: $${virtualCost.toFixed(4)}`);
    console.log(`  品質分數: ${qualityScore}/100`);

    // 清理測試資料
    await supabase
      .from('article_jobs')
      .delete()
      .eq('id', articleJob.id);

    return {
      preset: presetName,
      success: true,
      qualityScore,
      executionTime,
      tokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
        estimatedCost: preset.estimatedCostPerArticle,
        virtualCost
      }
    };

  } catch (error) {
    console.error(`\n❌ 測試失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    return {
      preset: presetName,
      success: false,
      errors: [error instanceof Error ? error.message : '未知錯誤']
    };
  }
}

async function runComparison() {
  console.log('\n🚀 開始高 CP 值模型配置對比測試');
  console.log('═'.repeat(60));

  const presetsToTest = [
    'balanced',       // 標準配置（基準線）
    'costEffective',  // 高CP值配置
    'budget'          // 預算配置
  ];

  const results: TestResult[] = [];

  for (const preset of presetsToTest) {
    const result = await testPreset(preset);
    results.push(result);

    // 等待 5 秒避免 rate limit
    if (preset !== presetsToTest[presetsToTest.length - 1]) {
      console.log('\n⏳ 等待 5 秒後繼續下一個測試...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 生成對比報告
  console.log('\n\n📊 測試結果對比報告');
  console.log('═'.repeat(60));

  console.log('\n| 配置 | 品質分數 | 執行時間 | Token成本 | 虛擬成本 | 狀態 |');
  console.log('|------|---------|---------|----------|---------|------|');

  results.forEach(result => {
    const preset = modelPresets[result.preset];
    const qualityScore = result.qualityScore || 0;
    const executionTime = result.executionTime ? `${(result.executionTime / 1000).toFixed(1)}s` : 'N/A';
    const estimatedCost = preset ? `$${preset.estimatedCostPerArticle.toFixed(3)}` : 'N/A';
    const virtualCost = result.tokenUsage ? `$${result.tokenUsage.virtualCost.toFixed(3)}` : 'N/A';
    const status = result.success ? '✅' : '❌';

    console.log(
      `| ${preset?.name || result.preset} | ${qualityScore}/100 | ${executionTime} | ${estimatedCost} | ${virtualCost} | ${status} |`
    );
  });

  // 分析結論
  console.log('\n\n🎯 分析結論');
  console.log('━'.repeat(60));

  const balanced = results.find(r => r.preset === 'balanced');
  const costEffective = results.find(r => r.preset === 'costEffective');

  if (balanced?.success && costEffective?.success) {
    const qualityRatio = ((costEffective.qualityScore || 0) / (balanced.qualityScore || 0)) * 100;
    const costRatio = ((costEffective.tokenUsage?.virtualCost || 0) / (balanced.tokenUsage?.virtualCost || 0)) * 100;

    console.log(`\n📊 高CP值配置 vs 標準配置:`);
    console.log(`  - 品質保留率: ${qualityRatio.toFixed(1)}%`);
    console.log(`  - 成本比例: ${costRatio.toFixed(1)}%`);
    console.log(`  - 成本節省: ${(100 - costRatio).toFixed(1)}%`);

    if (qualityRatio >= 90) {
      console.log(`\n✅ 高CP值配置達到 90% 品質標準，建議採用！`);
    } else {
      console.log(`\n⚠️ 高CP值配置品質略低於 90%，需要進一步優化`);
    }
  }
}

// 主程式
async function main() {
  try {
    await runComparison();
    console.log('\n\n✅ 測試完成');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
    process.exit(1);
  }
}

// 執行測試
main().catch(console.error);