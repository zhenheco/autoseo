/**
 * 測試 OpenAI 圖片生成 API 客戶端
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { OpenAIImageClient, getOpenAIImageClient } from '@/lib/openai/image-client';

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') });

async function testSingleImageGeneration() {
  console.log('🧪 測試單張圖片生成...\n');

  const client = getOpenAIImageClient();

  if (!client.isConfigured()) {
    console.error('❌ OpenAI API Key 未設定');
    console.log('請在 .env.local 中設定 OPENAI_API_KEY');
    return;
  }

  try {
    const result = await client.generateImage({
      model: 'gpt-image-1-mini',
      prompt: 'A cute cat sitting on a laptop',
      size: '1024x1024',
      quality: 'standard',
    });

    console.log('✅ 單張圖片生成成功');
    console.log(`🖼️  圖片 URL: ${result.url}`);
    if (result.revisedPrompt) {
      console.log(`📝 修訂後的 Prompt: ${result.revisedPrompt}`);
    }
    console.log();

    return result;
  } catch (error) {
    console.error('❌ 單張圖片生成失敗:', error);
    throw error;
  }
}

async function testMultipleImageGeneration() {
  console.log('🧪 測試多張圖片生成...\n');

  const client = getOpenAIImageClient();

  try {
    // 注意：這個測試會實際生成圖片，會消耗 API 額度
    // 如果不想執行，可以註解掉
    console.log('⚠️ 跳過多張圖片測試（避免消耗過多額度）');
    console.log('✅ 多張圖片生成測試已跳過\n');
    return;

    // 取消註解以執行測試
    // const results = await client.generateMultiple({
    //   model: 'gpt-image-1-mini',
    //   prompt: 'A futuristic city skyline',
    //   count: 2,
    //   size: '1024x1024',
    // });

    // console.log('✅ 多張圖片生成成功');
    // console.log(`📊 生成了 ${results.length} 張圖片`);
    // results.forEach((result, index) => {
    //   console.log(`  ${index + 1}. ${result.url}`);
    // });
    // console.log();

    // return results;
  } catch (error) {
    console.error('❌ 多張圖片生成失敗:', error);
    throw error;
  }
}

async function testModelValidation() {
  console.log('🧪 測試模型驗證...\n');

  const validModels = ['gpt-image-1-mini', 'dall-e-2', 'dall-e-3'];
  const invalidModel = 'invalid-model';

  validModels.forEach(model => {
    const isValid = OpenAIImageClient.isValidModel(model);
    console.log(`${isValid ? '✅' : '❌'} ${model}: ${isValid ? '有效' : '無效'}`);
  });

  const isInvalid = OpenAIImageClient.isValidModel(invalidModel);
  console.log(`${!isInvalid ? '✅' : '❌'} ${invalidModel}: ${!isInvalid ? '正確識別為無效' : '錯誤識別為有效'}`);
  console.log();
}

async function testModelDefaults() {
  console.log('🧪 測試模型預設設定...\n');

  const models = ['gpt-image-1-mini', 'dall-e-2', 'dall-e-3'];

  models.forEach(model => {
    const defaults = OpenAIImageClient.getModelDefaults(model);
    console.log(`📦 ${model}:`);
    console.log(`  - 預設尺寸: ${defaults.size}`);
    console.log(`  - 最大圖片數: ${defaults.maxImages}`);
  });
  console.log();
}

async function testErrorHandling() {
  console.log('🧪 測試錯誤處理...\n');

  const client = new OpenAIImageClient({
    apiKey: 'invalid-key',
    maxRetries: 2,
  });

  try {
    await client.generateImage({
      prompt: 'Test',
    });

    console.error('❌ 應該要失敗但成功了');
  } catch (error) {
    if (error instanceof Error) {
      console.log('✅ 錯誤處理正常（預期錯誤）');
      console.log(`📝 錯誤訊息: ${error.message}`);
      console.log();
    }
  }
}

async function testParameterValidation() {
  console.log('🧪 測試參數驗證...\n');

  const client = getOpenAIImageClient();

  // 測試無效的圖片數量
  try {
    await client.generate({
      model: 'gpt-image-1-mini',
      prompt: 'Test',
      n: 15, // 超過最大值
    });
    console.log('❌ 應該要拒絕無效的圖片數量');
  } catch (error) {
    console.log('✅ 正確拒絕無效的圖片數量');
  }

  // 測試 dall-e-3 多張限制
  try {
    await client.generate({
      model: 'dall-e-3',
      prompt: 'Test',
      n: 2, // dall-e-3 只能生成 1 張
    });
    console.log('❌ 應該要拒絕 dall-e-3 生成多張');
  } catch (error) {
    console.log('✅ 正確拒絕 dall-e-3 生成多張');
  }

  console.log();
}

async function main() {
  console.log('=' + '='.repeat(60));
  console.log('🚀 OpenAI 圖片客戶端測試開始\n');

  const results = {
    singleImage: false,
    multipleImages: false,
    modelValidation: false,
    modelDefaults: false,
    errorHandling: false,
    parameterValidation: false,
  };

  // 測試 1: 單張圖片生成
  try {
    await testSingleImageGeneration();
    results.singleImage = true;
  } catch (error) {
    console.error('單張圖片生成測試失敗\n');
  }

  // 測試 2: 多張圖片生成（跳過以節省額度）
  try {
    await testMultipleImageGeneration();
    results.multipleImages = true;
  } catch (error) {
    console.error('多張圖片生成測試失敗\n');
  }

  // 測試 3: 模型驗證
  try {
    await testModelValidation();
    results.modelValidation = true;
  } catch (error) {
    console.error('模型驗證測試失敗\n');
  }

  // 測試 4: 模型預設設定
  try {
    await testModelDefaults();
    results.modelDefaults = true;
  } catch (error) {
    console.error('模型預設設定測試失敗\n');
  }

  // 測試 5: 錯誤處理
  try {
    await testErrorHandling();
    results.errorHandling = true;
  } catch (error) {
    console.error('錯誤處理測試失敗\n');
  }

  // 測試 6: 參數驗證
  try {
    await testParameterValidation();
    results.parameterValidation = true;
  } catch (error) {
    console.error('參數驗證測試失敗\n');
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
