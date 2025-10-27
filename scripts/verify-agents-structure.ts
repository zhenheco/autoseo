import { ResearchAgent } from '../src/lib/agents/research-agent';
import { StrategyAgent } from '../src/lib/agents/strategy-agent';
import { WritingAgent } from '../src/lib/agents/writing-agent';
import { ImageAgent } from '../src/lib/agents/image-agent';
import { QualityAgent } from '../src/lib/agents/quality-agent';
import { MetaAgent } from '../src/lib/agents/meta-agent';
import { AgentExecutionContext } from '../src/lib/agents/base-agent';

async function verifyAgentsStructure() {
  console.log('🔍 驗證各 Agent 結構...\n');

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

  const agentTests = [
    {
      name: 'ResearchAgent',
      Agent: ResearchAgent,
      expectedName: 'ResearchAgent',
    },
    {
      name: 'StrategyAgent',
      Agent: StrategyAgent,
      expectedName: 'StrategyAgent',
    },
    {
      name: 'WritingAgent',
      Agent: WritingAgent,
      expectedName: 'WritingAgent',
    },
    {
      name: 'ImageAgent',
      Agent: ImageAgent,
      expectedName: 'ImageAgent',
    },
    {
      name: 'QualityAgent',
      Agent: QualityAgent,
      expectedName: 'QualityAgent',
    },
    {
      name: 'MetaAgent',
      Agent: MetaAgent,
      expectedName: 'MetaAgent',
    },
  ];

  for (const { name, Agent, expectedName } of agentTests) {
    results.total++;
    try {
      const agent = new Agent(aiConfig, context);
      console.log(`✅ ${name} 實例化成功`);
      results.passed++;
    } catch (error) {
      console.log(`❌ ${name} 實例化失敗: ${error}`);
      results.failed++;
      continue;
    }

    results.total++;
    try {
      const agent = new Agent(aiConfig, context);
      if (agent.agentName === expectedName) {
        console.log(`✅ ${name} agentName 正確`);
        results.passed++;
      } else {
        console.log(`❌ ${name} agentName 不正確: ${agent.agentName}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} agentName 檢查失敗: ${error}`);
      results.failed++;
    }

    results.total++;
    try {
      const agent = new Agent(aiConfig, context);
      if (typeof agent.execute === 'function') {
        console.log(`✅ ${name} execute() 方法存在`);
        results.passed++;
      } else {
        console.log(`❌ ${name} execute() 方法缺失`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} execute() 檢查失敗: ${error}`);
      results.failed++;
    }

    results.total++;
    try {
      const agent = new Agent(aiConfig, context);
      if (typeof agent.getLogs === 'function') {
        console.log(`✅ ${name} getLogs() 方法存在`);
        results.passed++;
      } else {
        console.log(`❌ ${name} getLogs() 方法缺失`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} getLogs() 檢查失敗: ${error}`);
      results.failed++;
    }

    results.total++;
    try {
      const agent = new Agent(aiConfig, context);
      if (typeof agent.getExecutionInfo === 'function') {
        console.log(`✅ ${name} getExecutionInfo() 方法存在`);
        results.passed++;
      } else {
        console.log(`❌ ${name} getExecutionInfo() 方法缺失`);
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} getExecutionInfo() 檢查失敗: ${error}`);
      results.failed++;
    }
  }

  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📊 驗證結果: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);

  if (successRate >= 90) {
    console.log('✅ 各 Agent 結構驗證通過 (≥90%)');
    return true;
  } else {
    console.log(`❌ 各 Agent 結構驗證失敗 (<90%)`);
    return false;
  }
}

verifyAgentsStructure()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('驗證過程發生錯誤:', error);
    process.exit(1);
  });
