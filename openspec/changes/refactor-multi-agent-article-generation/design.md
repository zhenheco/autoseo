# 多 Agent 文章生成架構 - 技術設計

## Context

當前系統使用單一 WritingAgent 生成整篇文章，存在解析失敗、容錯性差、難以優化的問題。本設計將文章生成拆分為多個專門的 agent，每個負責文章的特定部分，並由 Orchestrator 協調執行。

### Stakeholders
- **開發團隊** - 實作和維護新架構
- **用戶** - 期望更高品質和更穩定的文章生成
- **系統管理員** - 需要監控和調試工具

### Constraints
- 必須保持向後兼容（透過 Feature Flag）
- Token 成本不得大幅增加（< 20%）
- 平均生成時間不得增加（目標 < 3 分鐘）
- 必須支援現有的所有 AI 模型

## Goals / Non-Goals

### Goals
1. **降低 "No main sections parsed" 錯誤率至 < 1%**
2. **提升文章生成成功率至 > 95%**
3. **支援獨立優化各部分品質**（前言、段落、FAQ）
4. **完善的重試和錯誤追蹤機制**
5. **平滑遷移，零停機時間**

### Non-Goals
1. **不**改變現有的 AI 模型選擇邏輯
2. **不**改變現有的 token 計費機制
3. **不**重構 Research 或 Image generation（除了執行時機調整）
4. **不**改變文章的最終輸出格式

## Detailed Design

### 完整執行流程

```typescript
// Orchestrator 新的 execute 方法
async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
  const useMultiAgent = this.shouldUseMultiAgent(input);

  if (!useMultiAgent) {
    return this.executeLegacyFlow(input); // 舊系統 fallback
  }

  try {
    // Phase 1: Research（不變）
    const research = await this.executeWithRetry(
      () => this.executeResearchAgent(input),
      RetryConfig.RESEARCH_AGENT
    );

    // Phase 2: Planning（串行）
    const strategy = await this.executeWithRetry(
      () => this.executeStrategyAgent(research, input),
      RetryConfig.STRATEGY_AGENT  // 最關鍵，重試次數最多
    );

    // Phase 3: Image Generation（在內容生成前）
    const images = await this.executeWithRetry(
      () => this.executeImageAgent(strategy.outline, input),
      RetryConfig.IMAGE_AGENT
    );

    // Phase 4: Content Generation（分批並行）
    const contentParts = await this.executeContentGeneration(
      strategy,
      images,
      research,
      input
    );

    // Phase 5: Assembly（串行）
    const assembled = await this.executeWithRetry(
      () => this.executeContentAssembler(contentParts),
      RetryConfig.ASSEMBLER_AGENT
    );

    // Phase 6: HTML Processing（串行）
    const html = await this.executeWithRetry(
      () => this.executeHTMLAgent(assembled, research.internalLinks, research.externalRefs),
      RetryConfig.HTML_AGENT
    );

    // Phase 7: Meta & Category（串行）
    const meta = await this.executeWithRetry(
      () => this.executeMetaAgent(html, strategy.selectedTitle),
      RetryConfig.META_AGENT
    );

    const category = await this.executeWithRetry(
      () => this.executeCategoryAgent(html),
      RetryConfig.CATEGORY_AGENT
    );

    return {
      ...assembled,
      html: html.finalHtml,
      meta,
      category,
      images,
      executionInfo: this.aggregateExecutionInfo()
    };

  } catch (error) {
    // 最終 fallback：切換到舊系統
    this.errorTracker.trackFallback('multi-agent-failure', error);
    return this.executeLegacyFlow(input);
  }
}

// Content Generation 詳細流程
private async executeContentGeneration(
  strategy: StrategyOutput,
  images: ImageOutput,
  research: ResearchOutput,
  input: ArticleGenerationInput
): Promise<ContentParts> {

  // Batch 1: 可並行的部分
  const [introduction, conclusion, qa] = await Promise.all([
    this.executeWithRetry(
      () => this.executeIntroductionAgent({
        outline: strategy.outline,
        featuredImage: images.featuredImage,
        brandVoice: input.brandVoice
      }),
      RetryConfig.INTRODUCTION_AGENT
    ),
    this.executeWithRetry(
      () => this.executeConclusionAgent({
        outline: strategy.outline,
        brandVoice: input.brandVoice
      }),
      RetryConfig.CONCLUSION_AGENT
    ),
    this.executeWithRetry(
      () => this.executeQAAgent({
        title: strategy.selectedTitle,
        outline: strategy.outline,
        brandVoice: input.brandVoice
      }),
      RetryConfig.QA_AGENT
    )
  ]);

  // Batch 2: Sections（順序執行，保持連貫性）
  const sections: SectionOutput[] = [];
  for (let i = 0; i < strategy.outline.mainSections.length; i++) {
    const section = strategy.outline.mainSections[i];
    const previousSummary = i > 0 ? sections[i - 1].summary : undefined;
    const sectionImage = images.contentImages[i] || null;

    const sectionOutput = await this.executeWithRetry(
      () => this.executeSectionAgent({
        section,
        previousSummary,
        sectionImage,
        brandVoice: input.brandVoice,
        index: i
      }),
      RetryConfig.SECTION_AGENT
    );

    sections.push(sectionOutput);
  }

  return {
    introduction,
    sections,
    conclusion,
    qa
  };
}
```

### 重試機制設計

#### 重試配置結構

```typescript
// src/lib/agents/retry-config.ts

export interface RetryConfig {
  maxAttempts: number;         // 最大重試次數
  initialDelayMs: number;      // 初始延遲（毫秒）
  maxDelayMs: number;          // 最大延遲（毫秒）
  backoffMultiplier: number;   // 延遲倍增係數（exponential backoff）
  retryableErrors: string[];   // 可重試的錯誤類型
  shouldAdjustParams: boolean; // 是否在重試時調整參數
  timeoutMs?: number;          // 單次執行超時（可選）
}

export interface AgentRetryConfig extends RetryConfig {
  agentName: string;
  paramAdjustment?: (attempt: number) => Partial<AgentInput>;
}

// 預設配置
export const RetryConfig = {
  // 最關鍵的 agent - 最多重試
  STRATEGY_AGENT: {
    agentName: 'StrategyAgent',
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded', 'model_overloaded'],
    shouldAdjustParams: true,
    paramAdjustment: (attempt) => ({
      temperature: Math.min(0.7 + attempt * 0.1, 1.0) // 逐次增加 temperature
    }),
    timeoutMs: 120000 // 2 分鐘
  },

  // 內容生成 agent - 標準重試
  INTRODUCTION_AGENT: {
    agentName: 'IntroductionAgent',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 60000
  },

  SECTION_AGENT: {
    agentName: 'SectionAgent',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 90000
  },

  CONCLUSION_AGENT: {
    agentName: 'ConclusionAgent',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 60000
  },

  QA_AGENT: {
    agentName: 'QAAgent',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 20000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 60000
  },

  // 圖片生成 - 特殊處理（失敗不影響流程）
  IMAGE_AGENT: {
    agentName: 'ImageAgent',
    maxAttempts: 3,
    initialDelayMs: 5000,  // 圖片生成較慢，初始延遲更長
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded', 'content_policy_violation'],
    shouldAdjustParams: true,
    paramAdjustment: (attempt) => ({
      // 重試時調整 prompt，避免 content policy violation
      quality: attempt > 1 ? 'standard' : 'hd'
    }),
    timeoutMs: 180000 // 3 分鐘
  },

  // 組合和處理 - 較少重試（主要是邏輯處理）
  ASSEMBLER_AGENT: {
    agentName: 'ContentAssemblerAgent',
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [],  // 組合失敗通常是邏輯錯誤，不重試
    shouldAdjustParams: false,
    timeoutMs: 30000
  },

  HTML_AGENT: {
    agentName: 'HTMLAgent',
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [],
    shouldAdjustParams: false,
    timeoutMs: 30000
  },

  META_AGENT: {
    agentName: 'MetaAgent',
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 60000
  },

  // 其他
  RESEARCH_AGENT: {
    agentName: 'ResearchAgent',
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'rate_limit_exceeded'],
    shouldAdjustParams: false,
    timeoutMs: 120000
  },

  CATEGORY_AGENT: {
    agentName: 'CategoryAgent',
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
    shouldAdjustParams: false,
    timeoutMs: 60000
  }
} as const;
```

#### 重試執行器

```typescript
// src/lib/agents/orchestrator.ts

private async executeWithRetry<T>(
  fn: () => Promise<T>,
  config: AgentRetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // 設定 timeout
      const timeoutPromise = config.timeoutMs
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Agent execution timeout')), config.timeoutMs)
          )
        : null;

      const executionPromise = fn();

      const result = timeoutPromise
        ? await Promise.race([executionPromise, timeoutPromise])
        : await executionPromise;

      // 成功：記錄並返回
      this.errorTracker.trackSuccess(config.agentName, attempt);
      return result;

    } catch (error) {
      lastError = error as Error;

      // 記錄錯誤
      this.errorTracker.trackError(config.agentName, error, attempt, config.maxAttempts);

      // 檢查是否可重試
      const isRetryable = this.isRetryableError(error, config.retryableErrors);
      const hasMoreAttempts = attempt < config.maxAttempts;

      if (!isRetryable || !hasMoreAttempts) {
        console.error(
          `[Orchestrator] ${config.agentName} failed after ${attempt} attempts`,
          { error: lastError.message }
        );
        throw lastError;
      }

      // 計算延遲（exponential backoff）
      const currentDelay = Math.min(delay, config.maxDelayMs);
      console.warn(
        `[Orchestrator] ${config.agentName} attempt ${attempt} failed, retrying in ${currentDelay}ms`,
        { error: lastError.message }
      );

      await this.sleep(currentDelay);
      delay *= config.backoffMultiplier;

      // 調整參數（如果配置允許）
      if (config.shouldAdjustParams && config.paramAdjustment) {
        const adjustment = config.paramAdjustment(attempt);
        // 應用參數調整到下一次執行（需要修改 fn 的閉包）
      }
    }
  }

  throw lastError || new Error(`${config.agentName} failed after ${config.maxAttempts} attempts`);
}

private isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  const err = error as Error & { code?: string; type?: string };

  // 檢查錯誤碼
  if (err.code && retryableErrors.includes(err.code)) {
    return true;
  }

  // 檢查錯誤訊息
  const message = err.message.toLowerCase();
  for (const retryableType of retryableErrors) {
    if (message.includes(retryableType.toLowerCase())) {
      return true;
    }
  }

  return false;
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 錯誤追蹤設計

#### 錯誤追蹤結構

```typescript
// src/lib/agents/error-tracker.ts

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',           // 網路錯誤
  AI_API = 'ai_api',             // AI API 錯誤
  TIMEOUT = 'timeout',           // 超時
  RATE_LIMIT = 'rate_limit',     // 速率限制
  PARSING = 'parsing',           // 解析錯誤
  VALIDATION = 'validation',     // 驗證錯誤
  LOGIC = 'logic',               // 邏輯錯誤
  UNKNOWN = 'unknown'            // 未知錯誤
}

export interface ErrorContext {
  agentName: string;
  attemptNumber: number;
  maxAttempts: number;
  input?: unknown;               // Agent 輸入（可能包含敏感資訊，需過濾）
  executionTimeMs?: number;
  timestamp: string;
  articleJobId?: string;
  userId?: string;
  companyId?: string;
}

export interface TrackedError {
  id: string;                    // 唯一錯誤 ID
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  metadata?: Record<string, unknown>;
}

export class ErrorTracker {
  private errors: TrackedError[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(
    private options: {
      enableLogging: boolean;
      enableMetrics: boolean;
      enableExternalTracking: boolean;  // Sentry, Datadog 等
      maxErrorsInMemory: number;
    }
  ) {}

  trackError(
    agentName: string,
    error: unknown,
    attemptNumber: number,
    maxAttempts: number,
    additionalContext?: Record<string, unknown>
  ): void {
    const err = error as Error & { code?: string };

    const category = this.categorizeError(err);
    const severity = this.determineSeverity(category, attemptNumber, maxAttempts);

    const trackedError: TrackedError = {
      id: this.generateErrorId(),
      category,
      severity,
      message: err.message,
      stack: err.stack,
      context: {
        agentName,
        attemptNumber,
        maxAttempts,
        timestamp: new Date().toISOString(),
        ...additionalContext
      },
      metadata: {
        errorCode: err.code,
        errorName: err.name
      }
    };

    // 記錄到內存（有限制）
    this.addToMemory(trackedError);

    // 日誌輸出
    if (this.options.enableLogging) {
      this.logError(trackedError);
    }

    // 更新計數器
    if (this.options.enableMetrics) {
      this.updateMetrics(trackedError);
    }

    // 外部追蹤服務
    if (this.options.enableExternalTracking) {
      this.sendToExternalTracker(trackedError);
    }
  }

  trackSuccess(agentName: string, attemptNumber: number): void {
    if (this.options.enableMetrics) {
      const key = `${agentName}:success`;
      this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }

    if (attemptNumber > 1 && this.options.enableLogging) {
      console.log(`[ErrorTracker] ✅ ${agentName} succeeded after ${attemptNumber} attempts`);
    }
  }

  trackFallback(reason: string, error: unknown): void {
    const err = error as Error;

    console.error('[ErrorTracker] 🔄 Falling back to legacy system', {
      reason,
      error: err.message
    });

    if (this.options.enableExternalTracking) {
      // 發送到外部服務（這是critical事件）
      this.sendToExternalTracker({
        id: this.generateErrorId(),
        category: ErrorCategory.LOGIC,
        severity: ErrorSeverity.CRITICAL,
        message: `Fallback triggered: ${reason}`,
        stack: err.stack,
        context: {
          agentName: 'Orchestrator',
          attemptNumber: 1,
          maxAttempts: 1,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // 取得統計資訊
  getStats(): ErrorStats {
    const stats: ErrorStats = {
      totalErrors: this.errors.length,
      byCategory: {},
      bySeverity: {},
      byAgent: {},
      successRate: {}
    };

    this.errors.forEach(err => {
      // By category
      stats.byCategory[err.category] = (stats.byCategory[err.category] || 0) + 1;

      // By severity
      stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;

      // By agent
      const agent = err.context.agentName;
      stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
    });

    // Calculate success rate
    this.errorCounts.forEach((count, key) => {
      if (key.endsWith(':success')) {
        const agentName = key.replace(':success', '');
        const errorKey = `${agentName}:error`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        const successCount = count;
        const total = successCount + errorCount;

        stats.successRate[agentName] = total > 0 ? (successCount / total) * 100 : 100;
      }
    });

    return stats;
  }

  // 重置（用於測試或週期性清理）
  reset(): void {
    this.errors = [];
    this.errorCounts.clear();
  }

  private categorizeError(error: Error & { code?: string }): ErrorCategory {
    const message = error.message.toLowerCase();
    const code = error.code?.toLowerCase();

    if (code === 'etimedout' || message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (code === 'econnreset' || message.includes('econnreset')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('rate_limit') || message.includes('rate limit')) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (message.includes('parse') || message.includes('json')) {
      return ErrorCategory.PARSING;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('model') || message.includes('api')) {
      return ErrorCategory.AI_API;
    }

    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(
    category: ErrorCategory,
    attemptNumber: number,
    maxAttempts: number
  ): ErrorSeverity {
    // 最後一次嘗試失敗 → ERROR
    if (attemptNumber === maxAttempts) {
      return ErrorSeverity.ERROR;
    }

    // Rate limit 或網路錯誤 → WARNING（可重試）
    if (category === ErrorCategory.RATE_LIMIT || category === ErrorCategory.NETWORK) {
      return ErrorSeverity.WARNING;
    }

    // Timeout → WARNING
    if (category === ErrorCategory.TIMEOUT) {
      return ErrorSeverity.WARNING;
    }

    // 第一次嘗試就失敗 → INFO（可能只是暫時性問題）
    if (attemptNumber === 1) {
      return ErrorSeverity.INFO;
    }

    return ErrorSeverity.WARNING;
  }

  private logError(error: TrackedError): void {
    const logData = {
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      agent: error.context.agentName,
      attempt: `${error.context.attemptNumber}/${error.context.maxAttempts}`,
      message: error.message
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        console.error('[ErrorTracker]', logData);
        break;
      case ErrorSeverity.WARNING:
        console.warn('[ErrorTracker]', logData);
        break;
      case ErrorSeverity.INFO:
        console.log('[ErrorTracker]', logData);
        break;
    }
  }

  private updateMetrics(error: TrackedError): void {
    const key = `${error.context.agentName}:error`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  private sendToExternalTracker(error: TrackedError): void {
    // TODO: 整合 Sentry, Datadog 或其他服務
    // 範例：
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(new Error(error.message), {
    //     level: error.severity,
    //     tags: {
    //       agent: error.context.agentName,
    //       category: error.category
    //     },
    //     extra: error.context
    //   });
    // }
  }

  private addToMemory(error: TrackedError): void {
    this.errors.push(error);

    // 限制內存中的錯誤數量
    if (this.errors.length > this.options.maxErrorsInMemory) {
      this.errors.shift(); // 移除最舊的錯誤
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface ErrorStats {
  totalErrors: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  byAgent: Record<string, number>;
  successRate: Record<string, number>;  // Percentage
}
```

### Feature Flag 實施

```typescript
// src/lib/agents/orchestrator.ts

private shouldUseMultiAgent(input: ArticleGenerationInput): boolean {
  // 檢查環境變數
  const enabled = process.env.USE_MULTI_AGENT_ARCHITECTURE === 'true';
  if (!enabled) {
    return false;
  }

  // A/B 測試：基於 article job ID 的 hash 分流
  const rolloutPercentage = parseInt(process.env.MULTI_AGENT_ROLLOUT_PERCENTAGE || '100', 10);

  if (rolloutPercentage >= 100) {
    return true;
  }

  // 使用 article job ID 計算 hash（保證同一篇文章總是用同一個系統）
  const hash = this.hashString(input.articleJobId);
  const bucket = hash % 100;

  return bucket < rolloutPercentage;
}

private hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
```

## Agent 介面定義

### IntroductionAgent

```typescript
interface IntroductionInput {
  outline: Outline;
  featuredImage: GeneratedImage | null;
  brandVoice: BrandVoice;
  model: string;
}

interface IntroductionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: AgentExecutionInfo;
}
```

### SectionAgent

```typescript
interface SectionInput {
  section: MainSection;
  previousSummary?: string;  // 前一段落的摘要
  sectionImage: GeneratedImage | null;
  brandVoice: BrandVoice;
  index: number;
  model: string;
}

interface SectionOutput {
  markdown: string;
  summary: string;  // 本段落摘要，給下一個 section 使用
  wordCount: number;
  executionInfo: AgentExecutionInfo;
}
```

### ConclusionAgent

```typescript
interface ConclusionInput {
  outline: Outline;
  brandVoice: BrandVoice;
  model: string;
}

interface ConclusionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: AgentExecutionInfo;
}
```

### QAAgent

```typescript
interface QAInput {
  title: string;
  outline: Outline;
  brandVoice: BrandVoice;
  count: number;  // 生成幾個 FAQ（3-5）
  model: string;
}

interface QAOutput {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  markdown: string;  // 已格式化的 FAQ markdown
  executionInfo: AgentExecutionInfo;
}
```

### ContentAssemblerAgent

```typescript
interface ContentAssemblerInput {
  title: string;
  introduction: IntroductionOutput;
  sections: SectionOutput[];
  conclusion: ConclusionOutput;
  qa: QAOutput;
}

interface ContentAssemblerOutput {
  markdown: string;
  html: string;  // 初步的 HTML（未插入連結）
  statistics: {
    totalWords: number;
    totalParagraphs: number;
    totalSections: number;
    totalFAQs: number;
  };
  executionInfo: AgentExecutionInfo;
}
```

## Risks / Trade-offs

### 風險分析

1. **複雜度增加 → 詳細日誌和錯誤追蹤**
   - 每個 agent 都有獨立的日誌
   - ErrorTracker 統一管理錯誤
   - 提供統計資訊 API

2. **Token 成本可能增加 → 成本控制機制**
   - 使用較小模型（deepseek-chat）
   - 設定 maxTokens 限制
   - 監控每個 agent 的 token 使用

3. **重試風暴 → Exponential backoff**
   - 初始延遲：1-2 秒
   - 倍增係數：2x
   - 最大延遲：20-30 秒
   - 限制總重試次數

4. **Cascading failures → 獨立容錯**
   - 每個 agent 獨立重試
   - 失敗不影響其他 agent
   - 最終 fallback 到舊系統

## Migration Plan

### Stage 1: 基礎建設（Week 1）
- 建立所有新 agent 的基礎類別
- 實作重試機制和錯誤追蹤
- 建立 Feature Flag 支援

### Stage 2: 整合測試（Week 2）
- 端到端測試
- 壓力測試（重試、並行、timeout）
- A/B 測試基礎設施

### Stage 3: 漸進部署（Week 3-4）
- 10% 流量測試（3-5 天）
- 50% 流量測試（3-5 天）
- 100% 流量切換
- 監控和優化

### Stage 4: 清理（Week 4+）
- 收集反饋
- 優化效能
- 移除舊系統（保留 30 天）

## Open Questions

1. **是否需要 CircuitBreaker 模式？**
   - 當某個 agent 持續失敗時，自動切換到 fallback
   - 避免浪費時間在已知會失敗的操作上

2. **錯誤追蹤應該使用哪個外部服務？**
   - Sentry（推薦，開源友好）
   - Datadog（企業級，但成本高）
   - 自建 ELK stack（靈活但維護成本高）

3. **是否需要為每個 agent 設定不同的 rate limit？**
   - 避免同時觸發太多 API 請求
   - 需要與 AI provider 的 rate limit 協調

4. **SectionAgent 是否應該支援完全並行模式？**
   - 優勢：更快
   - 劣勢：可能失去連貫性
   - 建議：作為可選配置（default 為順序執行）
