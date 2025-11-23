# 完整實作計劃

修復多 Agent 架構的文章儲存和錯誤追蹤問題的完整實作指南。

---

## 🎯 實作原則

1. **核心優先**：先解決最關鍵的問題（格式不匹配）
2. **逐步完善**：再實作周邊功能（錯誤追蹤、監控）
3. **集中測試**：最後進行完整的測試驗證

---

## 📅 實作階段

### Phase 1: 核心架構實作（Day 1-2）

**目標**：解決文章無法儲存的根本問題

#### 1.1 Output Adapter 實作

**檔案**：`src/lib/agents/output-adapter.ts`

```typescript
import type {
  ContentAssemblerOutput,
  StrategyAgentOutput,
  WritingAgentOutput,
} from "@/types/agents";

export interface AdapterInput {
  assemblerOutput: ContentAssemblerOutput;
  strategyOutput: StrategyAgentOutput;
  focusKeyword: string;
}

export class MultiAgentOutputAdapter {
  adapt(input: AdapterInput): WritingAgentOutput {
    const { assemblerOutput, strategyOutput, focusKeyword } = input;

    return {
      markdown: assemblerOutput.markdown,
      html: assemblerOutput.html,
      statistics: this.enhanceStatistics(assemblerOutput.statistics),
      readability: this.calculateReadability(assemblerOutput.markdown),
      keywordUsage: this.analyzeKeywordUsage(
        assemblerOutput.markdown,
        focusKeyword,
      ),
      internalLinks: this.extractInternalLinks(assemblerOutput.html),
      executionInfo: assemblerOutput.executionInfo,
    };
  }

  private calculateReadability(markdown: string): ReadabilityMetrics {
    // 實作 Flesch Reading Ease, Flesch-Kincaid Grade, Gunning Fog Index
    // 複製自 writing-agent.ts
  }

  private analyzeKeywordUsage(markdown: string, keyword: string): KeywordUsage {
    // 實作關鍵字密度和出現次數分析
    // 大小寫不敏感匹配
  }

  private extractInternalLinks(html: string): InternalLink[] {
    // 從 HTML 擷取所有內部連結
    // 回傳 { url, title, anchor }[]
  }

  private enhanceStatistics(
    stats: ContentAssemblerStatistics,
  ): ArticleStatistics {
    // 補充 readingTime, sentenceCount 等
  }
}
```

**任務清單**：

- [ ] 建立 `output-adapter.ts`
- [ ] 實作 `calculateReadability()` 方法
  - Flesch Reading Ease (0-100)
  - Flesch-Kincaid Grade Level
  - Gunning Fog Index
- [ ] 實作 `analyzeKeywordUsage()` 方法
  - 計算關鍵字出現次數
  - 計算關鍵字密度 (%)
  - 大小寫不敏感
- [ ] 實作 `extractInternalLinks()` 方法
  - 解析 HTML
  - 擷取所有 `<a>` 標籤
  - 過濾內部連結
- [ ] 實作 `enhanceStatistics()` 方法
  - 補充 readingTime
  - 補充 sentenceCount
- [ ] 新增型別定義到 `src/types/agents.ts`
- [ ] 撰寫單元測試（覆蓋率 > 90%）

**驗證**：

- 轉換時間 < 20ms
- 所有必要欄位都存在
- 計算結果準確

---

#### 1.2 整合到 Orchestrator

**檔案**：`src/lib/agents/orchestrator.ts`

**修改位置**：Line 200-210（executeContentGeneration 後）

```typescript
// 原本的程式碼
const assemblerOutput = await contentAssembler.execute({
  title,
  introduction,
  sections,
  conclusion,
  qa,
});

// 新增：格式轉換
const adapter = new MultiAgentOutputAdapter();
const writingOutput = adapter.adapt({
  assemblerOutput,
  strategyOutput,
  focusKeyword: input.focusKeyphrase || strategyOutput.selectedTitle,
});

return writingOutput;
```

**任務清單**：

- [ ] 在 `orchestrator.ts` 頂部 import `MultiAgentOutputAdapter`
- [ ] 在 `executeContentGeneration()` 結束前加入轉換邏輯
- [ ] 驗證轉換後的格式符合 `WritingAgentOutput`
- [ ] 加入錯誤處理：
  ```typescript
  try {
    const writingOutput = adapter.adapt(...);
    return writingOutput;
  } catch (adapterError) {
    console.error('[Orchestrator] Output adapter failed:', adapterError);
    // Fallback to legacy WritingAgent
    throw adapterError;
  }
  ```

**驗證**：

- Multi-agent 流程執行成功
- 格式轉換無錯誤
- Fallback 機制正常

---

#### 1.3 ArticleStorage 驗證強化

**檔案**：`src/lib/services/article-storage.ts`

**修改位置**：Line 32（saveArticle 方法開頭）

```typescript
async saveArticle(params: SaveArticleParams): Promise<SavedArticle> {
  const { articleJobId, result, websiteId, companyId, userId } = params;

  // 新增：驗證必要欄位
  this.validateInput(result);

  // 原有的儲存邏輯...
}

private validateInput(result: ArticleGenerationResult): void {
  // 檢查必要欄位存在
  if (!result.writing) {
    throw new ValidationError('Missing required field: result.writing');
  }

  if (!result.meta) {
    throw new ValidationError('Missing required field: result.meta');
  }

  // 檢查 writing 子欄位
  const requiredFields = [
    'markdown',
    'html',
    'statistics',
    'readability',
    'keywordUsage',
    'internalLinks'
  ];

  for (const field of requiredFields) {
    if (!result.writing[field]) {
      throw new ValidationError(`Missing required field: result.writing.${field}`);
    }
  }

  // 檢查資料類型
  this.validateTypes(result);

  // 檢查數值範圍
  this.validateRanges(result);
}

private validateTypes(result: ArticleGenerationResult): void {
  const { writing } = result;

  if (typeof writing.statistics.wordCount !== 'number') {
    throw new ValidationError('Invalid type for wordCount: expected number');
  }

  if (typeof writing.readability.fleschReadingEase !== 'number') {
    throw new ValidationError('Invalid type for fleschReadingEase: expected number');
  }

  // ... 更多類型檢查
}

private validateRanges(result: ArticleGenerationResult): void {
  const { writing } = result;

  if (writing.statistics.wordCount <= 0 || writing.statistics.wordCount > 100000) {
    throw new ValidationError(
      `Value out of range for wordCount: ${writing.statistics.wordCount} (expected 1-100000)`
    );
  }

  if (writing.readability.fleschReadingEase < 0 || writing.readability.fleschReadingEase > 100) {
    throw new ValidationError(
      `Value out of range for fleschReadingEase: ${writing.readability.fleschReadingEase} (expected 0-100)`
    );
  }

  // ... 更多範圍檢查
}
```

**任務清單**：

- [ ] 實作 `validateInput()` 方法
- [ ] 實作 `validateTypes()` 方法
- [ ] 實作 `validateRanges()` 方法
- [ ] 建立 `ValidationError` 類別
- [ ] 撰寫單元測試

**驗證**：

- 缺失欄位時拋出清晰錯誤
- 類型錯誤時拋出清晰錯誤
- 範圍錯誤時拋出清晰錯誤

---

**Phase 1 驗收標準**：
✅ Multi-Agent 生成的文章可以成功儲存
✅ `generated_articles` 表有新記錄
✅ 所有欄位都有值（無 null）
✅ 單元測試覆蓋率 > 90%

---

### Phase 2: 錯誤追蹤和狀態管理（Day 3）

**目標**：確保錯誤可以被追蹤，失敗可以恢復

#### 2.1 Error Tracker 強化

**檔案**：`src/lib/agents/error-tracker.ts`

**新增方法**：

```typescript
export class ErrorTracker {
  constructor(
    private articleJobId: string,
    private supabase: SupabaseClient,
  ) {
    this.errors = [];
  }

  async trackError(error: TrackedError): Promise<void> {
    // 原有的記憶體追蹤
    this.errors.push(error);

    // 新增：寫入資料庫
    await this.saveToDatabase(error);
  }

  private async saveToDatabase(error: TrackedError): Promise<void> {
    // 1. 讀取現有的 metadata
    const { data: job } = await this.supabase
      .from("article_generation_jobs")
      .select("metadata")
      .eq("id", this.articleJobId)
      .single();

    const metadata = job?.metadata || {};
    const existingErrors = metadata.errors || [];

    // 2. 新增錯誤（只保留最新 10 個）
    const updatedErrors = [
      ...existingErrors,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agent: error.agent,
        phase: error.phase,
        message: error.error,
        context: error.context,
      },
    ].slice(-10); // 只保留最新 10 個

    // 3. 更新 metadata
    await this.supabase
      .from("article_generation_jobs")
      .update({
        metadata: {
          ...metadata,
          errors: updatedErrors,
          lastError: {
            timestamp: new Date().toISOString(),
            message: error.error,
          },
        },
      })
      .eq("id", this.articleJobId);
  }

  generateSummary(): string {
    if (this.errors.length === 0) {
      return "No errors occurred";
    }

    const summary = [
      `Total errors: ${this.errors.length}`,
      "",
      "Error breakdown:",
    ];

    // 按 agent 分組
    const groupedByAgent = this.errors.reduce(
      (acc, error) => {
        if (!acc[error.agent]) {
          acc[error.agent] = [];
        }
        acc[error.agent].push(error);
        return acc;
      },
      {} as Record<string, TrackedError[]>,
    );

    for (const [agent, errors] of Object.entries(groupedByAgent)) {
      summary.push(`- ${agent}: ${errors.length} error(s)`);
      errors.forEach((err) => {
        summary.push(`  - ${err.error}`);
      });
    }

    return summary.join("\n");
  }
}
```

**任務清單**：

- [ ] 修改 constructor 接受 `supabase` 參數
- [ ] 實作 `saveToDatabase()` 方法
- [ ] 實作 `generateSummary()` 方法
- [ ] 限制 metadata 大小（< 10KB）
- [ ] 撰寫單元測試

**驗證**：

- 錯誤正確寫入資料庫
- Metadata 大小 < 10KB
- 摘要格式清晰

---

#### 2.2 Orchestrator 錯誤整合

**檔案**：`src/lib/agents/orchestrator.ts`

**修改所有 Agent 執行**：

```typescript
// Introduction Agent
try {
  const introduction = await introAgent.execute(...);
  await this.updateJobStatus('introduction_completed', { introduction });
} catch (error) {
  await this.errorTracker.trackError({
    agent: 'IntroductionAgent',
    phase: 'content_generation',
    error: error.message,
    context: {
      retryCount: this.retryCount,
      input: input.focusKeyphrase,
    }
  });
  throw error;
}

// Section Agent
try {
  const sections = await sectionAgent.execute(...);
  await this.updateJobStatus('sections_completed', { introduction, sections });
} catch (error) {
  await this.errorTracker.trackError({
    agent: 'SectionAgent',
    phase: 'content_generation',
    error: error.message,
    context: {
      sectionIndex: i,
      retryCount: this.retryCount,
    }
  });
  throw error;
}

// 最終失敗時
catch (finalError) {
  const errorSummary = this.errorTracker.generateSummary();

  await this.supabase
    .from('article_generation_jobs')
    .update({
      status: 'failed',
      error_message: errorSummary,
    })
    .eq('id', this.articleJobId);
}
```

**任務清單**：

- [ ] 在所有 Agent 執行加入 try-catch
- [ ] 每個錯誤都呼叫 `trackError()`
- [ ] Fallback 時記錄原因到 `metadata.fallbacks`
- [ ] 最終失敗時呼叫 `generateSummary()`
- [ ] 撰寫單元測試

**驗證**：

- 各階段失敗時都有錯誤記錄
- `error_message` 包含完整的錯誤摘要

---

#### 2.3 狀態保存和恢復

**檔案**：`src/lib/agents/orchestrator.ts`

**新增方法**：

```typescript
private async updateJobStatus(
  phase: string,
  state: Partial<MultiAgentState>
): Promise<void> {
  // 驗證 state 格式
  this.validateState(state);

  // 讀取現有 metadata
  const { data: job } = await this.supabase
    .from('article_generation_jobs')
    .select('metadata')
    .eq('id', this.articleJobId)
    .single();

  const metadata = job?.metadata || {};

  // 更新 metadata
  await this.supabase
    .from('article_generation_jobs')
    .update({
      current_phase: phase,
      metadata: {
        ...metadata,
        multiAgentState: {
          ...metadata.multiAgentState,
          ...state,
        }
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', this.articleJobId);
}

private validateState(state: Partial<MultiAgentState>): void {
  // 檢查必要欄位
  for (const [key, value] of Object.entries(state)) {
    if (value && typeof value === 'object') {
      if (!value.markdown || typeof value.markdown !== 'string') {
        throw new Error(`Invalid state: ${key}.markdown is required`);
      }
      if (typeof value.wordCount !== 'number') {
        throw new Error(`Invalid state: ${key}.wordCount must be a number`);
      }
    }
  }
}

private async resumeFromPhase(
  currentPhase: string,
  savedState: JobMetadata
): Promise<void> {
  // 驗證 savedState
  this.validateSavedState(savedState);

  switch (currentPhase) {
    case 'introduction_completed':
      const { introduction } = savedState.multiAgentState!;
      if (!introduction) {
        throw new Error('Cannot resume: missing introduction data');
      }
      return this.executeSections(introduction, ...);

    case 'sections_completed':
      const { introduction, sections } = savedState.multiAgentState!;
      if (!sections || sections.length === 0) {
        throw new Error('Cannot resume: missing sections data');
      }
      return this.executeConclusion(introduction, sections, ...);

    case 'conclusion_completed':
      const { introduction, sections, conclusion } = savedState.multiAgentState!;
      if (!conclusion) {
        throw new Error('Cannot resume: missing conclusion data');
      }
      return this.executeQA(introduction, sections, conclusion, ...);

    case 'qa_completed':
      const { introduction, sections, conclusion, qa } = savedState.multiAgentState!;
      if (!qa) {
        throw new Error('Cannot resume: missing QA data');
      }
      return this.executeAssembly(introduction, sections, conclusion, qa, ...);

    default:
      throw new Error(`Cannot resume from unknown phase: ${currentPhase}`);
  }
}

private validateSavedState(savedState: JobMetadata): void {
  if (!savedState.multiAgentState) {
    throw new Error('Cannot resume: no saved state found');
  }

  // 檢查 metadata 大小
  const metadataSize = JSON.stringify(savedState).length;
  if (metadataSize > 100 * 1024) { // 100KB
    throw new Error(`Saved state too large: ${metadataSize} bytes`);
  }
}
```

**任務清單**：

- [ ] 實作 `validateState()` 方法
- [ ] 修改 `updateJobStatus()` 加入格式驗證
- [ ] 實作 `resumeFromPhase()` 方法
- [ ] 實作 `validateSavedState()` 方法
- [ ] 支援所有階段的恢復
- [ ] 撰寫單元測試

**驗證**：

- 各階段的中間結果正確保存
- Metadata 格式符合預期
- 各階段失敗後可以正確恢復

---

**Phase 2 驗收標準**：
✅ 所有錯誤都記錄到 `metadata.errors`
✅ `error_message` 包含完整摘要
✅ 各階段失敗後可以恢復
✅ 單元測試覆蓋率 > 90%

---

### Phase 3: 配置優化和監控（Day 4）

**目標**：自動化配置，建立監控機制

詳細內容請參考完整計劃文件...

---

### Phase 4: 測試驗證（Day 5）

**目標**：確保所有功能正常運作

詳細內容請參考完整計劃文件...

---

### Phase 5: 部署和監控（Day 6）

**目標**：部署到 production，確保穩定運行

詳細內容請參考完整計劃文件...

---

## 📊 最終驗收標準

請參考完整計劃文件的最終驗收標準清單。
