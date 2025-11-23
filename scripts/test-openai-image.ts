#!/usr/bin/env tsx

/**
 * 測試 OpenAI Images API (gpt-image-1-mini)
 * 使用方式：
 * 1. 確保 .env.local 有設定 OPENAI_API_KEY
 * 2. 執行：npx tsx scripts/test-openai-image.ts
 */

async function testOpenAIImageAPI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY 未設定');
    console.log('請在 .env.local 中設定：');
    console.log('OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
  console.log('🎨 測試 gpt-image-1-mini 圖片生成...\n');

  const testPrompt = 'A beautiful sunset over a mountain range, digital art style';

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1-mini',
        prompt: testPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',  // OpenAI API 使用: low, medium, high, auto
      }),
    });

    console.log('📊 HTTP Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API 錯誤:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    const data = await response.json();

    console.log('\n✅ 圖片生成成功！');
    console.log('📝 原始 Prompt:', testPrompt);
    console.log('📝 修訂 Prompt:', data.data[0].revised_prompt || '(無修訂)');
    console.log('🖼️  圖片 URL:', data.data[0].url);
    console.log('\n完整回應:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ 請求失敗:', error);
    process.exit(1);
  }
}

// 從 .env.local 載入環境變數
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

testOpenAIImageAPI();
