import { AIClient } from '../src/lib/ai/ai-client';

async function verifyAIClient() {
  console.log('🔍 驗證 AI Client...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  const aiClient = new AIClient({
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  });

  console.log('✅ AIClient 初始化成功');
  results.total++;
  results.passed++;

  const providerTests = [
    {
      name: 'getProvider - GPT',
      test: () => {
        const provider = (aiClient as any).getProvider('gpt-4');
        return provider === 'openai';
      },
    },
    {
      name: 'getProvider - Claude',
      test: () => {
        const provider = (aiClient as any).getProvider('claude-3-opus');
        return provider === 'anthropic';
      },
    },
    {
      name: 'getProvider - DeepSeek',
      test: () => {
        const provider = (aiClient as any).getProvider('deepseek-chat');
        return provider === 'deepseek';
      },
    },
    {
      name: 'getProvider - Perplexity',
      test: () => {
        const provider = (aiClient as any).getProvider('sonar');
        return provider === 'perplexity';
      },
    },
    {
      name: 'getImageProvider - DALL-E 3',
      test: () => {
        const provider = (aiClient as any).getImageProvider('dall-e-3');
        return provider === 'openai';
      },
    },
    {
      name: 'getImageProvider - nano-banana',
      test: () => {
        const provider = (aiClient as any).getImageProvider('nano-banana');
        return provider === 'nano';
      },
    },
    {
      name: 'getImageProvider - chatgpt-image-mini',
      test: () => {
        const provider = (aiClient as any).getImageProvider('chatgpt-image-mini');
        return provider === 'openai';
      },
    },
    {
      name: 'formatMessages - String',
      test: () => {
        const messages = (aiClient as any).formatMessages('test');
        return Array.isArray(messages) && messages.length === 1 && messages[0].role === 'user';
      },
    },
    {
      name: 'formatMessages - Array',
      test: () => {
        const input = [{ role: 'user' as const, content: 'test' }];
        const messages = (aiClient as any).formatMessages(input);
        return Array.isArray(messages) && messages.length === 1;
      },
    },
  ];

  for (const { name, test } of providerTests) {
    results.total++;
    try {
      const passed = test();
      if (passed) {
        console.log(`✅ ${name}`);
        results.passed++;
      } else {
        console.log(`❌ ${name}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error}`);
      results.failed++;
    }
  }

  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📊 驗證結果: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);

  if (successRate >= 90) {
    console.log('✅ AI Client 驗證通過 (≥90%)');
    return true;
  } else {
    console.log(`❌ AI Client 驗證失敗 (<90%)`);
    return false;
  }
}

verifyAIClient()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('驗證過程發生錯誤:', error);
    process.exit(1);
  });
