import { BaseAgent, AgentExecutionContext } from '../src/lib/agents/base-agent';

class TestAgent extends BaseAgent<{ input: string }, { output: string }> {
  get agentName(): string {
    return 'TestAgent';
  }

  protected async process(input: { input: string }): Promise<{ output: string }> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { output: `Processed: ${input.input}` };
  }
}

class ErrorAgent extends BaseAgent<any, any> {
  get agentName() {
    return 'ErrorAgent';
  }
  protected async process() {
    throw new Error('Test error');
  }
}

async function verifyBaseAgent() {
  console.log('🔍 驗證 Base Agent...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  const context: AgentExecutionContext = {
    websiteId: 'test-website',
    companyId: 'test-company',
    articleJobId: 'test-article',
  };

  const aiConfig = {
    openrouterApiKey: 'test-key',
  };

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    console.log('✅ BaseAgent 實例化成功');
    results.passed++;
  } catch (error) {
    console.log(`❌ BaseAgent 實例化失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    const result = await agent.execute({ input: 'test' });
    if (result.output === 'Processed: test') {
      console.log('✅ execute() 執行成功');
      results.passed++;
    } else {
      console.log(`❌ execute() 輸出不正確: ${result.output}`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ execute() 執行失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    await agent.execute({ input: 'test' });
    const logs = agent.getLogs();
    if (logs.length >= 2) {
      console.log('✅ 日誌記錄功能正常');
      results.passed++;
    } else {
      console.log(`❌ 日誌記錄不完整: ${logs.length} 條`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 日誌記錄功能失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    await agent.execute({ input: 'test' });
    const logs = agent.getLogs();
    const startLog = logs.find((log) => log.message.includes('started'));
    const completedLog = logs.find((log) => log.message.includes('completed'));
    if (startLog && completedLog) {
      console.log('✅ started/completed 日誌正確');
      results.passed++;
    } else {
      console.log('❌ started/completed 日誌缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 日誌內容驗證失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    await agent.execute({ input: 'test' });
    const executionInfo = agent.getExecutionInfo('test-model');
    if (executionInfo.executionTime > 0 && executionInfo.model === 'test-model') {
      console.log('✅ 執行時間追蹤正常');
      results.passed++;
    } else {
      console.log(`❌ 執行時間追蹤異常: ${executionInfo.executionTime}ms`);
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 執行時間追蹤失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new TestAgent(aiConfig, context);
    await agent.execute({ input: 'test' });
    const executionInfo = agent.getExecutionInfo('test-model');
    if (
      typeof executionInfo.tokenUsage.input === 'number' &&
      typeof executionInfo.tokenUsage.output === 'number'
    ) {
      console.log('✅ Token 使用統計正常');
      results.passed++;
    } else {
      console.log('❌ Token 使用統計異常');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ Token 使用統計失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new ErrorAgent(aiConfig, context);
    let errorCaught = false;
    try {
      await agent.execute({ input: 'test' });
    } catch (error) {
      errorCaught = true;
    }
    if (errorCaught) {
      console.log('✅ 錯誤處理正常');
      results.passed++;
    } else {
      console.log('❌ 錯誤未被捕獲');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 錯誤處理驗證失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const agent = new ErrorAgent(aiConfig, context);
    try {
      await agent.execute({ input: 'test' });
    } catch {}
    const logs = agent.getLogs();
    const errorLog = logs.find((log) => log.level === 'error');
    if (errorLog && errorLog.message.includes('failed')) {
      console.log('✅ 錯誤日誌記錄正常');
      results.passed++;
    } else {
      console.log('❌ 錯誤日誌記錄缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ 錯誤日誌驗證失敗: ${error}`);
    results.failed++;
  }

  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📊 驗證結果: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);

  if (successRate >= 90) {
    console.log('✅ Base Agent 驗證通過 (≥90%)');
    return true;
  } else {
    console.log(`❌ Base Agent 驗證失敗 (<90%)`);
    return false;
  }
}

verifyBaseAgent()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('驗證過程發生錯誤:', error);
    process.exit(1);
  });
