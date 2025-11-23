/**
 * 驗證 OpenRouter 上的模型可用性
 * 測試所有目標模型是否可以正常呼叫
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 明確載入 .env.local
config({ path: resolve(process.cwd(), '.env.local') });

interface ModelTest {
  id: string;
  name: string;
  provider: string;
  tier: 'complex' | 'simple' | 'both';
}

const MODELS_TO_TEST: ModelTest[] = [
  // DeepSeek
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', tier: 'complex' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', tier: 'simple' },

  // OpenAI
  { id: 'openai/gpt-5', name: 'GPT-5', provider: 'openai', tier: 'complex' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', tier: 'simple' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', tier: 'both' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', tier: 'simple' },

  // Google
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', tier: 'complex' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', tier: 'complex' },

  // Anthropic
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'anthropic', tier: 'both' },
];

async function testModel(model: ModelTest): Promise<{
  success: boolean;
  responseTime?: number;
  error?: string;
  actualModel?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'user', content: 'Say "test" in one word.' }
        ],
        max_tokens: 50,  // 某些模型需要 >= 16
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}: ${error}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      responseTime,
      actualModel: data.model,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('🔍 驗證 OpenRouter 模型可用性\n');
  console.log(`測試 ${MODELS_TO_TEST.length} 個模型...\n`);

  const results: Array<{
    model: ModelTest;
    result: Awaited<ReturnType<typeof testModel>>;
  }> = [];

  // 依序測試每個模型（避免 rate limit）
  for (const model of MODELS_TO_TEST) {
    console.log(`測試 ${model.name} (${model.id})...`);
    const result = await testModel(model);
    results.push({ model, result });

    if (result.success) {
      console.log(`  ✅ 成功 (${result.responseTime}ms)`);
      if (result.actualModel && result.actualModel !== model.id) {
        console.log(`  ⚠️  實際模型: ${result.actualModel}`);
      }
    } else {
      console.log(`  ❌ 失敗: ${result.error}`);
    }

    // 避免 rate limit，等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 統計結果
  console.log('\n' + '='.repeat(60));
  console.log('📊 測試結果統計\n');

  const successCount = results.filter(r => r.result.success).length;
  const failCount = results.length - successCount;

  console.log(`總計: ${results.length} 個模型`);
  console.log(`成功: ${successCount} ✅`);
  console.log(`失敗: ${failCount} ❌`);
  console.log(`成功率: ${((successCount / results.length) * 100).toFixed(1)}%`);

  // 按 tier 分組
  console.log('\n按處理階段分組:');
  const byTier = {
    complex: results.filter(r => r.model.tier === 'complex'),
    simple: results.filter(r => r.model.tier === 'simple'),
    both: results.filter(r => r.model.tier === 'both'),
  };

  for (const [tier, models] of Object.entries(byTier)) {
    const success = models.filter(r => r.result.success).length;
    console.log(`  ${tier}: ${success}/${models.length} 可用`);
  }

  // 列出失敗的模型
  if (failCount > 0) {
    console.log('\n❌ 失敗的模型:');
    results
      .filter(r => !r.result.success)
      .forEach(({ model, result }) => {
        console.log(`  - ${model.name} (${model.id})`);
        console.log(`    錯誤: ${result.error}`);
      });
  }

  // 列出可用的模型（供 migration 使用）
  console.log('\n✅ 可用的模型 (供 migration 使用):');
  results
    .filter(r => r.result.success)
    .forEach(({ model }) => {
      console.log(`  - ${model.id} (${model.tier})`);
    });

  // 建議的 fallback 鏈
  console.log('\n🔄 建議的 Fallback 鏈:');
  const complexModels = results
    .filter(r => r.result.success && (r.model.tier === 'complex' || r.model.tier === 'both'))
    .map(r => r.model.id);
  const simpleModels = results
    .filter(r => r.result.success && (r.model.tier === 'simple' || r.model.tier === 'both'))
    .map(r => r.model.id);

  console.log('  複雜處理:', complexModels.join(' → '));
  console.log('  簡單功能:', simpleModels.join(' → '));

  // 退出碼
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
