import { ParallelOrchestrator } from '../src/lib/agents/orchestrator';

async function verifyOrchestrator() {
  console.log('🔍 驗證 ParallelOrchestrator...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    console.log('✅ ParallelOrchestrator 實例化成功');
    results.passed++;
  } catch (error) {
    console.log(`❌ ParallelOrchestrator 實例化失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof orchestrator.execute === 'function') {
      console.log('✅ execute() 方法存在');
      results.passed++;
    } else {
      console.log('❌ execute() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ execute() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).getBrandVoice === 'function') {
      console.log('✅ getBrandVoice() 方法存在');
      results.passed++;
    } else {
      console.log('❌ getBrandVoice() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ getBrandVoice() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).getWorkflowSettings === 'function') {
      console.log('✅ getWorkflowSettings() 方法存在');
      results.passed++;
    } else {
      console.log('❌ getWorkflowSettings() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ getWorkflowSettings() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).getAgentConfig === 'function') {
      console.log('✅ getAgentConfig() 方法存在');
      results.passed++;
    } else {
      console.log('❌ getAgentConfig() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ getAgentConfig() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).getPreviousArticles === 'function') {
      console.log('✅ getPreviousArticles() 方法存在');
      results.passed++;
    } else {
      console.log('❌ getPreviousArticles() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ getPreviousArticles() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).getAIConfig === 'function') {
      console.log('✅ getAIConfig() 方法存在');
      results.passed++;
    } else {
      console.log('❌ getAIConfig() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ getAIConfig() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).updateJobStatus === 'function') {
      console.log('✅ updateJobStatus() 方法存在');
      results.passed++;
    } else {
      console.log('❌ updateJobStatus() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ updateJobStatus() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).executeWritingAgent === 'function') {
      console.log('✅ executeWritingAgent() 方法存在');
      results.passed++;
    } else {
      console.log('❌ executeWritingAgent() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ executeWritingAgent() 檢查失敗: ${error}`);
    results.failed++;
  }

  results.total++;
  try {
    const orchestrator = new ParallelOrchestrator();
    if (typeof (orchestrator as any).executeImageAgent === 'function') {
      console.log('✅ executeImageAgent() 方法存在');
      results.passed++;
    } else {
      console.log('❌ executeImageAgent() 方法缺失');
      results.failed++;
    }
  } catch (error) {
    console.log(`❌ executeImageAgent() 檢查失敗: ${error}`);
    results.failed++;
  }

  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📊 驗證結果: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);

  if (successRate >= 90) {
    console.log('✅ ParallelOrchestrator 結構驗證通過 (≥90%)');
    return true;
  } else {
    console.log(`❌ ParallelOrchestrator 結構驗證失敗 (<90%)`);
    return false;
  }
}

verifyOrchestrator()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('驗證過程發生錯誤:', error);
    process.exit(1);
  });
