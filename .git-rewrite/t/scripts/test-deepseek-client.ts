/**
 * 測試 DeepSeek 官方 API 客戶端
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { DeepSeekClient, getDeepSeekClient } from '@/lib/deepseek/client';

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') });

async function testDeepSeekChat() {
  console.log('🧪 測試 DeepSeek Chat 模型...\n');

  const client = getDeepSeekClient();

  if (!client.isConfigured()) {
    console.error('❌ DeepSeek API Key 未設定');
    console.log('請在 .env.local 中設定 DEEPSEEK_API_KEY');
    return;
  }

  try {
    const result = await client.complete({
      model: 'deepseek-chat',
      prompt: 'What is 2+2? Answer in one word.',
      temperature: 0.3,
      max_tokens: 50,
    });

    console.log('✅ DeepSeek Chat 測試成功');
    console.log(`📝 回應: ${result.content}`);
    console.log(`🔢 Token 使用:`);
    console.log(`  - Input: ${result.usage.prompt_tokens}`);
    console.log(`  - Output: ${result.usage.completion_tokens}`);
    console.log(`  - Total: ${result.usage.total_tokens}`);
    console.log(`📦 模型: ${result.model}\n`);

    return result;
  } catch (error) {
    console.error('❌ DeepSeek Chat 測試失敗:', error);
    throw error;
  }
}

async function testDeepSeekReasoner() {
  console.log('🧪 測試 DeepSeek Reasoner 模型...\n');

  const client = getDeepSeekClient();

  try {
    const result = await client.complete({
      model: 'deepseek-reasoner',
      prompt: 'Explain why the sky is blue in simple terms (max 50 words).',
      temperature: 0.5,
      max_tokens: 200,
    });

    console.log('✅ DeepSeek Reasoner 測試成功');
    console.log(`📝 回應: ${result.content}`);
    console.log(`🔢 Token 使用:`);
    console.log(`  - Input: ${result.usage.prompt_tokens}`);
    console.log(`  - Output: ${result.usage.completion_tokens}`);
    console.log(`  - Total: ${result.usage.total_tokens}`);
    console.log(`📦 模型: ${result.model}\n`);

    return result;
  } catch (error) {
    console.error('❌ DeepSeek Reasoner 測試失敗:', error);
    throw error;
  }
}

async function testJSONResponse() {
  console.log('🧪 測試 JSON 格式回應...\n');

  const client = getDeepSeekClient();

  try {
    const result = await client.complete({
      model: 'deepseek-chat',
      prompt: 'Return a JSON object with two fields: "name" (your name) and "version" (your version). Format: {"name": "...", "version": "..."}',
      temperature: 0.3,
      max_tokens: 100,
      responseFormat: 'json',
    });

    console.log('✅ JSON 格式測試成功');
    console.log(`📝 回應: ${result.content}`);
    console.log(`🔢 Token 使用: ${result.usage.total_tokens}`);

    // 驗證 JSON 格式
    try {
      const parsed = JSON.parse(result.content);
      console.log('✅ JSON 解析成功:', parsed);
    } catch {
      console.warn('⚠️ 回應不是有效的 JSON');
    }

    return result;
  } catch (error) {
    console.error('❌ JSON 格式測試失敗:', error);
    throw error;
  }
}

async function testRetryMechanism() {
  console.log('🧪 測試 Retry 機制（使用錯誤的 API Key）...\n');

  const client = new DeepSeekClient({
    apiKey: 'invalid-key',
    maxRetries: 2,
  });

  try {
    await client.complete({
      model: 'deepseek-chat',
      prompt: 'Test',
    });

    console.error('❌ 應該要失敗但成功了');
  } catch (error) {
    if (error instanceof Error) {
      console.log('✅ Retry 機制正常（預期錯誤）');
      console.log(`📝 錯誤訊息: ${error.message}\n`);
    }
  }
}

async function testModelRecommendation() {
  console.log('🧪 測試模型推薦...\n');

  const complexModel = DeepSeekClient.recommendModel('complex');
  const simpleModel = DeepSeekClient.recommendModel('simple');

  console.log(`✅ 複雜處理推薦: ${complexModel}`);
  console.log(`✅ 簡單功能推薦: ${simpleModel}\n`);
}

async function main() {
  console.log('=' + '='.repeat(60));
  console.log('🚀 DeepSeek 客戶端測試開始\n');

  const results = {
    chat: false,
    reasoner: false,
    json: false,
    retry: false,
    recommendation: false,
  };

  // 測試 1: DeepSeek Chat
  try {
    await testDeepSeekChat();
    results.chat = true;
  } catch (error) {
    console.error('Chat 測試失敗\n');
  }

  // 測試 2: DeepSeek Reasoner
  try {
    await testDeepSeekReasoner();
    results.reasoner = true;
  } catch (error) {
    console.error('Reasoner 測試失敗\n');
  }

  // 測試 3: JSON 格式
  try {
    await testJSONResponse();
    results.json = true;
  } catch (error) {
    console.error('JSON 測試失敗\n');
  }

  // 測試 4: Retry 機制
  try {
    await testRetryMechanism();
    results.retry = true;
  } catch (error) {
    console.error('Retry 測試失敗\n');
  }

  // 測試 5: 模型推薦
  try {
    testModelRecommendation();
    results.recommendation = true;
  } catch (error) {
    console.error('模型推薦測試失敗\n');
  }

  // 總結
  console.log('=' + '='.repeat(60));
  console.log('📊 測試結果總結\n');

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  console.log(`\n總計: ${passedTests}/${totalTests} 測試通過`);
  console.log('=' + '='.repeat(60));

  // 退出碼
  process.exit(passedTests === totalTests ? 0 : 1);
}

main().catch(error => {
  console.error('💥 測試執行失敗:', error);
  process.exit(1);
});
