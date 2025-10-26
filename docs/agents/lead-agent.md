# Lead Agent (Parallel Orchestrator)

## 概述
Lead Agent 是整個 SEO 文章生成系統的主協調器，負責：
- 協調所有 Subagents 的執行順序
- 管理並行執行邏輯
- 處理 Agent 之間的數據流
- 錯誤處理和恢復
- 進度追蹤和日誌記錄

## 職責

### 1. 執行流程管理
- 根據 DAG（有向無環圖）決定執行順序
- 識別可並行執行的 Agents
- 協調 Agent 之間的數據傳遞

### 2. 配置管理
- 載入網站配置
- 載入 Agent 配置
- 載入工作流設定
- 載入品牌聲音

### 3. 錯誤處理
- 捕獲 Agent 執行錯誤
- 區分關鍵錯誤和非關鍵錯誤
- 決定是否繼續執行或終止

### 4. 進度追蹤
- 更新 article_jobs 狀態
- 記錄每個 Agent 的執行結果
- 提供即時進度更新

## 執行流程 DAG

```
Phase 1: 調查階段（單一 Agent，串行）
├─ Research Agent (8s)

Phase 2: 策略階段（單一 Agent，串行）
├─ Strategy Agent (9s)

Phase 3: 內容生成階段（多 Agents，並行）⚡
├─ Writing Agent (18s) ┐
└─ Image Agent (10s)   ┴─ 並行執行

Phase 4: 優化階段（單一 Agent，串行）
├─ Meta Agent (4s)

Phase 5: 驗證階段（單一 Agent，串行）
├─ Quality Agent (5s)

Phase 6: 發布階段（條件式）
└─ WordPress Publish (if quality_passed && auto_publish)
```

## 輸入

```typescript
interface ArticleGenerationInput {
  articleJobId: string;
  companyId: string;
  websiteId: string;

  // 關鍵字和內容
  keyword: string;
  region?: string;

  // 配置（自動載入）
  websiteConfig?: WebsiteConfig;
  brandVoice?: BrandVoice;
  workflowSettings?: WorkflowSettings;
  agentConfigs?: AgentConfigs;
}
```

## 輸出

```typescript
interface ArticleGenerationResult {
  success: boolean;
  articleJobId: string;

  // 各階段結果
  research?: ResearchOutput;
  strategy?: StrategyOutput;
  writing?: WritingOutput;
  image?: ImageOutput;
  meta?: MetaOutput;
  quality?: QualityOutput;

  // 執行統計
  executionStats: {
    totalTime: number;
    phases: {
      research: number;
      strategy: number;
      contentGeneration: number;  // max(writing, image)
      metaGeneration: number;
      qualityCheck: number;
    };
    parallelSpeedup: number;  // 節省的時間
  };

  // 錯誤資訊
  errors?: Record<string, Error>;

  // 成本統計
  costBreakdown?: {
    research: { model: string; cost: number; tokens: number };
    strategy: { model: string; cost: number; tokens: number };
    writing: { model: string; cost: number; tokens: number };
    image: { model: string; cost: number; count: number };
    meta: { model: string; cost: number; tokens: number };
    total: number;
  };
}
```

## 核心邏輯

### 1. 主執行函數

```typescript
class ParallelOrchestrator {
  async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
    const startTime = Date.now();
    const context = new ExecutionContext(input);

    try {
      // 載入所有配置
      await this.loadConfigurations(context);

      // 執行各個階段
      for (const phase of this.executionDAG.phases) {
        const phaseStartTime = Date.now();

        if (phase.parallel) {
          await this.executePhaseInParallel(phase, context);
        } else {
          await this.executePhaseSequentially(phase, context);
        }

        context.recordPhaseTime(phase.name, Date.now() - phaseStartTime);
      }

      // 計算統計資訊
      const stats = this.calculateStats(context, Date.now() - startTime);

      return context.getResult(stats);

    } catch (error) {
      await this.handleCriticalError(context, error);
      throw error;
    }
  }
}
```

### 2. 並行執行邏輯

```typescript
private async executePhaseInParallel(
  phase: ExecutionPhase,
  context: ExecutionContext
): Promise<void> {
  const enabledAgents = this.getEnabledAgents(phase.agents, context);

  console.log(`🔀 並行執行: ${enabledAgents.join(', ')}`);

  const promises = enabledAgents.map(agentName =>
    this.executeAgent(agentName, context)
      .catch(error => ({ agentName, error }))
  );

  const results = await Promise.allSettled(promises);

  // 處理結果
  results.forEach((result, index) => {
    const agentName = enabledAgents[index];

    if (result.status === 'fulfilled' && !result.value.error) {
      context.setAgentResult(agentName, result.value);
    } else {
      const error = result.status === 'rejected'
        ? result.reason
        : result.value.error;

      context.setAgentError(agentName, error);

      // 檢查是否為關鍵 Agent
      if (this.isCriticalAgent(agentName)) {
        throw new Error(`關鍵 Agent ${agentName} 執行失敗: ${error.message}`);
      }
    }
  });
}
```

### 3. 配置載入

```typescript
private async loadConfigurations(context: ExecutionContext): Promise<void> {
  const { websiteId, companyId } = context.input;

  // 並行載入所有配置
  const [websiteConfig, brandVoice, workflowSettings, agentConfigs, previousArticles] =
    await Promise.all([
      this.getWebsiteConfig(websiteId),
      this.getBrandVoice(websiteId),
      this.getWorkflowSettings(websiteId),
      this.getAgentConfigs(websiteId),
      this.getPreviousArticles(websiteId, context.input.keyword),
    ]);

  context.setConfigurations({
    websiteConfig,
    brandVoice,
    workflowSettings,
    agentConfigs,
    previousArticles,
  });
}
```

### 4. Agent 輸入準備

```typescript
private prepareAgentInput(agentName: string, context: ExecutionContext): any {
  const config = context.agentConfigs[agentName];
  const baseInput = {
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.max_tokens,
  };

  switch (agentName) {
    case 'research':
      return {
        ...baseInput,
        keyword: context.input.keyword,
        region: context.input.region,
        competitorCount: context.workflowSettings.competitor_count,
      };

    case 'strategy':
      return {
        ...baseInput,
        researchData: context.getAgentResult('research'),
        brandVoice: context.brandVoice,
        targetWordCount: context.workflowSettings.content_length_max,
      };

    case 'writing':
      return {
        ...baseInput,
        strategy: context.getAgentResult('strategy'),
        brandVoice: context.brandVoice,
        previousArticles: context.previousArticles,
      };

    case 'image':
      return {
        model: config.model,
        quality: config.quality,
        size: config.size,
        count: config.count,
        title: context.getAgentResult('strategy')?.selectedTitle,
        outline: context.getAgentResult('strategy')?.outline,
      };

    case 'meta':
      return {
        ...baseInput,
        content: context.getAgentResult('writing'),
        keyword: context.input.keyword,
        titleOptions: context.getAgentResult('strategy')?.titleOptions,
      };

    case 'quality':
      return {
        content: context.getAgentResult('writing'),
        images: context.getAgentResult('image'),
        meta: context.getAgentResult('meta'),
        thresholds: context.workflowSettings,
      };

    default:
      throw new Error(`Unknown agent: ${agentName}`);
  }
}
```

## 錯誤處理策略

### 1. Agent 分類

```typescript
private isCriticalAgent(agentName: string): boolean {
  const criticalAgents = ['research', 'strategy', 'writing', 'quality'];
  return criticalAgents.includes(agentName);
}

private isOptionalAgent(agentName: string): boolean {
  const optionalAgents = ['image', 'meta'];
  return optionalAgents.includes(agentName);
}
```

### 2. 錯誤處理規則

| Agent | 類型 | 失敗處理 |
|-------|------|---------|
| Research | 關鍵 | 終止流程 |
| Strategy | 關鍵 | 終止流程 |
| Writing | 關鍵 | 終止流程 |
| Image | 可選 | 繼續執行，標記警告 |
| Meta | 可選 | 使用預設值繼續 |
| Quality | 關鍵 | 終止流程 |

### 3. 重試機制

```typescript
private async executeAgentWithRetry(
  agentName: string,
  context: ExecutionContext,
  maxRetries: number = 2
): Promise<any> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.executeAgent(agentName, context);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`⚠️ Agent ${agentName} 失敗，重試 ${attempt}/${maxRetries}`);
        await this.delay(1000 * attempt); // 指數退避
      }
    }
  }

  throw lastError;
}
```

## 進度追蹤

### 1. 資料庫更新

```typescript
private async updateJobStage(
  articleJobId: string,
  stage: string,
  data: any
): Promise<void> {
  await supabase
    .from('article_jobs')
    .update({
      current_stage: stage,
      processing_stages: {
        [stage]: {
          status: 'completed',
          data,
          completed_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', articleJobId);
}
```

### 2. 即時進度推送

```typescript
private async emitProgress(
  articleJobId: string,
  event: ProgressEvent
): Promise<void> {
  // WebSocket 推送
  await this.websocketService.emit(`article:${articleJobId}`, event);

  // Server-Sent Events 推送
  await this.sseService.send(`article:${articleJobId}`, event);
}
```

## 成本計算

```typescript
private async calculateAndTrackCost(
  agentName: string,
  context: ExecutionContext,
  result: any
): Promise<void> {
  const config = context.agentConfigs[agentName];
  const model = config.model;

  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  if (agentName === 'image') {
    // 圖片成本計算
    costUsd = this.calculateImageCost(model, config.quality, config.count);
  } else {
    // 文字模型成本計算
    inputTokens = result.usage?.prompt_tokens || 0;
    outputTokens = result.usage?.completion_tokens || 0;
    costUsd = this.calculateTokenCost(model, inputTokens, outputTokens);
  }

  const costTwd = costUsd * 31.5; // 匯率

  // 記錄到資料庫
  await this.logAgentCost({
    articleJobId: context.articleJobId,
    agentName,
    model,
    inputTokens,
    outputTokens,
    costUsd,
    costTwd,
  });
}
```

## ExecutionContext 類別

```typescript
class ExecutionContext {
  public readonly articleJobId: string;
  public readonly input: ArticleGenerationInput;

  public websiteConfig: WebsiteConfig;
  public brandVoice: BrandVoice;
  public workflowSettings: WorkflowSettings;
  public agentConfigs: AgentConfigs;
  public previousArticles: Article[];

  private agentResults: Map<string, any>;
  private agentErrors: Map<string, Error>;
  private phaseTimes: Map<string, number>;

  constructor(input: ArticleGenerationInput) {
    this.articleJobId = input.articleJobId;
    this.input = input;
    this.agentResults = new Map();
    this.agentErrors = new Map();
    this.phaseTimes = new Map();
  }

  setConfigurations(configs: Configurations): void {
    Object.assign(this, configs);
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

  hasErrors(): boolean {
    return this.agentErrors.size > 0;
  }

  recordPhaseTime(phaseName: string, timeMs: number): void {
    this.phaseTimes.set(phaseName, timeMs);
  }

  getResult(stats: ExecutionStats): ArticleGenerationResult {
    return {
      success: !this.hasErrors(),
      articleJobId: this.articleJobId,
      research: this.getAgentResult('research'),
      strategy: this.getAgentResult('strategy'),
      writing: this.getAgentResult('writing'),
      image: this.getAgentResult('image'),
      meta: this.getAgentResult('meta'),
      quality: this.getAgentResult('quality'),
      executionStats: stats,
      errors: Object.fromEntries(this.agentErrors),
    };
  }
}
```

## 效能優化

### 1. 並行加速計算

```typescript
private calculateParallelSpeedup(context: ExecutionContext): number {
  const writingTime = context.phaseTimes.get('writing') || 0;
  const imageTime = context.phaseTimes.get('image') || 0;
  const parallelTime = Math.max(writingTime, imageTime);
  const sequentialTime = writingTime + imageTime;

  return sequentialTime - parallelTime; // 節省的時間
}
```

### 2. 快取機制

```typescript
private async getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5分鐘
): Promise<T> {
  const cached = await this.cache.get(key);
  if (cached) return cached;

  const data = await fetcher();
  await this.cache.set(key, data, ttl);
  return data;
}
```

## 監控和日誌

### 1. 結構化日誌

```typescript
private log(level: string, message: string, meta?: any): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'parallel-orchestrator',
    articleJobId: this.context?.articleJobId,
    message,
    ...meta,
  }));
}
```

### 2. 效能指標

```typescript
private async recordMetrics(context: ExecutionContext, stats: ExecutionStats): void {
  await this.metricsService.record({
    metric: 'article_generation_duration',
    value: stats.totalTime,
    tags: {
      company_id: context.input.companyId,
      website_id: context.input.websiteId,
    },
  });

  await this.metricsService.record({
    metric: 'parallel_speedup',
    value: stats.parallelSpeedup,
  });
}
```

## 使用範例

```typescript
// 初始化 Orchestrator
const orchestrator = new ParallelOrchestrator({
  agentRegistry: {
    research: new ResearchAgent(),
    strategy: new StrategyAgent(),
    writing: new WritingAgent(),
    image: new ImageAgent(),
    meta: new MetaAgent(),
    quality: new QualityAgent(),
  },
});

// 執行文章生成
const result = await orchestrator.execute({
  articleJobId: 'abc-123',
  companyId: 'company-1',
  websiteId: 'website-1',
  keyword: 'SEO 優化技巧',
  region: '台灣',
});

if (result.success) {
  console.log('✅ 文章生成成功');
  console.log(`總耗時: ${result.executionStats.totalTime}ms`);
  console.log(`並行節省: ${result.executionStats.parallelSpeedup}ms`);
  console.log(`品質分數: ${result.quality.score}`);
} else {
  console.error('❌ 文章生成失敗');
  console.error('錯誤:', result.errors);
}
```

## 測試策略

### 1. 單元測試

```typescript
describe('ParallelOrchestrator', () => {
  it('should execute agents in correct order', async () => {
    const orchestrator = new ParallelOrchestrator(mockConfig);
    const executionOrder: string[] = [];

    // Mock agents to track execution order
    orchestrator.onAgentStart = (name) => executionOrder.push(name);

    await orchestrator.execute(mockInput);

    expect(executionOrder).toEqual([
      'research',
      'strategy',
      'writing', 'image', // 並行
      'meta',
      'quality'
    ]);
  });

  it('should handle agent failures gracefully', async () => {
    const orchestrator = new ParallelOrchestrator(mockConfig);

    // Mock image agent failure (non-critical)
    orchestrator.getAgent('image').execute = jest.fn()
      .mockRejectedValue(new Error('Image generation failed'));

    const result = await orchestrator.execute(mockInput);

    expect(result.success).toBe(true);
    expect(result.errors.image).toBeDefined();
  });
});
```

### 2. 整合測試

```typescript
describe('End-to-End Article Generation', () => {
  it('should generate complete article', async () => {
    const orchestrator = new ParallelOrchestrator(realConfig);

    const result = await orchestrator.execute({
      articleJobId: 'test-123',
      companyId: 'test-company',
      websiteId: 'test-website',
      keyword: '測試關鍵字',
    });

    expect(result.success).toBe(true);
    expect(result.writing.html).toBeDefined();
    expect(result.quality.score).toBeGreaterThan(80);
  });
});
```
