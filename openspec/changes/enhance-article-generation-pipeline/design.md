# Design: enhance-article-generation-pipeline

## Architecture Overview

### 現有流程

```
ResearchAgent → StrategyAgent → CompetitorAnalysisAgent → WritingAgent/Multi-Agent → MetaAgent → HTMLAgent
```

### 新流程

```
ResearchAgent (enhanced) → StrategyAgent (enhanced) → CompetitorAnalysisAgent → ContentPlanAgent (NEW) → WritingAgents (enhanced) → MetaAgent → HTMLAgent
```

## Component Design

### 1. ResearchAgent Enhancement

#### 現有行為

- 使用 AI 分析關鍵字生成 SEO 洞察
- 使用 Perplexity **只獲取外部引用 URL**

#### 新增行為

- 使用 Perplexity 進行三種深度研究查詢：
  1. **趨勢查詢**：`{keyword} {region} 2024 2025 最新趨勢 專家見解`
  2. **問題查詢**：`{keyword} 常見問題 解決方案 FAQ 用戶體驗`
  3. **數據查詢**：`{keyword} {region} 官方來源 權威數據 統計資料`

#### 數據結構擴展

```typescript
interface DeepResearchResult {
  trends: {
    content: string; // Perplexity 回應內容
    citations: string[]; // 引用來源
  };
  userQuestions: {
    content: string;
    citations: string[];
  };
  authorityData: {
    content: string;
    citations: string[];
  };
}

interface ResearchOutput {
  // 現有欄位保持不變...

  // 新增
  deepResearch?: DeepResearchResult;
}
```

### 2. StrategyAgent Enhancement

#### 標題生成優化

**核心變更**：

1. **調整 temperature**：從 0.3 提高到 0.6，增加標題創意
2. **根據語系調整標題長度**：
   - 中文：20-35 字
   - 英文：50-60 characters

```typescript
private getTitleLengthRange(targetLang: string): { min: number; max: number } {
  if (targetLang.startsWith("zh")) {
    return { min: 20, max: 35 };
  }
  return { min: 50, max: 60 };
}
```

#### 標題評分（純 SEO 導向，不考慮品牌聲音）

**注意**：品牌聲音只影響內文生成，不影響標題選擇

```typescript
private scoreTitleSEO(title: string, input: StrategyInput): number {
  let score = 0;

  // SEO 評分 (100分)
  score += this.scoreKeywordMatch(title, input);      // 35分
  score += this.scoreLength(title, input);            // 25分
  score += this.scorePowerWords(title);               // 20分
  score += this.scoreNumbers(title);                  // 20分

  return Math.min(score, 100);
}
```

### 3. ContentPlanAgent (NEW)

#### 職責

- 整合 ResearchOutput、StrategyOutput、CompetitorAnalysisOutput、BrandVoice
- 產生詳細的寫作計劃 JSON

#### 輸入輸出

```typescript
interface ContentPlanInput {
  strategy: StrategyOutput;
  research: ResearchOutput;
  competitorAnalysis?: CompetitorAnalysisOutput;
  brandVoice: BrandVoice;
  targetLanguage: string;
  targetRegion?: string;
  targetIndustry?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface ContentPlanOutput {
  optimizedTitle: {
    primary: string;
    alternatives: string[];
    reasoning: string;
  };

  contentStrategy: {
    primaryAngle: string;
    userPainPoints: string[];
    valueProposition: string;
    differentiationPoints: string[];
    toneGuidance: string;
  };

  detailedOutline: {
    introduction: SectionPlan;
    mainSections: SectionPlan[];
    faq: FAQPlan;
    conclusion: SectionPlan;
  };

  seoOptimization: SEOPlan;
  localization: LocalizationPlan;
  researchInsights: ResearchInsightsPlan;

  executionInfo: ExecutionInfo;
}
```

#### 特殊區塊設計

```typescript
interface SpecialBlock {
  type: "expert_tip" | "local_advantage" | "expert_warning";
  content: string;
}

// 使用條件
// - expert_tip: 教學類、技巧類文章
// - local_advantage: 地區性、服務類文章
// - expert_warning: 安全、風險相關文章
```

### 4. ContentContext 傳遞機制

#### 數據結構

```typescript
interface ContentContext {
  primaryKeyword: string; // 原始關鍵字
  selectedTitle: string; // 選定標題
  searchIntent: string; // 搜尋意圖
  targetAudience: string; // 目標讀者
  topicKeywords: string[]; // 主題關鍵字
  regionContext?: string; // 地區上下文
  industryContext?: string; // 行業上下文
  brandName?: string; // 品牌名稱
  toneGuidance?: string; // 語調指導
}
```

#### 傳遞流程

```
Orchestrator
  ↓ 構建 ContentContext
ContentPlanAgent
  ↓ 生成 ContentPlanOutput
  ↓ 更新 ContentContext.toneGuidance
Orchestrator
  ↓ 傳遞 ContentContext 給所有寫作 Agent
IntroductionAgent / SectionAgent / ConclusionAgent / QAAgent
  ↓ 在 prompt 中使用 ContentContext 確保主題一致
```

### 5. 寫作 Agent Prompt 增強

#### 主題對齊約束（加入所有寫作 Agent）

```
## CRITICAL: Topic Alignment Requirement
- Article Title: "{selectedTitle}"
- PRIMARY KEYWORD: "{primaryKeyword}"
- You MUST ensure all content is directly relevant to this topic
- Do NOT include unrelated content

## Topic Context
- Search Intent: {searchIntent}
- Target Audience: {targetAudience}
- Related Keywords: {topicKeywords}
- Tone: {toneGuidance}
```

## Data Flow Diagram

```
┌─────────────────┐
│   User Input    │
│   (keyword)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  ResearchAgent  │────▶│  Perplexity     │
│  (enhanced)     │◀────│  (3 queries)    │
└────────┬────────┘     └─────────────────┘
         │
         ▼ ResearchOutput + DeepResearch
┌─────────────────┐
│ StrategyAgent   │
│ (enhanced)      │
│ - Higher temp   │
│ - Lang length   │
└────────┬────────┘
         │
         ▼ StrategyOutput
┌─────────────────┐
│ CompetitorAgent │
└────────┬────────┘
         │
         ▼ CompetitorAnalysisOutput
┌─────────────────┐
│ContentPlanAgent │ ◀── NEW
│ - Detailed plan │
│ - Special blocks│
└────────┬────────┘
         │
         ▼ ContentPlanOutput + ContentContext
┌─────────────────────────────────────────┐
│           Writing Agents                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Intro   │ │ Section │ │ Concl.  │   │
│  │ Agent   │ │ Agent   │ │ Agent   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│         All receive ContentContext       │
└────────────────────┬────────────────────┘
                     │
                     ▼
              Final Article
```

## Error Handling

### Perplexity 查詢失敗

```typescript
private async performDeepResearch(title: string, region: string): Promise<DeepResearchResult | null> {
  try {
    // 三個查詢
  } catch (error) {
    console.warn("[ResearchAgent] Deep research failed, continuing without it");
    return null; // 返回 null，不中斷流程
  }
}
```

### ContentPlanAgent 失敗

```typescript
// Orchestrator 中的 fallback
try {
  contentPlan = await contentPlanAgent.execute(input);
} catch (error) {
  console.warn(
    "[Orchestrator] ContentPlanAgent failed, using strategy output directly",
  );
  contentPlan = this.buildFallbackContentPlan(strategyOutput, researchOutput);
}
```

## Performance Considerations

### Perplexity 查詢優化

1. **快取機制**：相同關鍵字 24 小時內不重複查詢
2. **並行查詢**：三個 Perplexity 查詢使用 Promise.all 並行執行

```typescript
const [trendsResult, questionsResult, dataResult] = await Promise.all([
  perplexity.search(trendsQuery, options),
  perplexity.search(questionsQuery, options),
  perplexity.search(dataQuery, options),
]);
```

### ContentPlanAgent 優化

- 使用較快的模型（如 gpt-4o-mini）
- 限制 maxTokens 為 8000
- Temperature 設為 0.5 平衡創意與一致性

## Backward Compatibility

### 向後兼容策略

1. `ResearchOutput.deepResearch` 設為可選欄位
2. `ContentContext` 透過 optional chaining 傳遞
3. 保留原有 `WritingAgent` 作為 legacy 路徑

```typescript
// 在 Orchestrator 中
if (useMultiAgent) {
  // 新流程：使用 ContentPlanAgent + Multi-Agent
  const contentPlan = await contentPlanAgent.execute(...);
  await this.executeMultiAgentWriting(contentPlan, contentContext, ...);
} else {
  // Legacy 路徑：直接使用 WritingAgent
  await this.executeWritingAgent(strategyOutput, ...);
}
```
