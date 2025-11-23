# Subagents 架構設計

## 概述

使用 Multi-Agent System（多智能體系統）來執行 SEO 文章生成流程。每個 Agent 專注於特定任務，協同合作完成完整的文章生成流程。

## Subagents 定義

### 1. Research Agent（調查智能體）

**職責**：關鍵字研究和 SERP 分析

**輸入**：

- 關鍵字
- 目標地區
- 競爭對手數量

**任務**：

1. 執行 SERP 查詢（使用 SerpAPI 或 Perplexity）
2. 分析前 10 名搜尋結果
3. 識別內容主題和角度
4. 分析搜尋意圖
5. 找出內容缺口

**輸出**：

```typescript
interface ResearchOutput {
  keyword: string;
  searchIntent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational";
  topRankingFeatures: {
    contentLength: { min: number; max: number; avg: number };
    titlePatterns: string[];
    structurePatterns: string[];
    commonTopics: string[];
  };
  contentGaps: string[];
  competitorAnalysis: {
    url: string;
    title: string;
    strengths: string[];
    weaknesses: string[];
  }[];
  recommendedStrategy: string;
}
```

### 2. Strategy Agent（策略智能體）

**職責**：內容策略規劃和大綱制定

**輸入**：

- Research Agent 的輸出
- 品牌聲音設定
- 目標字數
- 工作流設定

**任務**：

1. 基於 SERP 分析制定內容策略
2. 生成 3 個標題選項
3. 制定詳細的文章大綱
4. 規劃章節結構
5. 設定關鍵字密度目標
6. 建議相關關鍵字

**輸出**：

```typescript
interface StrategyOutput {
  titleOptions: string[];
  selectedTitle: string;
  outline: {
    introduction: {
      hook: string;
      context: string;
      thesis: string;
    };
    mainSections: {
      heading: string;
      subheadings: string[];
      keyPoints: string[];
      targetWordCount: number;
    }[];
    conclusion: {
      summary: string;
      callToAction: string;
    };
    faq: {
      question: string;
      answerOutline: string;
    }[];
  };
  targetWordCount: number;
  keywordDensityTarget: number;
  relatedKeywords: string[];
  internalLinkingStrategy: {
    targetSections: string[];
    suggestedTopics: string[];
  };
}
```

### 3. Writing Agent（撰寫智能體）

**職責**：根據大綱撰寫完整文章

**輸入**：

- Strategy Agent 的輸出
- 品牌聲音設定
- 舊文章列表（用於內部連結）
- AI 模型選擇

**任務**：

1. 撰寫引言段落
2. 展開每個主要章節
3. 自然加入內部連結
4. 撰寫結論
5. 生成 FAQ 區塊
6. 確保品牌聲音一致性

**輸出**：

```typescript
interface WritingOutput {
  markdown: string;
  html: string;
  statistics: {
    wordCount: number;
    paragraphCount: number;
    sentenceCount: number;
    readingTime: number;
  };
  internalLinks: {
    anchor: string;
    url: string;
    section: string;
  }[];
  keywordUsage: {
    count: number;
    density: number;
    distribution: {
      section: string;
      count: number;
    }[];
  };
}
```

### 4. Image Agent（圖片智能體）

**職責**：生成文章所需的圖片

**輸入**：

- 文章標題
- 文章大綱
- 品牌風格（如果有）
- 圖片數量需求

**任務**：

1. 分析文章內容確定需要的圖片類型
2. 生成圖片提示詞（prompts）
3. 使用 AI 圖片生成服務（DALL-E, Midjourney, Stable Diffusion）
4. 優化圖片尺寸和格式
5. 生成替代文字（alt text）

**輸出**：

```typescript
interface ImageOutput {
  featuredImage: {
    url: string;
    prompt: string;
    altText: string;
    width: number;
    height: number;
  };
  contentImages: {
    url: string;
    prompt: string;
    altText: string;
    suggestedSection: string;
    width: number;
    height: number;
  }[];
}
```

### 5. Quality Agent（品質檢查智能體）

**職責**：驗證文章品質並提供改進建議

**輸入**：

- Writing Agent 的輸出
- Image Agent 的輸出
- 品質門檻設定
- 工作流設定

**任務**：

1. 檢查字數是否在範圍內
2. 驗證關鍵字密度
3. 檢查結構完整性（H1, H2, H3）
4. 驗證內部連結數量
5. 檢查 FAQ 區塊
6. 分析可讀性分數
7. 檢查 SEO 優化程度

**輸出**：

```typescript
interface QualityOutput {
  score: number;
  passed: boolean;
  checks: {
    wordCount: {
      passed: boolean;
      actual: number;
      expected: string;
      weight: number;
    };
    keywordDensity: {
      passed: boolean;
      actual: number;
      expected: string;
      weight: number;
    };
    structure: {
      passed: boolean;
      h1Count: number;
      h2Count: number;
      h3Count: number;
      weight: number;
    };
    internalLinks: {
      passed: boolean;
      count: number;
      expected: number;
      weight: number;
    };
    readability: {
      passed: boolean;
      score: number;
      level: string;
      weight: number;
    };
    seoOptimization: {
      passed: boolean;
      issues: string[];
      weight: number;
    };
    images: {
      passed: boolean;
      count: number;
      hasAltText: boolean;
      weight: number;
    };
  };
  recommendations: {
    priority: "high" | "medium" | "low";
    message: string;
    section?: string;
  }[];
}
```

### 6. Meta Agent（SEO 元數據智能體）

**職責**：生成 SEO 友善的元數據

**輸入**：

- Writing Agent 的輸出
- Strategy Agent 的標題選項
- 關鍵字

**任務**：

1. 生成吸引人的 SEO 標題
2. 生成簡潔的 meta description
3. 生成 URL slug
4. 建議 Open Graph 標籤
5. 建議 Twitter Card 標籤

**輸出**：

```typescript
interface MetaOutput {
  title: string;
  description: string;
  slug: string;
  openGraph: {
    title: string;
    description: string;
    type: string;
  };
  twitterCard: {
    card: "summary_large_image";
    title: string;
    description: string;
  };
  canonicalUrl?: string;
  focusKeyphrase: string;
}
```

## Agent 協調流程

### Master Orchestrator（主協調器）

負責協調所有 Subagents 的執行順序和數據流

```typescript
class ArticleGenerationOrchestrator {
  async generateArticle(config: ArticleConfig): Promise<ArticleResult> {
    // Phase 1: Research
    const researchResult = await this.researchAgent.analyze({
      keyword: config.keyword,
      region: config.region,
      competitorCount: config.workflowSettings.competitor_count,
    });

    await this.updateJobStage("serp_analysis", researchResult);

    // Phase 2: Strategy
    const strategyResult = await this.strategyAgent.plan({
      researchData: researchResult,
      brandVoice: config.brandVoice,
      targetWordCount: config.workflowSettings.content_length_max,
    });

    await this.updateJobStage("content_plan", strategyResult);

    // Phase 3: Writing (parallel with Image generation)
    const [writingResult, imageResult] = await Promise.all([
      this.writingAgent.write({
        strategy: strategyResult,
        brandVoice: config.brandVoice,
        previousArticles: await this.getPreviousArticles(config.websiteId),
      }),
      this.imageAgent.generate({
        title: strategyResult.selectedTitle,
        outline: strategyResult.outline,
        count: 3,
      }),
    ]);

    await this.updateJobStage("content_generation", writingResult);
    await this.updateJobStage("image_generation", imageResult);

    // Phase 4: Meta Generation
    const metaResult = await this.metaAgent.generate({
      content: writingResult,
      keyword: config.keyword,
      titleOptions: strategyResult.titleOptions,
    });

    // Phase 5: Quality Check
    const qualityResult = await this.qualityAgent.check({
      content: writingResult,
      images: imageResult,
      meta: metaResult,
      thresholds: config.workflowSettings,
    });

    await this.updateJobStage("quality_check", qualityResult);

    // Phase 6: Publish (if passed)
    if (qualityResult.passed && config.workflowSettings.auto_publish) {
      const publishResult = await this.publishToWordPress({
        content: writingResult,
        meta: metaResult,
        images: imageResult,
        websiteConfig: config.website,
      });

      await this.updateJobStage("wordpress_publish", publishResult);
    }

    return {
      success: qualityResult.passed,
      qualityScore: qualityResult.score,
      article: writingResult,
      meta: metaResult,
      images: imageResult,
    };
  }
}
```

## 技術實現

### Agent 基礎類別

```typescript
abstract class BaseAgent {
  protected aiClient: AIClient;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.aiClient = new AIClient(config.model);
  }

  abstract async execute(input: any): Promise<any>;

  protected async callAI(prompt: string, options?: AIOptions): Promise<string> {
    return await this.aiClient.complete(prompt, options);
  }

  protected async logProgress(stage: string, data: any): Promise<void> {
    // 記錄 agent 執行進度
  }
}
```

### Agent 實現範例：Research Agent

```typescript
class ResearchAgent extends BaseAgent {
  async execute(input: ResearchInput): Promise<ResearchOutput> {
    this.logProgress("starting", { keyword: input.keyword });

    // 1. 執行 SERP 查詢
    const serpResults = await this.querySERP(input.keyword, input.region);

    // 2. 使用 AI 分析結果
    const analysisPrompt = this.buildAnalysisPrompt(serpResults, input);
    const analysis = await this.callAI(analysisPrompt, {
      temperature: 0.3,
      format: "json",
    });

    const result = JSON.parse(analysis);

    this.logProgress("completed", result);

    return result;
  }

  private async querySERP(keyword: string, region: string) {
    // 使用 SerpAPI 或 Perplexity
  }

  private buildAnalysisPrompt(serpResults: any, input: ResearchInput): string {
    return `
您是一位專業的 SEO 研究分析師。請分析以下 SERP 結果：

關鍵字：${input.keyword}
地區：${input.region}

前 ${input.competitorCount} 名結果：
${JSON.stringify(serpResults, null, 2)}

請以 JSON 格式提供完整分析，包括：
1. 搜尋意圖分類
2. 頂級網站特徵分析
3. 內容缺口識別
4. 競爭對手分析
5. 推薦策略

輸出格式請嚴格遵守 ResearchOutput 介面。
    `;
  }
}
```

## 資料庫支援

### Agent 執行記錄表

```sql
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'completed', 'failed')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,

    CONSTRAINT fk_article_job FOREIGN KEY (article_job_id)
        REFERENCES article_jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_executions_job_id ON agent_executions(article_job_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
```

## 優勢

### 1. 模組化

- 每個 Agent 職責明確
- 易於測試和維護
- 可獨立升級

### 2. 可擴展性

- 輕鬆添加新的 Agents
- 可以替換特定 Agent 的實現
- 支援不同的 AI 模型

### 3. 並行處理

- Writing Agent 和 Image Agent 可並行執行
- 提高整體效能

### 4. 錯誤隔離

- 單一 Agent 失敗不影響其他 Agents
- 可以重試特定 Agent

### 5. 靈活性

- 可以根據需求啟用/停用特定 Agents
- 支援自定義 Agent 配置

## 監控和日誌

### Agent Dashboard

顯示每個 Agent 的：

- 執行次數
- 成功率
- 平均執行時間
- 錯誤統計

### 執行時序圖

視覺化顯示整個流程的執行時間線：

```
Research Agent    ████████ (8s)
Strategy Agent           ████████ (9s)
Writing Agent                     ████████████████ (18s)
Image Agent                       ████████ (10s)
Meta Agent                                        ████ (4s)
Quality Agent                                         ████ (5s)
```

## 成本控制

### Token 使用追蹤

```typescript
interface TokenUsage {
  agentName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}
```

### 預算限制

- 為每個 Agent 設定 token 預算
- 超出預算時發出警告
- 自動降級到較便宜的模型

## 未來擴展

### 可能的新 Agents

1. **Translation Agent**：多語言內容生成
2. **Video Script Agent**：生成影片腳本
3. **Social Media Agent**：生成社交媒體貼文
4. **Email Agent**：生成電子報內容
5. **Analytics Agent**：分析文章表現並提供優化建議
