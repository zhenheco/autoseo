# Research Agent

## 概述

Research Agent 負責關鍵字研究和 SERP（搜尋引擎結果頁）分析，為後續的內容策略提供數據基礎。

## 職責

### 1. SERP 查詢

- 執行關鍵字搜尋
- 獲取前 N 名搜尋結果
- 抓取競爭對手網站資訊

### 2. 競爭分析

- 分析頂級網站特徵
- 識別內容主題和角度
- 找出內容缺口
- 分析搜尋意圖

### 3. 數據整理

- 整理競爭對手數據
- 生成分析報告
- 提供策略建議

## 輸入

```typescript
interface ResearchInput {
  keyword: string; // 主要關鍵字
  region?: string; // 目標地區（台灣、香港等）
  competitorCount: number; // 要分析的競爭對手數量（1-20）

  // AI 配置
  model: string; // perplexity-sonar, gpt-4, claude-3-opus
  temperature: number; // 0-1
  maxTokens: number; // 最大 token 數
}
```

## 輸出

```typescript
interface ResearchOutput {
  keyword: string;
  region?: string;

  // 搜尋意圖分類
  searchIntent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational";
  intentConfidence: number; // 0-1

  // 頂級網站特徵分析
  topRankingFeatures: {
    contentLength: {
      min: number;
      max: number;
      avg: number;
    };
    titlePatterns: string[]; // 常見標題模式
    structurePatterns: string[]; // 常見結構模式
    commonTopics: string[]; // 常見主題
    commonFormats: string[]; // 常見格式（列表、指南、比較等）
  };

  // 內容缺口
  contentGaps: string[]; // 競爭對手未涵蓋的角度

  // 競爭對手詳細分析
  competitorAnalysis: {
    url: string;
    title: string;
    position: number; // 排名位置
    domain: string;
    estimatedWordCount: number;
    strengths: string[]; // 優勢
    weaknesses: string[]; // 弱點
    uniqueAngles: string[]; // 獨特角度
  }[];

  // 推薦策略
  recommendedStrategy: string;

  // 相關關鍵字
  relatedKeywords: string[];

  // 執行資訊
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: {
      input: number;
      output: number;
    };
  };
}
```

## 核心邏輯

### 1. SERP 查詢

```typescript
class ResearchAgent extends BaseAgent {
  async execute(input: ResearchInput): Promise<ResearchOutput> {
    const startTime = Date.now();

    // 1. 執行 SERP 查詢
    const serpResults = await this.querySERP(
      input.keyword,
      input.region,
      input.competitorCount,
    );

    // 2. 使用 AI 分析結果
    const analysis = await this.analyzeWithAI(serpResults, input);

    // 3. 補充相關關鍵字
    const relatedKeywords = await this.getRelatedKeywords(input.keyword);

    return {
      ...analysis,
      relatedKeywords,
      executionInfo: {
        model: input.model,
        executionTime: Date.now() - startTime,
        tokenUsage: analysis.tokenUsage,
      },
    };
  }

  private async querySERP(
    keyword: string,
    region: string,
    count: number,
  ): Promise<SERPResult[]> {
    // 使用 SerpAPI 或 Perplexity
    const response = await this.serpClient.search({
      q: keyword,
      location: region,
      num: count,
      hl: this.getLanguageCode(region),
    });

    return response.organic_results.map((result, index) => ({
      position: index + 1,
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      domain: new URL(result.link).hostname,
    }));
  }
}
```

### 2. AI 分析

```typescript
private async analyzeWithAI(
  serpResults: SERPResult[],
  input: ResearchInput
): Promise<Partial<ResearchOutput>> {
  const prompt = this.buildAnalysisPrompt(serpResults, input);

  const response = await this.aiClient.complete(prompt, {
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    format: 'json',
  });

  return JSON.parse(response.content);
}

private buildAnalysisPrompt(
  serpResults: SERPResult[],
  input: ResearchInput
): string {
  return `
您是一位專業的 SEO 研究分析師。請分析以下關鍵字的搜尋引擎結果頁（SERP）。

**關鍵字**: ${input.keyword}
**目標地區**: ${input.region || '全球'}

**前 ${input.competitorCount} 名搜尋結果**:
${JSON.stringify(serpResults, null, 2)}

請提供以下分析（必須使用 JSON 格式）：

1. **搜尋意圖分類**
   - 判斷搜尋意圖類型（informational/commercial/transactional/navigational）
   - 提供信心分數（0-1）

2. **頂級網站特徵分析**
   - 內容長度統計（最小/最大/平均字數）
   - 常見標題模式（至少 3 個）
   - 常見結構模式（如：列表式、教學式、比較式）
   - 常見主題（至少 5 個）
   - 常見格式

3. **競爭對手詳細分析**
   對每個競爭對手提供：
   - 內容優勢（至少 2 個）
   - 內容弱點（至少 1 個）
   - 獨特角度（如果有）

4. **內容缺口識別**
   - 找出競爭對手未涵蓋的角度（至少 3 個）
   - 這些缺口應該是有價值且與關鍵字相關的

5. **推薦策略**
   - 基於以上分析，提供一個詳細的內容策略建議
   - 包括：建議的內容角度、長度、結構、獨特賣點

**重要**: 請嚴格遵守以下 JSON schema 輸出：

\`\`\`json
{
  "searchIntent": "informational" | "commercial" | "transactional" | "navigational",
  "intentConfidence": 0.0-1.0,
  "topRankingFeatures": {
    "contentLength": { "min": number, "max": number, "avg": number },
    "titlePatterns": string[],
    "structurePatterns": string[],
    "commonTopics": string[],
    "commonFormats": string[]
  },
  "contentGaps": string[],
  "competitorAnalysis": [
    {
      "url": string,
      "title": string,
      "position": number,
      "domain": string,
      "estimatedWordCount": number,
      "strengths": string[],
      "weaknesses": string[],
      "uniqueAngles": string[]
    }
  ],
  "recommendedStrategy": string
}
\`\`\`
`;
}
```

### 3. 相關關鍵字

```typescript
private async getRelatedKeywords(keyword: string): Promise<string[]> {
  // 使用 Google Suggest API 或其他關鍵字工具
  try {
    const suggestions = await this.keywordClient.getSuggestions(keyword);
    return suggestions.slice(0, 10); // 取前 10 個
  } catch (error) {
    console.error('獲取相關關鍵字失敗:', error);
    return [];
  }
}
```

## 支援的 AI 模型

### 推薦配置

| 模型                    | 優勢                   | 成本 | 推薦使用場景 |
| ----------------------- | ---------------------- | ---- | ------------ |
| **perplexity-sonar** ⭐ | 專為搜尋優化，實時數據 | 低   | 預設選擇     |
| gpt-4                   | 分析深度高             | 高   | 高品質內容   |
| gpt-4-turbo             | 平衡性能和成本         | 中   | 大量文章     |
| claude-3-sonnet         | 結構化分析強           | 中   | 複雜分析     |
| deepseek-chat           | 成本最低               | 極低 | 經濟型方案   |

### 模型特定提示詞優化

```typescript
private optimizePromptForModel(basePrompt: string, model: string): string {
  switch (model) {
    case 'perplexity-sonar':
      return `${basePrompt}\n\n請使用你的實時搜尋能力，提供最新的市場洞察。`;

    case 'claude-3-opus':
    case 'claude-3-sonnet':
      return `${basePrompt}\n\n請以結構化的方式分析，確保邏輯清晰。`;

    default:
      return basePrompt;
  }
}
```

## 錯誤處理

### 1. SERP API 錯誤

```typescript
private async querySERPWithRetry(
  keyword: string,
  region: string,
  count: number,
  maxRetries: number = 3
): Promise<SERPResult[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.querySERP(keyword, region, count);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      console.warn(`SERP 查詢失敗，重試 ${attempt}/${maxRetries}`, error);
      await this.delay(1000 * attempt);
    }
  }
}
```

### 2. AI 分析錯誤

```typescript
private async analyzeWithAIWithFallback(
  serpResults: SERPResult[],
  input: ResearchInput
): Promise<Partial<ResearchOutput>> {
  try {
    return await this.analyzeWithAI(serpResults, input);
  } catch (error) {
    console.error('AI 分析失敗，使用備用分析', error);

    // 提供基本分析作為備用
    return this.basicAnalysis(serpResults, input);
  }
}

private basicAnalysis(
  serpResults: SERPResult[],
  input: ResearchInput
): Partial<ResearchOutput> {
  return {
    searchIntent: 'informational',
    intentConfidence: 0.5,
    topRankingFeatures: {
      contentLength: { min: 1000, max: 3000, avg: 2000 },
      titlePatterns: serpResults.map(r => r.title),
      structurePatterns: ['文章形式'],
      commonTopics: [input.keyword],
      commonFormats: ['標準文章'],
    },
    contentGaps: ['需要更深入的分析'],
    competitorAnalysis: serpResults.map(r => ({
      url: r.url,
      title: r.title,
      position: r.position,
      domain: r.domain,
      estimatedWordCount: 2000,
      strengths: ['排名良好'],
      weaknesses: ['需要詳細分析'],
      uniqueAngles: [],
    })),
    recommendedStrategy: '建議撰寫 2000 字左右的深度文章',
  };
}
```

## 快取策略

### 1. SERP 結果快取

```typescript
private async getCachedSERPOrFetch(
  keyword: string,
  region: string,
  count: number
): Promise<SERPResult[]> {
  const cacheKey = `serp:${keyword}:${region}:${count}`;
  const cached = await this.cache.get(cacheKey);

  if (cached) {
    console.log('✅ 使用快取的 SERP 結果');
    return cached;
  }

  const results = await this.querySERP(keyword, region, count);
  await this.cache.set(cacheKey, results, 3600); // 快取 1 小時

  return results;
}
```

### 2. 分析結果快取

```typescript
private async getCachedAnalysisOrGenerate(
  serpResults: SERPResult[],
  input: ResearchInput
): Promise<Partial<ResearchOutput>> {
  const cacheKey = this.generateAnalysisCacheKey(serpResults, input);
  const cached = await this.cache.get(cacheKey);

  if (cached) {
    console.log('✅ 使用快取的分析結果');
    return cached;
  }

  const analysis = await this.analyzeWithAI(serpResults, input);
  await this.cache.set(cacheKey, analysis, 7200); // 快取 2 小時

  return analysis;
}
```

## 成本優化

### 1. Token 使用優化

```typescript
private optimizeSERPDataForPrompt(serpResults: SERPResult[]): string {
  // 只保留必要資訊，減少 token 使用
  const simplified = serpResults.map(r => ({
    pos: r.position,
    title: r.title,
    domain: r.domain,
    snippet: r.snippet.substring(0, 200), // 限制摘要長度
  }));

  return JSON.stringify(simplified);
}
```

### 2. 成本追蹤

```typescript
async execute(input: ResearchInput): Promise<ResearchOutput> {
  const result = await this.executeResearch(input);

  // 計算成本
  const cost = this.calculateCost(
    input.model,
    result.executionInfo.tokenUsage
  );

  // 記錄成本
  await this.trackCost({
    agent: 'research',
    model: input.model,
    tokens: result.executionInfo.tokenUsage,
    cost,
  });

  return result;
}
```

## 品質保證

### 1. 輸出驗證

```typescript
private validateOutput(output: ResearchOutput): void {
  const errors: string[] = [];

  if (!output.searchIntent) {
    errors.push('缺少搜尋意圖');
  }

  if (!output.competitorAnalysis || output.competitorAnalysis.length === 0) {
    errors.push('缺少競爭對手分析');
  }

  if (!output.contentGaps || output.contentGaps.length === 0) {
    errors.push('缺少內容缺口分析');
  }

  if (errors.length > 0) {
    throw new Error(`Research 輸出驗證失敗: ${errors.join(', ')}`);
  }
}
```

### 2. 品質評分

```typescript
private calculateQualityScore(output: ResearchOutput): number {
  let score = 0;

  // 搜尋意圖信心分數
  score += output.intentConfidence * 20;

  // 競爭對手分析數量
  score += Math.min(output.competitorAnalysis.length * 5, 30);

  // 內容缺口數量
  score += Math.min(output.contentGaps.length * 5, 20);

  // 相關關鍵字數量
  score += Math.min(output.relatedKeywords.length * 3, 30);

  return Math.min(score, 100);
}
```

## 監控和日誌

```typescript
private async logExecution(
  input: ResearchInput,
  output: ResearchOutput,
  error?: Error
): Promise<void> {
  await this.logger.log({
    agent: 'research',
    keyword: input.keyword,
    region: input.region,
    model: input.model,
    success: !error,
    executionTime: output?.executionInfo?.executionTime,
    tokenUsage: output?.executionInfo?.tokenUsage,
    qualityScore: output ? this.calculateQualityScore(output) : 0,
    error: error?.message,
  });
}
```

## 使用範例

```typescript
const researchAgent = new ResearchAgent({
  serpClient: new SerpAPIClient(process.env.SERPAPI_KEY),
  aiClient: new AIClient(),
  cache: new RedisCache(),
});

const result = await researchAgent.execute({
  keyword: "SEO 優化技巧",
  region: "台灣",
  competitorCount: 10,
  model: "perplexity-sonar",
  temperature: 0.3,
  maxTokens: 2000,
});

console.log("搜尋意圖:", result.searchIntent);
console.log("內容缺口:", result.contentGaps);
console.log("建議策略:", result.recommendedStrategy);
```

## 測試

```typescript
describe("ResearchAgent", () => {
  it("should analyze SERP results correctly", async () => {
    const agent = new ResearchAgent(mockConfig);

    const result = await agent.execute({
      keyword: "測試關鍵字",
      region: "台灣",
      competitorCount: 5,
      model: "perplexity-sonar",
      temperature: 0.3,
      maxTokens: 2000,
    });

    expect(result.searchIntent).toBeDefined();
    expect(result.competitorAnalysis).toHaveLength(5);
    expect(result.contentGaps.length).toBeGreaterThan(0);
  });

  it("should handle SERP API failures gracefully", async () => {
    const agent = new ResearchAgent(mockConfig);
    agent.serpClient.search = jest
      .fn()
      .mockRejectedValue(new Error("API Error"));

    await expect(agent.execute(mockInput)).rejects.toThrow();
  });
});
```
