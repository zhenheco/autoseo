# 並行執行機制和模型配置

## 概述
基於用戶需求，設計一個智能的 Agent 執行系統，能夠：
1. **自動識別可並行執行的 Agents**
2. **為每個 Agent 配置不同的 AI 模型**
3. **優化執行時間和成本**

## 執行依賴圖（DAG）

### 1. Agent 依賴關係
```
                    Research Agent
                          │
                          ▼
                    Strategy Agent
                          │
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
          Writing Agent       Image Agent
                │                   │
                └─────────┬─────────┘
                          │
                          ▼
                    Meta Agent
                          │
                          ▼
                   Quality Agent
                          │
                          ▼
                  WordPress Publish
```

### 2. 可並行執行的階段

**Phase 1: 調查階段**（單一 Agent）
- Research Agent

**Phase 2: 策略階段**（單一 Agent）
- Strategy Agent

**Phase 3: 內容生成階段**（並行）
- Writing Agent ⚡
- Image Agent ⚡

**Phase 4: 優化階段**（單一 Agent）
- Meta Agent

**Phase 5: 驗證階段**（單一 Agent）
- Quality Agent

**Phase 6: 發布階段**（條件式）
- WordPress Publish（僅在品質通過且啟用自動發布時）

## 模型配置系統

### 1. 資料庫 Schema 更新

#### agent_configs 表
```sql
CREATE TABLE agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

    -- Research Agent
    research_enabled BOOLEAN DEFAULT true,
    research_model TEXT DEFAULT 'perplexity-sonar',
    research_temperature DECIMAL(3,2) DEFAULT 0.3,
    research_max_tokens INTEGER DEFAULT 2000,

    -- Strategy Agent
    strategy_enabled BOOLEAN DEFAULT true,
    strategy_model TEXT DEFAULT 'gpt-4',
    strategy_temperature DECIMAL(3,2) DEFAULT 0.7,
    strategy_max_tokens INTEGER DEFAULT 3000,

    -- Writing Agent
    writing_enabled BOOLEAN DEFAULT true,
    writing_model TEXT DEFAULT 'gpt-4',
    writing_temperature DECIMAL(3,2) DEFAULT 0.7,
    writing_max_tokens INTEGER DEFAULT 4000,

    -- Image Agent
    image_enabled BOOLEAN DEFAULT true,
    image_model TEXT DEFAULT 'dall-e-3',
    image_quality TEXT DEFAULT 'standard' CHECK (image_quality IN ('standard', 'hd')),
    image_size TEXT DEFAULT '1024x1024',
    image_count INTEGER DEFAULT 3 CHECK (image_count >= 0 AND image_count <= 10),

    -- Meta Agent
    meta_enabled BOOLEAN DEFAULT true,
    meta_model TEXT DEFAULT 'gpt-3.5-turbo',
    meta_temperature DECIMAL(3,2) DEFAULT 0.5,
    meta_max_tokens INTEGER DEFAULT 500,

    -- Quality Agent
    quality_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_website FOREIGN KEY (website_id)
        REFERENCES website_configs(id) ON DELETE CASCADE,
    CONSTRAINT unique_website_agent_config UNIQUE (website_id)
);

CREATE INDEX idx_agent_configs_website_id ON agent_configs(website_id);
```

### 2. 支援的 AI 模型列表

#### Research & Strategy Models
```typescript
const STRATEGY_MODELS = [
  { value: 'gpt-4', label: 'GPT-4 (OpenAI)', provider: 'openai' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)', provider: 'openai' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)', provider: 'openai' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus (Anthropic)', provider: 'anthropic' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Anthropic)', provider: 'anthropic' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
  { value: 'perplexity-sonar', label: 'Perplexity Sonar', provider: 'perplexity' },
];
```

#### Writing Models
```typescript
const WRITING_MODELS = [
  { value: 'gpt-4', label: 'GPT-4 (推薦)', provider: 'openai', cost: 'high' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai', cost: 'medium' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (經濟)', provider: 'openai', cost: 'low' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'anthropic', cost: 'high' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'anthropic', cost: 'medium' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat (最經濟)', provider: 'deepseek', cost: 'lowest' },
];
```

#### Image Models
```typescript
const IMAGE_MODELS = [
  { value: 'dall-e-3', label: 'DALL-E 3 (OpenAI)', provider: 'openai' },
  { value: 'dall-e-2', label: 'DALL-E 2 (OpenAI)', provider: 'openai' },
  { value: 'stable-diffusion-xl', label: 'Stable Diffusion XL', provider: 'stability' },
  { value: 'midjourney', label: 'Midjourney', provider: 'midjourney' },
];
```

### 3. 前端配置介面

#### Agent 配置頁面
```typescript
// src/app/dashboard/[companyId]/websites/[websiteId]/agents/page.tsx

interface AgentConfigForm {
  research: {
    enabled: boolean;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  strategy: {
    enabled: boolean;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  writing: {
    enabled: boolean;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  image: {
    enabled: boolean;
    model: string;
    quality: 'standard' | 'hd';
    size: string;
    count: number;
  };
  meta: {
    enabled: boolean;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  quality: {
    enabled: boolean;
  };
}
```

#### UI 元件範例
```tsx
<Card title="Research Agent">
  <Switch
    label="啟用 SERP 分析"
    checked={config.research.enabled}
    onChange={(enabled) => updateConfig('research', 'enabled', enabled)}
  />

  <Select
    label="AI 模型"
    options={STRATEGY_MODELS}
    value={config.research.model}
    onChange={(model) => updateConfig('research', 'model', model)}
    disabled={!config.research.enabled}
  />

  <Slider
    label="Temperature（創意度）"
    min={0}
    max={1}
    step={0.1}
    value={config.research.temperature}
    onChange={(temp) => updateConfig('research', 'temperature', temp)}
    disabled={!config.research.enabled}
  />

  <Input
    label="最大 Tokens"
    type="number"
    value={config.research.maxTokens}
    onChange={(tokens) => updateConfig('research', 'maxTokens', tokens)}
    disabled={!config.research.enabled}
  />

  <CostEstimate agent="research" config={config.research} />
</Card>
```

## 並行執行引擎

### 1. Orchestrator 類別

```typescript
class ParallelOrchestrator {
  private agentRegistry: Map<string, BaseAgent>;
  private executionDAG: ExecutionDAG;
  private config: AgentConfigs;

  constructor(config: AgentConfigs) {
    this.config = config;
    this.agentRegistry = new Map();
    this.executionDAG = this.buildDAG();
    this.registerAgents();
  }

  /**
   * 建立執行 DAG（有向無環圖）
   */
  private buildDAG(): ExecutionDAG {
    return {
      phases: [
        {
          name: 'research',
          parallel: false,
          agents: ['research'],
          dependencies: [],
        },
        {
          name: 'strategy',
          parallel: false,
          agents: ['strategy'],
          dependencies: ['research'],
        },
        {
          name: 'content_generation',
          parallel: true,  // ⚡ 並行執行
          agents: ['writing', 'image'],
          dependencies: ['strategy'],
        },
        {
          name: 'meta_generation',
          parallel: false,
          agents: ['meta'],
          dependencies: ['content_generation'],
        },
        {
          name: 'quality_check',
          parallel: false,
          agents: ['quality'],
          dependencies: ['meta_generation'],
        },
      ],
    };
  }

  /**
   * 執行完整流程
   */
  async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
    const context = new ExecutionContext(input);

    for (const phase of this.executionDAG.phases) {
      console.log(`📍 開始 Phase: ${phase.name}`);

      if (phase.parallel) {
        // 並行執行
        await this.executePhaseInParallel(phase, context);
      } else {
        // 順序執行
        await this.executePhaseSequentially(phase, context);
      }

      console.log(`✅ 完成 Phase: ${phase.name}`);
    }

    return context.getResult();
  }

  /**
   * 並行執行階段
   */
  private async executePhaseInParallel(
    phase: ExecutionPhase,
    context: ExecutionContext
  ): Promise<void> {
    const enabledAgents = phase.agents.filter(agentName =>
      this.config[agentName]?.enabled !== false
    );

    const promises = enabledAgents.map(agentName => {
      const agent = this.agentRegistry.get(agentName);
      return this.executeAgent(agent, context, agentName);
    });

    const results = await Promise.allSettled(promises);

    // 處理結果和錯誤
    results.forEach((result, index) => {
      const agentName = enabledAgents[index];
      if (result.status === 'fulfilled') {
        context.setAgentResult(agentName, result.value);
      } else {
        context.setAgentError(agentName, result.reason);
        console.error(`❌ Agent ${agentName} 失敗:`, result.reason);
      }
    });

    // 檢查是否有任何必要的 Agent 失敗
    const criticalFailures = results.filter(
      (result, index) =>
        result.status === 'rejected' &&
        this.isCriticalAgent(enabledAgents[index])
    );

    if (criticalFailures.length > 0) {
      throw new Error(`關鍵 Agents 執行失敗`);
    }
  }

  /**
   * 順序執行階段
   */
  private async executePhaseSequentially(
    phase: ExecutionPhase,
    context: ExecutionContext
  ): Promise<void> {
    for (const agentName of phase.agents) {
      if (this.config[agentName]?.enabled === false) {
        console.log(`⏭️  跳過已停用的 Agent: ${agentName}`);
        continue;
      }

      const agent = this.agentRegistry.get(agentName);
      const result = await this.executeAgent(agent, context, agentName);
      context.setAgentResult(agentName, result);
    }
  }

  /**
   * 執行單一 Agent
   */
  private async executeAgent(
    agent: BaseAgent,
    context: ExecutionContext,
    agentName: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      console.log(`🚀 開始執行 Agent: ${agentName}`);

      const input = this.prepareAgentInput(agentName, context);
      const result = await agent.execute(input);

      const executionTime = Date.now() - startTime;

      // 記錄執行結果
      await this.logAgentExecution({
        agentName,
        articleJobId: context.articleJobId,
        status: 'completed',
        executionTime,
        inputData: input,
        outputData: result,
      });

      console.log(`✅ 完成 Agent: ${agentName} (耗時: ${executionTime}ms)`);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 記錄執行錯誤
      await this.logAgentExecution({
        agentName,
        articleJobId: context.articleJobId,
        status: 'failed',
        executionTime,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * 準備 Agent 輸入
   */
  private prepareAgentInput(agentName: string, context: ExecutionContext): any {
    switch (agentName) {
      case 'research':
        return {
          keyword: context.input.keyword,
          region: context.input.region,
          competitorCount: this.config.research.competitorCount,
        };

      case 'strategy':
        return {
          researchData: context.getAgentResult('research'),
          brandVoice: context.input.brandVoice,
          targetWordCount: context.input.workflow.content_length_max,
        };

      case 'writing':
        return {
          strategy: context.getAgentResult('strategy'),
          brandVoice: context.input.brandVoice,
          previousArticles: context.input.previousArticles,
        };

      case 'image':
        return {
          title: context.getAgentResult('strategy')?.selectedTitle,
          outline: context.getAgentResult('strategy')?.outline,
          count: this.config.image.count,
        };

      case 'meta':
        return {
          content: context.getAgentResult('writing'),
          keyword: context.input.keyword,
          titleOptions: context.getAgentResult('strategy')?.titleOptions,
        };

      case 'quality':
        return {
          content: context.getAgentResult('writing'),
          images: context.getAgentResult('image'),
          meta: context.getAgentResult('meta'),
          thresholds: context.input.workflow,
        };

      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  }
}
```

### 2. ExecutionContext 類別

```typescript
class ExecutionContext {
  public readonly articleJobId: string;
  public readonly input: ArticleGenerationInput;
  private agentResults: Map<string, any>;
  private agentErrors: Map<string, Error>;

  constructor(input: ArticleGenerationInput) {
    this.articleJobId = input.articleJobId;
    this.input = input;
    this.agentResults = new Map();
    this.agentErrors = new Map();
  }

  setAgentResult(agentName: string, result: any): void {
    this.agentResults.set(agentName, result);
  }

  getAgentResult(agentName: string): any {
    return this.agentResults.get(agentName);
  }

  setAgentError(agentName: string, error: Error): void {
    this.agentErrors.set(agentName, error);
  }

  hasAgentError(agentName: string): boolean {
    return this.agentErrors.has(agentName);
  }

  getResult(): ArticleGenerationResult {
    return {
      success: !this.hasAgentError('quality'),
      research: this.getAgentResult('research'),
      strategy: this.getAgentResult('strategy'),
      writing: this.getAgentResult('writing'),
      image: this.getAgentResult('image'),
      meta: this.getAgentResult('meta'),
      quality: this.getAgentResult('quality'),
      errors: Object.fromEntries(this.agentErrors),
    };
  }
}
```

## 成本優化

### 1. 模型成本估算

```typescript
const MODEL_COSTS = {
  // Input token 成本（每 1000 tokens，美元）
  input: {
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'gpt-3.5-turbo': 0.0005,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'deepseek-chat': 0.0001,
    'perplexity-sonar': 0.001,
  },
  // Output token 成本（每 1000 tokens，美元）
  output: {
    'gpt-4': 0.06,
    'gpt-4-turbo': 0.03,
    'gpt-3.5-turbo': 0.0015,
    'claude-3-opus': 0.075,
    'claude-3-sonnet': 0.015,
    'deepseek-chat': 0.0002,
    'perplexity-sonar': 0.003,
  },
  // 圖片成本（每張）
  image: {
    'dall-e-3': {
      'standard-1024x1024': 0.04,
      'hd-1024x1024': 0.08,
      'hd-1024x1792': 0.12,
    },
    'dall-e-2': 0.02,
  },
};
```

### 2. 成本追蹤

```sql
CREATE TABLE agent_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd DECIMAL(10,6),
    cost_twd DECIMAL(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. 預算警報

```typescript
async function checkBudget(
  companyId: string,
  estimatedCost: number
): Promise<boolean> {
  const monthlyUsage = await getMonthlyUsage(companyId);
  const subscription = await getSubscription(companyId);

  if (monthlyUsage.cost + estimatedCost > subscription.monthlyCostLimit) {
    await sendBudgetAlert(companyId, {
      currentCost: monthlyUsage.cost,
      estimatedCost,
      limit: subscription.monthlyCostLimit,
    });
    return false;
  }

  return true;
}
```

## 效能監控

### 1. 執行時間追蹤

```typescript
interface PerformanceMetrics {
  totalTime: number;
  phases: {
    research: number;
    strategy: number;
    contentGeneration: number;  // Writing + Image (並行)
    metaGeneration: number;
    qualityCheck: number;
  };
  parallelSpeedup: number;  // 並行加速比
}
```

### 2. Dashboard 可視化

```
執行時序圖：

Research       ████████ (8s)
Strategy               ████████ (9s)
Writing                        ████████████████ (18s) ⚡
Image                          ████████ (10s) ⚡
Meta                                           ████ (4s)
Quality                                            ████ (5s)

總時間：44秒
並行加速：節省 8秒（18% 提升）
```

## 配置建議預設值

### 經濟型配置
```yaml
research:
  model: perplexity-sonar
  temperature: 0.3
  max_tokens: 1500

strategy:
  model: gpt-3.5-turbo
  temperature: 0.7
  max_tokens: 2000

writing:
  model: deepseek-chat
  temperature: 0.7
  max_tokens: 3000

image:
  enabled: false

meta:
  model: gpt-3.5-turbo
  temperature: 0.5
  max_tokens: 300
```

### 平衡型配置（推薦）
```yaml
research:
  model: perplexity-sonar
  temperature: 0.3
  max_tokens: 2000

strategy:
  model: gpt-4-turbo
  temperature: 0.7
  max_tokens: 3000

writing:
  model: gpt-4-turbo
  temperature: 0.7
  max_tokens: 4000

image:
  model: dall-e-3
  quality: standard
  count: 3

meta:
  model: gpt-3.5-turbo
  temperature: 0.5
  max_tokens: 500
```

### 高品質配置
```yaml
research:
  model: perplexity-sonar
  temperature: 0.3
  max_tokens: 2500

strategy:
  model: gpt-4
  temperature: 0.7
  max_tokens: 3500

writing:
  model: claude-3-opus
  temperature: 0.7
  max_tokens: 5000

image:
  model: dall-e-3
  quality: hd
  count: 5

meta:
  model: gpt-4
  temperature: 0.5
  max_tokens: 600
```
