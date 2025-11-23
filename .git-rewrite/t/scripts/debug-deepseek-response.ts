/**
 * 除錯 DeepSeek Reasoner 回應格式
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testDeepSeekReasonerResponse() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY 未設定');
    return;
  }

  console.log('🧪 測試 DeepSeek Reasoner 回應格式...\n');

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'user',
            content: '生成 3 個繁體中文標題，格式必須是 JSON 陣列：["標題1", "標題2", "標題3"]',
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API 錯誤:', error);
      return;
    }

    const data = await response.json();

    console.log('📦 完整 API 回應:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n📝 choices 結構:');
    console.log(`  - choices 數量: ${data.choices?.length || 0}`);

    if (data.choices && data.choices[0]) {
      const choice = data.choices[0];
      console.log(`  - index: ${choice.index}`);
      console.log(`  - finish_reason: ${choice.finish_reason}`);
      console.log(`  - message.role: ${choice.message?.role}`);
      console.log(`  - message.content 類型: ${typeof choice.message?.content}`);
      console.log(`  - message.content 長度: ${choice.message?.content?.length || 0}`);
      console.log(`  - message.content 內容:`);
      console.log(choice.message?.content || '(空)');
    }

    console.log('\n🔢 usage 資訊:');
    console.log(`  - prompt_tokens: ${data.usage?.prompt_tokens || 0}`);
    console.log(`  - completion_tokens: ${data.usage?.completion_tokens || 0}`);
    console.log(`  - total_tokens: ${data.usage?.total_tokens || 0}`);

    // 測試沒有 response_format 的情況
    console.log('\n\n🧪 測試沒有 response_format 的情況...\n');

    const response2 = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'user',
            content: '請生成 3 個繁體中文標題',
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('📦 沒有 response_format 的回應:');
      console.log(`  - choices[0].message.content 長度: ${data2.choices?.[0]?.message?.content?.length || 0}`);
      console.log(`  - content 內容:`);
      console.log(data2.choices?.[0]?.message?.content || '(空)');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

testDeepSeekReasonerResponse();
