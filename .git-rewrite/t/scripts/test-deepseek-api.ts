/**
 * 測試 DeepSeek 官方 API
 * 確認 deepseek-reasoner 和 deepseek-chat 可用性
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 明確載入 .env.local
config({ path: resolve(process.cwd(), '.env.local') });

interface ModelTest {
  id: string;
  name: string;
}

const DEEPSEEK_MODELS: ModelTest[] = [
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat' },
];

async function testDeepSeekModel(model: ModelTest): Promise<{
  success: boolean;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'user', content: 'Say "test" in one word.' }
        ],
        max_tokens: 10,
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
  console.log('🔍 驗證 DeepSeek 官方 API\n');

  const results: Array<{
    model: ModelTest;
    result: Awaited<ReturnType<typeof testDeepSeekModel>>;
  }> = [];

  for (const model of DEEPSEEK_MODELS) {
    console.log(`測試 ${model.name} (${model.id})...`);
    const result = await testDeepSeekModel(model);
    results.push({ model, result });

    if (result.success) {
      console.log(`  ✅ 成功 (${result.responseTime}ms)`);
    } else {
      console.log(`  ❌ 失敗: ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 測試結果\n');

  const successCount = results.filter(r => r.result.success).length;
  console.log(`總計: ${results.length} 個模型`);
  console.log(`成功: ${successCount} ✅`);
  console.log(`失敗: ${results.length - successCount} ❌`);

  if (successCount === results.length) {
    console.log('\n✅ DeepSeek 官方 API 完全可用！');
  }

  process.exit(successCount === results.length ? 0 : 1);
}

main().catch(console.error);
