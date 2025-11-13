# 設計文件：修復多 Agent 架構的儲存和錯誤追蹤

## Architecture Overview

### Current Architecture (有問題的部分)

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                           │
│                                                             │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  Research  │ → │  Strategy  │ → │  Image Generation│  │
│  └────────────┘   └────────────┘   └──────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         Multi-Agent Content Generation               │ │
│  │  ┌────────────┐  ┌────────┐  ┌──────────┐  ┌─────┐ │ │
│  │  │Introduction│→│ Section│→│Conclusion │→│ QA  │ │ │
│  │  └────────────┘  └────────┘  └──────────┘  └─────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                         ↓                                  │
│              ┌──────────────────────┐                      │
│              │ ContentAssembler     │                      │
│              │ Output: {            │                      │
│              │   markdown,          │                      │
│              │   html,              │ ✗ 格式不相容         │
│              │   statistics         │                      │
│              │ }                    │                      │
│              └──────────────────────┘                      │
│                         ↓                                  │
│              ┌──────────────────────┐                      │
│              │ ArticleStorageService│                      │
│              │ Expects: {           │                      │
│              │   markdown,          │                      │
│              │   html,              │                      │
│              │   statistics,        │                      │
│              │   readability,  ✗ 缺失                      │
│              │   keywordUsage, ✗ 缺失                      │
│              │   internalLinks ✗ 缺失                      │
│              │ }                    │                      │
│              └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**問題**：
1. `ContentAssembler` 輸出格式 ≠ `ArticleStorageService` 期望格式
2. 導致儲存失敗，但沒有錯誤訊息
3. 用戶看不到生成的文章

### Proposed Architecture (修復後)

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                           │
│                                                             │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │  Research  │ → │  Strategy  │ → │  Image Generation│  │
│  └────────────┘   └────────────┘   └──────────────────┘  │
│        ↓               ↓                      ↓            │
│    ┌──────────────────────────────────────────────┐       │
│    │          Error Tracker (每個階段)            │       │
│    └──────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         Multi-Agent Content Generation               │ │
│  │  ┌────────────┐  ┌────────┐  ┌──────────┐  ┌─────┐ │ │
│  │  │Introduction│→│ Section│→│Conclusion │→│ QA  │ │ │
│  │  └────────────┘  └────────┘  └──────────┘  └─────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                         ↓                                  │
│              ┌──────────────────────┐                      │
│              │ ContentAssembler     │                      │
│              │ Output: {            │                      │
│              │   markdown,          │                      │
│              │   html,              │                      │
│              │   statistics         │                      │
│              │ }                    │                      │
│              └──────────────────────┘                      │
│                         ↓                                  │
│              ┌──────────────────────┐ ✓ 新增              │
│              │   Output Adapter     │                      │
│              │ Converts to: {       │                      │
│              │   markdown,          │                      │
│              │   html,              │                      │
│              │   statistics,        │                      │
│              │   readability,  ✓ 計算                      │
│              │   keywordUsage, ✓ 計算                      │
│              │   internalLinks ✓ 擷取                      │
│              │ }                    │                      │
│              └──────────────────────┘                      │
│                         ↓                                  │
│              ┌──────────────────────┐                      │
│              │ ArticleStorageService│                      │
│              │ + Input Validation ✓ │                      │
│              └──────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Output Adapter

**職責**：
- 將 `ContentAssemblerOutput` 轉換為 `WritingAgentOutput` 格式
- 計算缺失的欄位（readability, keywordUsage, internalLinks）
- 驗證輸出格式的完整性

**介面設計**：

```typescript
// src/lib/agents/output-adapter.ts

interface AdapterInput {
  assemblerOutput: ContentAssemblerOutput;
  strategyOutput: StrategyAgentOutput;
  focusKeyword: string;
}

interface AdapterOutput extends WritingAgentOutput {
  // 完整的 WritingAgentOutput 格式
  markdown: string;
  html: string;
  statistics: ArticleStatistics;
  readability: ReadabilityMetrics;
  keywordUsage: KeywordUsage;
  internalLinks: InternalLink[];
}

class MultiAgentOutputAdapter {
  /**
   * 轉換 ContentAssembler 輸出為 WritingAgent 格式
   */
  adapt(input: AdapterInput): AdapterOutput {
    const { assemblerOutput, strategyOutput, focusKeyword } = input;

    return {
      markdown: assemblerOutput.markdown,
      html: assemblerOutput.html,
      statistics: assemblerOutput.statistics,

      // 計算可讀性指標
      readability: this.calculateReadability(assemblerOutput.markdown),

      // 計算關鍵字使用情況
      keywordUsage: this.analyzeKeywordUsage(
        assemblerOutput.markdown,
        focusKeyword
      ),

      // 擷取內部連結
      internalLinks: this.extractInternalLinks(assemblerOutput.html),
    };
  }

  private calculateReadability(markdown: string): ReadabilityMetrics {
    // 使用 Flesch Reading Ease, Flesch-Kincaid Grade, Gunning Fog Index
    // 實作細節見 writing-agent.ts:calculateReadability()
  }

  private analyzeKeywordUsage(
    markdown: string,
    focusKeyword: string
  ): KeywordUsage {
    // 計算關鍵字密度、出現次數、位置分佈
    // 實作細節見 writing-agent.ts:analyzeKeywordUsage()
  }

  private extractInternalLinks(html: string): InternalLink[] {
    // 從 HTML 中擷取所有內部連結
    // 實作細節見 html-agent.ts:extractInternalLinks()
  }
}
```

**使用方式**：

```typescript
// src/lib/agents/orchestrator.ts:210

// 多 Agent 架構完成後
const assemblerOutput = await contentAssembler.execute(...);

// ✓ 新增：格式轉換
const adapter = new MultiAgentOutputAdapter();
writingOutput = adapter.adapt({
  assemblerOutput,
  strategyOutput,
  focusKeyword: input.title,
});

// 現在 writingOutput 格式正確，可以儲存
await articleStorage.saveArticle({ ..., result: { writing: writingOutput } });
```

### 2. Enhanced Error Tracking

**職責**：
- 捕獲所有 agent 執行錯誤
- 記錄到資料庫 (`article_generation_jobs.metadata.errors`)
- 提供結構化的錯誤分析

**資料結構**：

```typescript
// src/lib/agents/error-tracker.ts

interface TrackedError {
  id: string;                    // UUID
  agent: string;                 // "IntroductionAgent", "SectionAgent", etc.
  phase: string;                 // "research", "content_generation", etc.
  timestamp: string;             // ISO 8601
  error: string;                 // 錯誤訊息
  stack?: string;                // Stack trace（可選）
  context: Record<string, unknown>; // 額外上下文（model, retryCount, etc.）
}

interface ErrorSummary {
  totalErrors: number;
  errorsByAgent: Record<string, number>;
  errorsByPhase: Record<string, number>;
  mostRecentError: TrackedError;
  criticalErrors: TrackedError[]; // 導致失敗的錯誤
}

class ErrorTracker {
  /**
   * 追蹤單一錯誤
   */
  async trackError(
    agent: string,
    phase: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    const trackedError: TrackedError = {
      id: uuidv4(),
      agent,
      phase,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context: context || {},
    };

    // 記錄到記憶體
    this.errors.push(trackedError);

    // ✓ 新增：記錄到資料庫
    if (this.config.enableDatabaseTracking) {
      await this.saveToDatabase(trackedError);
    }
  }

  /**
   * 儲存錯誤到資料庫
   */
  private async saveToDatabase(error: TrackedError): Promise<void> {
    const supabase = await this.getSupabase();

    // 讀取現有的錯誤
    const { data: job } = await supabase
      .from('article_generation_jobs')
      .select('metadata')
      .eq('id', this.jobId)
      .single();

    const existingErrors = job?.metadata?.errors || [];

    // 只保留最新的 10 個錯誤（避免 metadata 過大）
    const errors = [...existingErrors, error].slice(-10);

    // 更新 metadata
    await supabase
      .from('article_generation_jobs')
      .update({
        metadata: {
          ...job?.metadata,
          errors,
          lastError: error, // 最新錯誤
        },
      })
      .eq('id', this.jobId);
  }

  /**
   * 產生錯誤摘要（用於最終的 error_message）
   */
  generateSummary(): ErrorSummary {
    // 統計所有錯誤
    // 回傳結構化的摘要
  }
}
```

**整合到 Orchestrator**：

```typescript
// src/lib/agents/orchestrator.ts

try {
  const introAgent = new IntroductionAgent(aiConfig, context);
  const introOutput = await introAgent.execute(introInput);
} catch (error) {
  // ✓ 追蹤錯誤
  await this.errorTracker.trackError(
    'IntroductionAgent',
    'content_generation',
    error as Error,
    { retryCount: 0, model: agentConfig.writing_model }
  );

  // 繼續拋出錯誤或執行 fallback
  throw error;
}
```

### 3. Enhanced State Management

**職責**：
- 保存所有中間結果到 `metadata`
- 驗證 `savedState` 的完整性
- 允許從任意階段恢復

**狀態格式**：

```typescript
// article_generation_jobs.metadata 格式

interface JobMetadata {
  current_phase:
    | 'research_completed'
    | 'strategy_completed'
    | 'images_completed'
    | 'introduction_completed'
    | 'sections_completed'
    | 'conclusion_completed'
    | 'qa_completed'
    | 'content_completed'
    | 'meta_completed'
    | 'html_completed';

  // 各階段的輸出
  research?: ResearchAgentOutput;
  strategy?: StrategyAgentOutput;
  image?: ImageAgentOutput;

  // ✓ 新增：多 Agent 中間結果
  multiAgentState?: {
    introduction?: IntroductionOutput;
    sections?: SectionOutput[];
    conclusion?: ConclusionOutput;
    qa?: QAOutput;
  };

  writing?: WritingAgentOutput;
  meta?: MetaAgentOutput;
  html?: HTMLAgentOutput;

  // 錯誤追蹤
  errors?: TrackedError[];
  lastError?: TrackedError;

  // Fallback 記錄
  fallbacks?: Array<{
    from: string;
    to: string;
    reason: string;
    timestamp: string;
  }>;
}
```

**恢復邏輯**：

```typescript
// src/lib/agents/orchestrator.ts

async resumeFromPhase(
  currentPhase: string,
  savedState: JobMetadata
): Promise<void> {
  switch (currentPhase) {
    case 'introduction_completed':
      // 恢復 Introduction，繼續執行 Sections
      const { introduction } = savedState.multiAgentState!;
      if (!introduction) {
        throw new Error('Cannot resume: missing introduction data');
      }
      return this.executeSections(introduction, ...);

    case 'sections_completed':
      // 恢復 Sections，繼續執行 Conclusion
      const { introduction, sections } = savedState.multiAgentState!;
      if (!sections || sections.length === 0) {
        throw new Error('Cannot resume: missing sections data');
      }
      return this.executeConclusion(introduction, sections, ...);

    // ... 其他階段
  }
}
```

## Data Flow

### Multi-Agent Content Generation Flow

```
1. Orchestrator.executeContentGeneration()
   ↓
2. IntroductionAgent.execute()
   → Output: { markdown, wordCount }
   → Save to metadata.multiAgentState.introduction
   ↓
3. SectionAgent.execute() × N
   → Output: { markdown, wordCount }[]
   → Save to metadata.multiAgentState.sections
   ↓
4. ConclusionAgent.execute()
   → Output: { markdown, wordCount }
   → Save to metadata.multiAgentState.conclusion
   ↓
5. QAAgent.execute()
   → Output: { markdown, wordCount }
   → Save to metadata.multiAgentState.qa
   ↓
6. ContentAssemblerAgent.execute()
   → Input: { introduction, sections, conclusion, qa }
   → Output: { markdown, html, statistics }
   ↓
7. MultiAgentOutputAdapter.adapt() ← ✓ 新增
   → Input: { assemblerOutput, strategyOutput, focusKeyword }
   → Output: WritingAgentOutput (完整格式)
   ↓
8. ArticleStorageService.saveArticle()
   → Input: { writing: WritingAgentOutput }
   → Output: SavedArticle
```

### Error Tracking Flow

```
1. Agent.execute() throws Error
   ↓
2. Orchestrator catches Error
   ↓
3. ErrorTracker.trackError()
   ↓
4. Save to database (metadata.errors)
   ↓
5. Decide: Retry or Fallback?
   ↓
6. If final failure:
   → ErrorTracker.generateSummary()
   → Write to error_message
   → Update job status to 'failed'
```

### Monitoring and Recovery Flow (GitHub Actions)

```
每 5 分鐘執行：

GitHub Actions Workflow
   ↓
   呼叫 /api/cron/monitor-article-jobs
   (Authorization: Bearer ${CRON_API_SECRET})
   ↓
API 驗證請求來源
   ↓
查詢所有 processing jobs
   ↓
針對每個 job 檢查：
   ├─ 執行時間 > 30 分鐘？
   │  └─ Yes → 標記為 failed，觸發重試（最多 1 次）
   │
   ├─ 卡在某階段 > 10 分鐘？
   │  └─ Yes → 嘗試從該階段恢復
   │
   └─ 狀態 = completed 但未儲存？
      └─ Yes → 嘗試重新儲存
```

**GitHub Actions Workflow 範例**：
```yaml
name: Monitor Article Jobs
on:
  schedule:
    - cron: '*/5 * * * *'  # 每 5 分鐘
  workflow_dispatch:  # 允許手動觸發

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Call Monitoring API
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_API_SECRET }}" \
            -H "Content-Type: application/json" \
            "${{ secrets.APP_URL }}/api/cron/monitor-article-jobs"
```

**API Endpoint 驗證邏輯**：
```typescript
export async function POST(request: NextRequest) {
  // 驗證 Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token !== process.env.CRON_API_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 執行監控邏輯...
}
```

## Implementation Strategy

### Phase 1: Output Adapter (Day 1)

1. 實作 `MultiAgentOutputAdapter` 類別
2. 複製 `writing-agent.ts` 的輔助函式：
   - `calculateReadability()`
   - `analyzeKeywordUsage()`
3. 從 `html-agent.ts` 提取 `extractInternalLinks()`
4. 撰寫單元測試（覆蓋率 > 90%）

### Phase 2: Error Tracking Integration (Day 2)

1. 修改 `ErrorTracker.trackError()` 加入資料庫寫入
2. 在 `Orchestrator` 所有 try-catch 塊加入錯誤追蹤
3. 實作 `ErrorTracker.generateSummary()`
4. 測試錯誤捕獲和記錄

### Phase 3: State Management and Monitoring (Day 3)

1. 修改 `updateJobStatus()` 加入格式驗證
2. 保存 `multiAgentState` 到 metadata
3. 實作 `resumeFromPhase()` 邏輯
4. 建立 `/api/cron/monitor-article-jobs/route.ts`
5. 建立 `.github/workflows/monitor-article-jobs.yml`
6. 測試恢復機制和監控邏輯

### Phase 4: Integration Testing (Day 4)

1. 端到端測試：完整的多 Agent 流程
2. 失敗恢復測試：各階段的錯誤和恢復
3. 格式驗證測試：確保 Adapter 輸出正確
4. 效能測試：確認無額外開銷

### Phase 5: Deployment (Day 5)

1. 部署到 production
2. 在 GitHub repository settings 設定 Secrets：
   - `CRON_API_SECRET` - 隨機生成的 token
   - `APP_URL` - 應用程式 URL
3. 啟用 GitHub Actions workflow
4. 驗證監控運作正常（檢查 Actions 執行日誌）
5. 監控 24 小時
6. 收集錯誤和效能指標
7. 調整和優化

## Testing Strategy

### Unit Tests

- `MultiAgentOutputAdapter.adapt()` - 各種輸入格式
- `ErrorTracker.trackError()` - 資料庫寫入
- `ErrorTracker.generateSummary()` - 錯誤統計
- `Orchestrator.resumeFromPhase()` - 各階段恢復

### Integration Tests

- 完整的多 Agent 流程（成功案例）
- 各階段失敗和恢復
- Fallback 到 Legacy WritingAgent
- 並發執行（多個 jobs 同時運行）

### Edge Cases

- ContentAssembler 輸出格式不正確
- savedState 資料不完整
- 資料庫寫入失敗
- Metadata 大小超過限制（> 100KB）

## Performance Considerations

### Output Adapter

- 計算 readability 需要解析文字：~5-10ms
- 分析 keyword usage：~5ms
- 擷取 internal links：~5ms
- **總計**：< 20ms（可接受）

### Error Tracking

- 資料庫寫入：~30-50ms
- 只在錯誤發生時執行（不影響正常流程）
- Metadata 限制大小（< 10KB per error）

### State Management

- 驗證 savedState：~1-2ms
- 資料庫讀寫：~50-100ms
- 只在恢復時執行（不影響正常流程）

## Security Considerations

- 錯誤訊息不包含敏感資訊（API keys, tokens）
- Stack trace 可能包含檔案路徑（需要 sanitize）
- Metadata 大小限制（防止 DoS）
