# Writing Agent

## 概述
Writing Agent 負責根據 Strategy Agent 的大綱撰寫完整的 SEO 優化文章。

## 職責

### 1. 內容撰寫
- 根據大綱撰寫完整文章
- 確保內容流暢自然
- 保持品牌聲音一致性

### 2. SEO 優化
- 自然融入關鍵字
- 優化標題和小標題
- 確保適當的關鍵字密度

### 3. 內部連結
- 識別內部連結機會
- 自然插入相關文章連結
- 優化錨文本

### 4. 格式優化
- 使用適當的 Markdown 格式
- 生成結構化 HTML
- 確保可讀性

## 輸入

```typescript
interface WritingInput {
  // Strategy Agent 的輸出
  strategy: StrategyOutput;

  // 品牌聲音
  brandVoice: BrandVoice;

  // 舊文章列表（用於內部連結）
  previousArticles: {
    id: string;
    title: string;
    url: string;
    keywords: string[];
    excerpt: string;
  }[];

  // AI 配置
  model: string;                 // gpt-4, claude-3-opus, deepseek-chat
  temperature: number;
  maxTokens: number;
}
```

## 輸出

```typescript
interface WritingOutput {
  // 內容
  markdown: string;              // Markdown 格式
  html: string;                  // HTML 格式

  // 統計資訊
  statistics: {
    wordCount: number;
    paragraphCount: number;
    sentenceCount: number;
    readingTime: number;         // 分鐘
    averageSentenceLength: number;
  };

  // 內部連結
  internalLinks: {
    anchor: string;              // 錨文本
    url: string;                 // 連結 URL
    section: string;             // 所在章節
    articleId: string;           // 文章 ID
  }[];

  // 關鍵字使用
  keywordUsage: {
    count: number;               // 出現次數
    density: number;             // 密度（%）
    distribution: {
      section: string;
      count: number;
    }[];
  };

  // 可讀性分析
  readability: {
    fleschKincaidGrade: number;
    fleschReadingEase: number;
    gunningFogIndex: number;
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
class WritingAgent extends BaseAgent {
  async execute(input: WritingInput): Promise<WritingOutput> {
    const startTime = Date.now();

    // 1. 生成完整文章
    const article = await this.writeArticle(input);

    // 2. 插入內部連結
    const articleWithLinks = await this.insertInternalLinks(
      article,
      input.previousArticles,
      input.strategy
    );

    // 3. 轉換格式
    const markdown = articleWithLinks;
    const html = this.markdownToHtml(markdown);

    // 4. 分析統計
    const statistics = this.analyzeText(markdown);
    const keywordUsage = this.analyzeKeywordUsage(
      markdown,
      input.strategy.outline
    );
    const readability = this.analyzeReadability(markdown);

    return {
      markdown,
      html,
      statistics,
      internalLinks: this.extractedLinks,
      keywordUsage,
      readability,
      executionInfo: {
        model: input.model,
        executionTime: Date.now() - startTime,
        tokenUsage: article.tokenUsage,
      },
    };
  }
}
```

### 2. 文章撰寫

```typescript
private async writeArticle(input: WritingInput): Promise<ArticleDraft> {
  const prompt = this.buildWritingPrompt(input);

  const response = await this.aiClient.complete(prompt, {
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });

  return {
    content: response.content,
    tokenUsage: response.usage,
  };
}

private buildWritingPrompt(input: WritingInput): string {
  const { strategy, brandVoice } = input;

  return `
您是一位專業的 SEO 內容撰寫師。請根據以下大綱撰寫一篇完整的文章。

## 文章資訊

**標題**: ${strategy.selectedTitle}
**目標字數**: ${strategy.targetWordCount} 字
**關鍵字密度目標**: ${strategy.keywordDensityTarget}%

## 品牌聲音

- **語調**: ${brandVoice.tone_of_voice}
- **目標受眾**: ${brandVoice.target_audience}
- **品牌詞彙**: ${brandVoice.keywords.join(', ')}
${brandVoice.sentence_style ? `- **句式風格**: ${brandVoice.sentence_style}` : ''}
${brandVoice.interactivity ? `- **互動性**: ${brandVoice.interactivity}` : ''}

## 文章大綱

### 引言（${strategy.outline.introduction.wordCount} 字）
- **Hook**: ${strategy.outline.introduction.hook}
- **Context**: ${strategy.outline.introduction.context}
- **Thesis**: ${strategy.outline.introduction.thesis}

### 主要章節

${strategy.outline.mainSections.map((section, index) => `
#### ${index + 1}. ${section.heading}（${section.targetWordCount} 字）

**小節**:
${section.subheadings.map((sub, i) => `${i + 1}. ${sub}`).join('\n')}

**關鍵要點**:
${section.keyPoints.map(point => `- ${point}`).join('\n')}

**關鍵字**: ${section.keywords.join(', ')}
`).join('\n')}

### 結論（${strategy.outline.conclusion.wordCount} 字）
- **Summary**: ${strategy.outline.conclusion.summary}
- **Call to Action**: ${strategy.outline.conclusion.callToAction}

### FAQ 區塊

${strategy.outline.faq.map((faq, index) => `
**Q${index + 1}**: ${faq.question}
**A${index + 1}**: ${faq.answerOutline}
`).join('\n')}

## 撰寫要求

### 內容品質
1. **原創性**: 所有內容必須原創，不得抄襲
2. **深度**: 提供實用、深入的資訊
3. **準確性**: 確保資訊準確可靠
4. **價值**: 為讀者提供真實價值

### SEO 優化
1. **關鍵字密度**: 保持 ${strategy.keywordDensityTarget}% 的關鍵字密度
2. **自然融入**: 關鍵字必須自然融入，不要堆砌
3. **標題優化**: 使用 H2、H3 結構化標題
4. **語義相關**: 使用相關關鍵字和 LSI 關鍵字

### 格式要求
1. **Markdown 格式**: 使用標準 Markdown 語法
2. **段落長度**: 每段 3-5 句話
3. **列表**: 適當使用項目符號和編號列表
4. **強調**: 使用**粗體**強調重點
5. **引用**: 使用 > 引用重要資訊

### 品牌聲音
1. 始終保持 ${brandVoice.tone_of_voice} 的語調
2. 針對 ${brandVoice.target_audience} 撰寫
3. 使用品牌詞彙: ${brandVoice.keywords.join(', ')}
${brandVoice.sentence_style ? `4. ${brandVoice.sentence_style}` : ''}
${brandVoice.interactivity ? `5. ${brandVoice.interactivity}` : ''}

### 內部連結佔位符
在適當的位置插入 \`[INTERNAL_LINK]\` 作為佔位符，稍後會替換為實際連結。
建議在以下位置插入:
${strategy.internalLinkingStrategy.targetSections.map(s => `- ${s} 章節`).join('\n')}

## 輸出格式

請直接輸出 Markdown 格式的完整文章，包括：
1. 引言
2. 所有主要章節和小節
3. 結論
4. FAQ 區塊

**重要**:
- 不要包含任何前言或後語
- 不要使用程式碼區塊包裹內容
- 直接輸出 Markdown 文章內容
- 確保字數符合各章節的目標字數
`;
}
```

### 3. 內部連結插入

```typescript
private async insertInternalLinks(
  article: string,
  previousArticles: Article[],
  strategy: StrategyOutput
): Promise<string> {
  const placeholders = article.match(/\[INTERNAL_LINK\]/g) || [];
  let modifiedArticle = article;
  this.extractedLinks = [];

  // 找出最相關的文章
  const relevantArticles = this.findRelevantArticles(
    previousArticles,
    strategy,
    placeholders.length
  );

  // 替換每個佔位符
  for (let i = 0; i < Math.min(placeholders.length, relevantArticles.length); i++) {
    const articleToLink = relevantArticles[i];
    const anchor = this.generateAnchorText(articleToLink, strategy);
    const link = `[${anchor}](${articleToLink.url})`;

    // 替換第一個佔位符
    modifiedArticle = modifiedArticle.replace('[INTERNAL_LINK]', link);

    // 記錄連結
    this.extractedLinks.push({
      anchor,
      url: articleToLink.url,
      section: this.findSection(modifiedArticle, link),
      articleId: articleToLink.id,
    });
  }

  // 移除剩餘的佔位符
  modifiedArticle = modifiedArticle.replace(/\[INTERNAL_LINK\]/g, '');

  return modifiedArticle;
}

private findRelevantArticles(
  articles: Article[],
  strategy: StrategyOutput,
  count: number
): Article[] {
  // 計算每篇文章的相關性分數
  const scoredArticles = articles.map(article => ({
    article,
    score: this.calculateRelevanceScore(article, strategy),
  }));

  // 按分數排序並取前 N 篇
  return scoredArticles
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(item => item.article);
}

private calculateRelevanceScore(
  article: Article,
  strategy: StrategyOutput
): number {
  let score = 0;

  // 關鍵字重疊
  const keywordOverlap = strategy.relatedKeywords.filter(keyword =>
    article.keywords.some(k => k.includes(keyword))
  ).length;
  score += keywordOverlap * 10;

  // 主題相關性
  const topicMatch = strategy.internalLinkingStrategy.suggestedTopics.some(
    topic => article.title.includes(topic) || article.excerpt.includes(topic)
  );
  if (topicMatch) score += 20;

  return score;
}

private generateAnchorText(article: Article, strategy: StrategyOutput): string {
  // 優先使用文章關鍵字
  const relevantKeyword = strategy.relatedKeywords.find(keyword =>
    article.keywords.some(k => k.includes(keyword))
  );

  if (relevantKeyword) {
    return relevantKeyword;
  }

  // 備用：使用文章標題的簡化版本
  return article.title.split('：')[0].substring(0, 30);
}
```

### 4. 格式轉換

```typescript
private markdownToHtml(markdown: string): string {
  const marked = require('marked');

  // 配置 marked 選項
  marked.setOptions({
    gfm: true,                    // GitHub Flavored Markdown
    breaks: true,                 // 單換行轉 <br>
    headerIds: true,              // 為標題生成 ID
    mangle: false,                // 不混淆 email
  });

  let html = marked.parse(markdown);

  // 後處理優化
  html = this.optimizeHtml(html);

  return html;
}

private optimizeHtml(html: string): string {
  // 為外部連結添加 rel 屬性
  html = html.replace(
    /<a href="http/g,
    '<a rel="noopener noreferrer" target="_blank" href="http'
  );

  // 為圖片添加 lazy loading
  html = html.replace(/<img /g, '<img loading="lazy" ');

  // 添加 table wrapper（響應式）
  html = html.replace(
    /<table>/g,
    '<div class="table-wrapper"><table>'
  );
  html = html.replace(
    /<\/table>/g,
    '</table></div>'
  );

  return html;
}
```

### 5. 文本分析

```typescript
private analyzeText(markdown: string): TextStatistics {
  // 移除 Markdown 語法
  const plainText = markdown
    .replace(/[#*`_\[\]]/g, '')
    .replace(/\n+/g, '\n');

  // 計算統計
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  const paragraphs = plainText.split(/\n\n+/).filter(p => p.trim().length > 0);
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  return {
    wordCount,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    readingTime: Math.ceil(wordCount / 200), // 假設閱讀速度 200 字/分鐘
    averageSentenceLength: wordCount / sentences.length,
  };
}

private analyzeKeywordUsage(markdown: string, outline: Outline): KeywordUsage {
  const keyword = outline.mainSections[0]?.keywords[0] || '';
  const plainText = markdown.toLowerCase();

  // 計算關鍵字出現次數
  const count = (plainText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;

  // 計算密度
  const wordCount = plainText.split(/\s+/).length;
  const density = (count / wordCount) * 100;

  // 分析分佈
  const distribution = this.analyzeKeywordDistribution(markdown, keyword, outline);

  return { count, density, distribution };
}

private analyzeKeywordDistribution(
  markdown: string,
  keyword: string,
  outline: Outline
): KeywordDistribution[] {
  const sections = markdown.split(/^##\s+/m);
  const distribution: KeywordDistribution[] = [];

  sections.forEach((section, index) => {
    if (index === 0) return; // 跳過前言

    const sectionText = section.toLowerCase();
    const count = (sectionText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    const sectionName = section.split('\n')[0].trim();

    distribution.push({
      section: sectionName,
      count,
    });
  });

  return distribution;
}

private analyzeReadability(markdown: string): ReadabilityMetrics {
  const textstat = require('text-readability');
  const plainText = markdown.replace(/[#*`_\[\]]/g, '');

  return {
    fleschKincaidGrade: textstat.fleschKincaidGrade(plainText),
    fleschReadingEase: textstat.fleschReadingEase(plainText),
    gunningFogIndex: textstat.gunningFog(plainText),
  };
}
```

## 支援的 AI 模型

| 模型 | 優勢 | 成本 | 推薦使用場景 |
|------|------|------|------------|
| **gpt-4** ⭐ | 品質最高，流暢度佳 | 高 | 高品質內容 |
| gpt-4-turbo | 速度快，品質好 | 中 | 平衡選擇 |
| claude-3-opus | 長文撰寫能力強 | 高 | 深度長文 |
| claude-3-sonnet | 性價比高 | 中 | 一般文章 |
| deepseek-chat | 成本最低 | 極低 | 經濟型方案 |

## 品質保證

### 1. 內容驗證

```typescript
private validateContent(output: WritingOutput, input: WritingInput): void {
  const errors: string[] = [];

  // 字數檢查
  const targetWordCount = input.strategy.targetWordCount;
  const actualWordCount = output.statistics.wordCount;
  const deviation = Math.abs(actualWordCount - targetWordCount) / targetWordCount;

  if (deviation > 0.2) {
    errors.push(`字數偏差過大（目標: ${targetWordCount}, 實際: ${actualWordCount}）`);
  }

  // 關鍵字密度檢查
  const targetDensity = input.strategy.keywordDensityTarget;
  const actualDensity = output.keywordUsage.density;

  if (actualDensity < targetDensity * 0.7 || actualDensity > targetDensity * 1.5) {
    errors.push(`關鍵字密度異常（目標: ${targetDensity}%, 實際: ${actualDensity.toFixed(2)}%）`);
  }

  // 內部連結檢查
  const minLinks = input.strategy.internalLinkingStrategy.minLinks;
  if (output.internalLinks.length < minLinks) {
    errors.push(`內部連結不足（最少: ${minLinks}, 實際: ${output.internalLinks.length}）`);
  }

  if (errors.length > 0) {
    console.warn('內容品質警告:', errors);
  }
}
```

## 使用範例

```typescript
const writingAgent = new WritingAgent({
  aiClient: new AIClient(),
});

const result = await writingAgent.execute({
  strategy: strategyOutput,
  brandVoice: {
    tone_of_voice: '專業且親切',
    target_audience: '中小企業主',
    keywords: ['SEO', '搜尋引擎優化'],
  },
  previousArticles: await getPreviousArticles(websiteId),
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
});

console.log('字數:', result.statistics.wordCount);
console.log('關鍵字密度:', result.keywordUsage.density.toFixed(2) + '%');
console.log('內部連結:', result.internalLinks.length);
console.log('閱讀時間:', result.statistics.readingTime, '分鐘');
```
