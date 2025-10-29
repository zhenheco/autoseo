import 'dotenv/config';

async function testPerplexity() {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.error('❌ PERPLEXITY_API_KEY not found');
    process.exit(1);
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');

  const query = '找出關於「老虎機技巧」最權威的 3 個外部來源，要求必須包含實際可訪問的 URL。';

  console.log('\n發送請求到 Perplexity API...');
  console.log('Query:', query);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: '你是一個專業的研究助手。請提供準確、最新的資訊，並引用來源。'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 3000,
        search_recency_filter: 'month',
        return_citations: true,
      })
    });

    console.log('\n回應狀態:', response.status, response.statusText);
    console.log('回應標頭:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();

    console.log('\n完整 API 回應:');
    console.log(JSON.stringify(data, null, 2));

    if (data.citations) {
      console.log('\n✅ Citations 欄位存在:', data.citations);
    } else {
      console.log('\n⚠️  Citations 欄位不存在');
    }

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log('\n回應內容長度:', content.length);
      console.log('內容預覽:', content.substring(0, 500));
    }

  } catch (error) {
    console.error('\n❌ 錯誤:', error);
    if (error instanceof Error) {
      console.error('錯誤訊息:', error.message);
      console.error('錯誤堆疊:', error.stack);
    }
  }
}

testPerplexity();
