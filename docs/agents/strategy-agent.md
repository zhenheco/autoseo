# Strategy Agent

## 概述
Strategy Agent 負責基於 Research Agent 的分析結果，制定詳細的內容策略和文章大綱。

## 職責

### 1. 內容策略規劃
- 基於 SERP 分析制定內容方向
- 確定內容角度和差異化策略
- 設定目標字數和結構

### 2. 標題生成
- 生成多個標題選項
- 優化 SEO 和點擊率
- 符合品牌聲音

### 3. 大綱制定
- 制定詳細的文章結構
- 規劃章節和小節
- 設定每個章節的要點

### 4. 關鍵字策略
- 設定關鍵字密度目標
- 建議相關關鍵字
- 規劃關鍵字分佈

## 輸入

```typescript
interface StrategyInput {
  // Research Agent 的輸出
  researchData: ResearchOutput;

  // 品牌聲音設定
  brandVoice: {
    tone_of_voice: string;
    target_audience: string;
    keywords: string[];
    sentence_style?: string;
    interactivity?: string;
  };

  // 內容需求
  targetWordCount: number;       // 目標字數

  // AI 配置
  model: string;                 // gpt-4, claude-3-opus
  temperature: number;           // 0-1
  maxTokens: number;
}
```

## 輸出

```typescript
interface StrategyOutput {
  // 標題選項
  titleOptions: string[];        // 3-5 個標題選項
  selectedTitle: string;         // 推薦的標題

  // 文章大綱
  outline: {
    introduction: {
      hook: string;              // 引人入勝的開場
      context: string;           // 背景說明
      thesis: string;            // 主要論點
      wordCount: number;         // 建議字數
    };

    mainSections: {
      heading: string;           // 章節標題（H2）
      subheadings: string[];     // 小節標題（H3）
      keyPoints: string[];       // 要點列表
      targetWordCount: number;   // 目標字數
      keywords: string[];        // 該章節的關鍵字
    }[];

    conclusion: {
      summary: string;           // 總結要點
      callToAction: string;      // 行動呼籲
      wordCount: number;
    };

    faq: {
      question: string;
      answerOutline: string;     // 答案大綱
    }[];
  };

  // 字數規劃
  targetWordCount: number;
  sectionWordDistribution: {
    introduction: number;
    mainSections: number;
    conclusion: number;
    faq: number;
  };

  // 關鍵字策略
  keywordDensityTarget: number;  // 目標密度（%）
  relatedKeywords: string[];     // 相關關鍵字
  lsiKeywords: string[];         // LSI 關鍵字

  // 內部連結策略
  internalLinkingStrategy: {
    targetSections: string[];    // 應該加入內部連結的章節
    suggestedTopics: string[];   // 建議連結的主題
    minLinks: number;            // 最少連結數
  };

  // 差異化策略
  differentiationStrategy: {
    uniqueAngles: string[];      // 獨特角度
    valueProposition: string;    // 價值主張
    competitiveAdvantages: string[]; // 競爭優勢
  };

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

### 1. 主執行流程

```typescript
class StrategyAgent extends BaseAgent {
  async execute(input: StrategyInput): Promise<StrategyOutput> {
    const startTime = Date.now();

    // 1. 生成內容策略
    const strategy = await this.generateStrategy(input);

    // 2. 驗證輸出品質
    this.validateOutput(strategy);

    return {
      ...strategy,
      executionInfo: {
        model: input.model,
        executionTime: Date.now() - startTime,
        tokenUsage: strategy.tokenUsage,
      },
    };
  }

  private async generateStrategy(
    input: StrategyInput
  ): Promise<Partial<StrategyOutput>> {
    const prompt = this.buildStrategyPrompt(input);

    const response = await this.aiClient.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
    });

    return JSON.parse(response.content);
  }
}
```

### 2. 提示詞建構

```typescript
private buildStrategyPrompt(input: StrategyInput): string {
  const { researchData, brandVoice, targetWordCount } = input;

  return `
您是一位專業的 SEO 內容策略規劃師。請基於以下資訊，制定詳細的內容策略和文章大綱。

## 關鍵字資訊

**主要關鍵字**: ${researchData.keyword}
**搜尋意圖**: ${researchData.searchIntent}
**目標地區**: ${researchData.region || '全球'}

## SERP 分析結果

**頂級網站特徵**:
${JSON.stringify(researchData.topRankingFeatures, null, 2)}

**競爭對手分析**:
${JSON.stringify(researchData.competitorAnalysis.slice(0, 5), null, 2)}

**內容缺口**:
${researchData.contentGaps.join('\n- ')}

**推薦策略**:
${researchData.recommendedStrategy}

## 品牌聲音設定

- **語調**: ${brandVoice.tone_of_voice}
- **目標受眾**: ${brandVoice.target_audience}
- **品牌詞彙**: ${brandVoice.keywords.join(', ')}
${brandVoice.sentence_style ? `- **句式風格**: ${brandVoice.sentence_style}` : ''}
${brandVoice.interactivity ? `- **互動性**: ${brandVoice.interactivity}` : ''}

## 內容需求

- **目標字數**: ${targetWordCount} 字
- **建議字數分配**:
  - 引言: 10%
  - 主要內容: 75%
  - 結論: 10%
  - FAQ: 5%

## 任務要求

請制定一個詳細的內容策略，包括：

### 1. 標題選項（3-5 個）
- 必須包含主要關鍵字
- 吸引點擊且符合搜尋意圖
- 長度控制在 50-60 字元
- 符合品牌語調
- 提供推薦的最佳標題

### 2. 文章大綱

#### 引言部分
- **Hook**: 引人入勝的開場（問句、統計數據、故事等）
- **Context**: 簡要背景說明
- **Thesis**: 文章主要論點或價值主張
- **建議字數**: 約 ${Math.round(targetWordCount * 0.1)} 字

#### 主要章節（4-6 個 H2）
每個章節包含：
- **章節標題**: 清晰、可搜尋的 H2 標題
- **小節標題**: 2-4 個 H3 小節
- **關鍵要點**: 每個小節的 3-5 個要點
- **目標字數**: 平均分配主要內容字數
- **關鍵字**: 該章節應該包含的關鍵字

章節應該涵蓋：
- 競爭對手已涵蓋的重要主題
- 內容缺口中的獨特角度
- 符合搜尋意圖的核心資訊

#### 結論部分
- **Summary**: 總結要點
- **Call to Action**: 明確的行動呼籲
- **建議字數**: 約 ${Math.round(targetWordCount * 0.1)} 字

#### FAQ 區塊（3-5 個問答）
- 與關鍵字相關的常見問題
- 每個答案的大綱要點

### 3. 關鍵字策略
- **目標關鍵字密度**: 1.5-2.5%
- **相關關鍵字**: 至少 10 個
- **LSI 關鍵字**: 至少 5 個

### 4. 內部連結策略
- 建議加入內部連結的章節
- 建議連結的主題（至少 5 個）
- 最少連結數: 3-5 個

### 5. 差異化策略
- **獨特角度**: 至少 3 個與競爭對手不同的角度
- **價值主張**: 本文的核心價值
- **競爭優勢**: 相比競爭對手的優勢

## 輸出格式

請嚴格遵守以下 JSON schema：

\`\`\`json
{
  "titleOptions": string[],
  "selectedTitle": string,
  "outline": {
    "introduction": {
      "hook": string,
      "context": string,
      "thesis": string,
      "wordCount": number
    },
    "mainSections": [
      {
        "heading": string,
        "subheadings": string[],
        "keyPoints": string[],
        "targetWordCount": number,
        "keywords": string[]
      }
    ],
    "conclusion": {
      "summary": string,
      "callToAction": string,
      "wordCount": number
    },
    "faq": [
      {
        "question": string,
        "answerOutline": string
      }
    ]
  },
  "targetWordCount": number,
  "sectionWordDistribution": {
    "introduction": number,
    "mainSections": number,
    "conclusion": number,
    "faq": number
  },
  "keywordDensityTarget": number,
  "relatedKeywords": string[],
  "lsiKeywords": string[],
  "internalLinkingStrategy": {
    "targetSections": string[],
    "suggestedTopics": string[],
    "minLinks": number
  },
  "differentiationStrategy": {
    "uniqueAngles": string[],
    "valueProposition": string,
    "competitiveAdvantages": string[]
  }
}
\`\`\`

**重要提示**:
1. 所有文字必須使用${brandVoice.tone_of_voice}的語調
2. 內容必須針對${brandVoice.target_audience}
3. 確保涵蓋內容缺口中的獨特角度
4. 大綱要具體、可執行，不要過於籠統
`;
}
```

### 3. 輸出驗證

```typescript
private validateOutput(output: StrategyOutput): void {
  const errors: string[] = [];

  // 驗證標題
  if (!output.titleOptions || output.titleOptions.length < 3) {
    errors.push('標題選項不足（至少需要 3 個）');
  }

  if (!output.selectedTitle) {
    errors.push('缺少推薦標題');
  }

  // 驗證大綱
  if (!output.outline.mainSections || output.outline.mainSections.length < 4) {
    errors.push('主要章節不足（至少需要 4 個）');
  }

  // 驗證 FAQ
  if (!output.outline.faq || output.outline.faq.length < 3) {
    errors.push('FAQ 問題不足（至少需要 3 個）');
  }

  // 驗證關鍵字策略
  if (!output.relatedKeywords || output.relatedKeywords.length < 10) {
    errors.push('相關關鍵字不足（至少需要 10 個）');
  }

  // 驗證字數分配
  const totalWords = Object.values(output.sectionWordDistribution)
    .reduce((sum, count) => sum + count, 0);

  if (Math.abs(totalWords - output.targetWordCount) > 100) {
    errors.push(`字數分配不正確（總計: ${totalWords}, 目標: ${output.targetWordCount}）`);
  }

  if (errors.length > 0) {
    throw new Error(`Strategy 輸出驗證失敗:\n${errors.join('\n')}`);
  }
}
```

## 支援的 AI 模型

### 推薦配置

| 模型 | 優勢 | 成本 | 推薦使用場景 |
|------|------|------|------------|
| **gpt-4** ⭐ | 策略規劃能力強 | 高 | 預設選擇 |
| gpt-4-turbo | 速度快，品質好 | 中 | 大量文章 |
| claude-3-opus | 結構化能力強 | 高 | 複雜主題 |
| claude-3-sonnet | 平衡性能和成本 | 中 | 一般主題 |
| gpt-3.5-turbo | 基本策略規劃 | 低 | 經濟型方案 |

## 品質優化

### 1. 標題優化

```typescript
private optimizeTitles(
  titles: string[],
  keyword: string,
  brandVoice: BrandVoice
): string[] {
  return titles.map(title => {
    // 確保包含關鍵字
    if (!title.includes(keyword)) {
      title = `${keyword}：${title}`;
    }

    // 長度檢查
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    return title;
  });
}
```

### 2. 大綱品質檢查

```typescript
private checkOutlineQuality(outline: Outline): QualityReport {
  const issues: string[] = [];
  let score = 100;

  // 檢查主要章節數量
  if (outline.mainSections.length < 4) {
    issues.push('主要章節過少');
    score -= 20;
  }

  // 檢查每個章節的小節
  outline.mainSections.forEach((section, index) => {
    if (section.subheadings.length < 2) {
      issues.push(`章節 ${index + 1} 的小節過少`);
      score -= 10;
    }

    if (section.keyPoints.length < 3) {
      issues.push(`章節 ${index + 1} 的要點過少`);
      score -= 5;
    }
  });

  // 檢查 FAQ
  if (outline.faq.length < 3) {
    issues.push('FAQ 問題過少');
    score -= 10;
  }

  return { score, issues };
}
```

### 3. 關鍵字密度計算

```typescript
private calculateOptimalKeywordDensity(
  keyword: string,
  targetWordCount: number
): number {
  // 基於字數計算最佳密度
  if (targetWordCount < 1000) {
    return 2.0; // 較短文章可以有較高密度
  } else if (targetWordCount < 2000) {
    return 1.8;
  } else {
    return 1.5; // 較長文章降低密度避免過度優化
  }
}
```

## 錯誤處理

### 1. JSON 解析錯誤

```typescript
private async generateStrategyWithRetry(
  input: StrategyInput,
  maxRetries: number = 3
): Promise<Partial<StrategyOutput>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.aiClient.complete(
        this.buildStrategyPrompt(input),
        { model: input.model, temperature: input.temperature, format: 'json' }
      );

      return JSON.parse(response.content);

    } catch (error) {
      if (error instanceof SyntaxError && attempt < maxRetries) {
        console.warn(`JSON 解析失敗，重試 ${attempt}/${maxRetries}`);

        // 調整 temperature 降低隨機性
        input.temperature = Math.max(0.3, input.temperature - 0.2);
        continue;
      }

      throw error;
    }
  }
}
```

### 2. 品質不足處理

```typescript
private async ensureQuality(
  output: StrategyOutput,
  input: StrategyInput
): Promise<StrategyOutput> {
  const qualityReport = this.checkOutlineQuality(output.outline);

  if (qualityReport.score < 70) {
    console.warn('策略品質不足，重新生成', qualityReport.issues);

    // 在提示詞中加入問題反饋
    const enhancedInput = {
      ...input,
      previousIssues: qualityReport.issues,
    };

    return this.generateStrategy(enhancedInput);
  }

  return output;
}
```

## 使用範例

```typescript
const strategyAgent = new StrategyAgent({
  aiClient: new AIClient(),
});

const result = await strategyAgent.execute({
  researchData: researchOutput,
  brandVoice: {
    tone_of_voice: '專業且親切',
    target_audience: '中小企業主',
    keywords: ['SEO', '搜尋引擎優化'],
    sentence_style: '短句為主',
    interactivity: '適度加入問句',
  },
  targetWordCount: 2000,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 3000,
});

console.log('推薦標題:', result.selectedTitle);
console.log('主要章節:', result.outline.mainSections.map(s => s.heading));
console.log('差異化角度:', result.differentiationStrategy.uniqueAngles);
```

## 測試

```typescript
describe('StrategyAgent', () => {
  it('should generate comprehensive strategy', async () => {
    const agent = new StrategyAgent(mockConfig);

    const result = await agent.execute({
      researchData: mockResearchData,
      brandVoice: mockBrandVoice,
      targetWordCount: 2000,
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 3000,
    });

    expect(result.titleOptions.length).toBeGreaterThanOrEqual(3);
    expect(result.outline.mainSections.length).toBeGreaterThanOrEqual(4);
    expect(result.outline.faq.length).toBeGreaterThanOrEqual(3);
  });

  it('should validate output quality', () => {
    const agent = new StrategyAgent(mockConfig);

    const invalidOutput = {
      titleOptions: ['標題 1'], // 不足 3 個
      outline: { mainSections: [] }, // 沒有章節
    };

    expect(() => agent.validateOutput(invalidOutput)).toThrow();
  });
});
```
