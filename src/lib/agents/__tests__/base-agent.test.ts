import { BaseAgent, AgentExecutionContext } from '../base-agent';
import { AIClient } from '@/lib/ai/ai-client';

class TestAgent extends BaseAgent<{ input: string }, { output: string }> {
  get agentName(): string {
    return 'TestAgent';
  }

  protected async process(input: { input: string }): Promise<{ output: string }> {
    return { output: `Processed: ${input.input}` };
  }
}

describe('BaseAgent', () => {
  const context: AgentExecutionContext = {
    websiteId: 'test-website',
    companyId: 'test-company',
    articleJobId: 'test-article',
  };

  const aiConfig = {
    openrouterApiKey: 'test-key',
  };

  it('應該成功執行 agent 並記錄日誌', async () => {
    const agent = new TestAgent(aiConfig, context);
    const result = await agent.execute({ input: 'test' });

    expect(result.output).toBe('Processed: test');

    const logs = agent.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toContain('started');
    expect(logs[logs.length - 1].message).toContain('completed');
  });

  it('應該追蹤執行時間', async () => {
    const agent = new TestAgent(aiConfig, context);
    await agent.execute({ input: 'test' });

    const executionInfo = agent.getExecutionInfo('test-model');
    expect(executionInfo.executionTime).toBeGreaterThan(0);
    expect(executionInfo.model).toBe('test-model');
  });

  it('應該在失敗時記錄錯誤', async () => {
    class ErrorAgent extends BaseAgent<any, any> {
      get agentName() {
        return 'ErrorAgent';
      }
      protected async process() {
        throw new Error('Test error');
      }
    }

    const agent = new ErrorAgent(aiConfig, context);

    await expect(agent.execute({ input: 'test' })).rejects.toThrow('Test error');

    const logs = agent.getLogs();
    const errorLog = logs.find((log) => log.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('failed');
  });
});
