# Meta Agent

## 概述

Meta Agent 負責生成 SEO 友善的元數據,包括標題、描述、URL slug 和社交媒體標籤。

## 職責

### 1. SEO 標題生成

- 優化長度（50-60 字元）
- 包含關鍵字
- 吸引點擊

### 2. Meta Description 生成

- 精準描述（120-160 字元）
- 包含關鍵字
- 吸引點擊

### 3. URL Slug 生成

- SEO 友善格式
- 簡潔明確
- 包含關鍵字

### 4. 社交媒體標籤

- Open Graph 標籤
- Twitter Card 標籤
- 優化分享預覽

## 輸入

```typescript
interface MetaInput {
  // Writing Agent 的輸出
  content: WritingOutput;

  // 關鍵字
  keyword: string;

  // Strategy Agent 的標題選項
  titleOptions: string[];

  // AI 配置
  model: string; // gpt-3.5-turbo, gpt-4
  temperature: number;
  maxTokens: number;
}
```

## 輸出

```typescript
interface MetaOutput {
  // SEO 標題
  title: string; // 50-60 字元

  // Meta Description
  description: string; // 120-160 字元

  // URL Slug
  slug: string; // 小寫、連字符分隔

  // Open Graph 標籤
  openGraph: {
    title: string;
    description: string;
    type: "article";
    image?: string; // 如果有圖片
  };

  // Twitter Card 標籤
  twitterCard: {
    card: "summary_large_image";
    title: string;
    description: string;
    image?: string;
  };

  // 其他 SEO 標籤
  canonicalUrl?: string;
  focusKeyphrase: string; // 主要關鍵字

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
class MetaAgent extends BaseAgent {
  async execute(input: MetaInput): Promise<MetaOutput> {
    const startTime = Date.now();

    // 1. 生成 SEO 標題
    const title = await this.generateTitle(input);

    // 2. 生成 Meta Description
    const description = await this.generateDescription(input);

    // 3. 生成 URL Slug
    const slug = this.generateSlug(title, input.keyword);

    // 4. 生成社交媒體標籤
    const openGraph = this.generateOpenGraph(title, description, input);
    const twitterCard = this.generateTwitterCard(title, description, input);

    return {
      title,
      description,
      slug,
      openGraph,
      twitterCard,
      focusKeyphrase: input.keyword,
      executionInfo: {
        model: input.model,
        executionTime: Date.now() - startTime,
        tokenUsage: {
          input: 0,
          output: 0,
        },
      },
    };
  }
}
```

### 2. SEO 標題生成

```typescript
private async generateTitle(input: MetaInput): Promise<string> {
  // 優先使用 Strategy Agent 提供的標題
  if (input.titleOptions && input.titleOptions.length > 0) {
    const selectedTitle = input.titleOptions[0];
    return this.optimizeTitle(selectedTitle, input.keyword);
  }

  // 否則使用 AI 生成
  const prompt = this.buildTitlePrompt(input);

  const response = await this.aiClient.complete(prompt, {
    model: input.model,
    temperature: input.temperature,
    maxTokens: 100,
  });

  const title = response.content.trim().replace(/^["']|["']$/g, '');

  return this.optimizeTitle(title, input.keyword);
}

private buildTitlePrompt(input: MetaInput): string {
  const preview = input.content.markdown.substring(0, 500);

  return `
為以下文章生成一個吸引人的 SEO 標題。

**關鍵字**: ${input.keyword}

**文章預覽**:
${preview}

**要求**:
1. 長度: 50-60 字元
2. 必須包含關鍵字「${input.keyword}」
3. 吸引點擊
4. 清晰描述文章內容
5. 使用數字或強力詞彙（如「完整」、「必學」、「指南」等）

只輸出標題，不要包含任何解釋或引號。
`;
}

private optimizeTitle(title: string, keyword: string): string {
  // 確保包含關鍵字
  if (!title.toLowerCase().includes(keyword.toLowerCase())) {
    title = `${keyword}：${title}`;
  }

  // 長度優化
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  // 移除特殊字元
  title = title.replace(/[<>{}]/g, '');

  return title;
}
```

### 3. Meta Description 生成

```typescript
private async generateDescription(input: MetaInput): Promise<string> {
  const prompt = this.buildDescriptionPrompt(input);

  const response = await this.aiClient.complete(prompt, {
    model: input.model,
    temperature: input.temperature,
    maxTokens: 200,
  });

  const description = response.content.trim().replace(/^["']|["']$/g, '');

  return this.optimizeDescription(description, input.keyword);
}

private buildDescriptionPrompt(input: MetaInput): string {
  const preview = input.content.markdown.substring(0, 1000);

  return `
為以下文章生成一個精準的 meta description。

**關鍵字**: ${input.keyword}

**文章內容預覽**:
${preview}

**要求**:
1. 長度: 120-160 字元
2. 必須包含關鍵字「${input.keyword}」
3. 精準描述文章核心價值
4. 吸引讀者點擊
5. 使用主動語態
6. 包含行動呼籲（如「了解」、「學習」、「掌握」）

只輸出 description，不要包含任何解釋或引號。
`;
}

private optimizeDescription(description: string, keyword: string): string {
  // 確保包含關鍵字
  if (!description.toLowerCase().includes(keyword.toLowerCase())) {
    description = `${keyword}：${description}`;
  }

  // 長度優化
  if (description.length < 120) {
    description += ` 深入了解${keyword}的完整資訊。`;
  }

  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }

  // 移除特殊字元
  description = description.replace(/[<>{}]/g, '');

  // 確保以句號結尾
  if (!description.match(/[。.!?]$/)) {
    description += '。';
  }

  return description;
}
```

### 4. URL Slug 生成

```typescript
private generateSlug(title: string, keyword: string): string {
  // 優先使用標題
  let slug = title.toLowerCase();

  // 移除特殊字元
  slug = slug
    .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // 中文轉拼音或使用關鍵字
  if (/[\u4e00-\u9fa5]/.test(slug)) {
    // 簡化處理：直接使用關鍵字
    slug = keyword.toLowerCase().replace(/\s+/g, '-');
  }

  // 限制長度
  if (slug.length > 60) {
    const parts = slug.split('-');
    slug = parts.slice(0, Math.floor(parts.length / 2)).join('-');
  }

  // 移除開頭和結尾的連字符
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
}
```

### 5. Open Graph 標籤生成

```typescript
private generateOpenGraph(
  title: string,
  description: string,
  input: MetaInput
): OpenGraph {
  return {
    title,
    description,
    type: 'article',
    image: input.content.images?.featuredImage?.url,
  };
}
```

### 6. Twitter Card 標籤生成

```typescript
private generateTwitterCard(
  title: string,
  description: string,
  input: MetaInput
): TwitterCard {
  return {
    card: 'summary_large_image',
    title,
    description,
    image: input.content.images?.featuredImage?.url,
  };
}
```

## 支援的 AI 模型

| 模型                 | 優勢           | 成本 | 推薦使用場景 |
| -------------------- | -------------- | ---- | ------------ |
| **gpt-3.5-turbo** ⭐ | 速度快，成本低 | 低   | 預設選擇     |
| gpt-4                | 品質更高       | 高   | 高品質需求   |

## 品質保證

### 1. 標題驗證

```typescript
private validateTitle(title: string, keyword: string): void {
  const errors: string[] = [];

  // 長度檢查
  if (title.length < 30) {
    errors.push('標題過短（建議 50-60 字元）');
  }

  if (title.length > 70) {
    errors.push('標題過長（建議 50-60 字元）');
  }

  // 關鍵字檢查
  if (!title.toLowerCase().includes(keyword.toLowerCase())) {
    errors.push('標題未包含主要關鍵字');
  }

  // 特殊字元檢查
  if (/[<>{}]/.test(title)) {
    errors.push('標題包含無效字元');
  }

  if (errors.length > 0) {
    console.warn('標題品質警告:', errors);
  }
}
```

### 2. Description 驗證

```typescript
private validateDescription(description: string, keyword: string): void {
  const errors: string[] = [];

  // 長度檢查
  if (description.length < 100) {
    errors.push('Description 過短（建議 120-160 字元）');
  }

  if (description.length > 170) {
    errors.push('Description 過長（建議 120-160 字元）');
  }

  // 關鍵字檢查
  if (!description.toLowerCase().includes(keyword.toLowerCase())) {
    errors.push('Description 未包含主要關鍵字');
  }

  if (errors.length > 0) {
    console.warn('Description 品質警告:', errors);
  }
}
```

### 3. Slug 驗證

```typescript
private validateSlug(slug: string): void {
  const errors: string[] = [];

  // 格式檢查
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.push('Slug 格式不正確（只能包含小寫字母、數字和連字符）');
  }

  // 長度檢查
  if (slug.length > 60) {
    errors.push('Slug 過長（建議不超過 60 字元）');
  }

  // 連字符檢查
  if (slug.startsWith('-') || slug.endsWith('-')) {
    errors.push('Slug 開頭或結尾不能有連字符');
  }

  if (/--/.test(slug)) {
    errors.push('Slug 不能有連續連字符');
  }

  if (errors.length > 0) {
    console.warn('Slug 品質警告:', errors);
  }
}
```

## SEO 最佳實踐

### 1. 標題最佳實踐

```typescript
private readonly TITLE_BEST_PRACTICES = {
  minLength: 50,
  maxLength: 60,
  powerWords: [
    '完整', '指南', '教學', '必學', '實用',
    '詳解', '攻略', '技巧', '秘訣', '方法',
  ],
  formats: [
    '{年份} {關鍵字} 完整指南',
    '{數字}個 {關鍵字} 技巧',
    '如何 {關鍵字}：{副標題}',
    '{關鍵字} vs {競品}：完整比較',
  ],
};

private enhanceTitle(title: string): string {
  // 加入年份（如果沒有）
  const currentYear = new Date().getFullYear();
  if (!title.includes(currentYear.toString())) {
    title = `${currentYear} ${title}`;
  }

  // 加入數字（如果沒有）
  if (!/\d+/.test(title)) {
    // 可以考慮加入「5個」、「10大」等
  }

  return title;
}
```

### 2. Description 最佳實踐

```typescript
private readonly DESCRIPTION_BEST_PRACTICES = {
  minLength: 120,
  maxLength: 160,
  actionWords: [
    '了解', '學習', '掌握', '探索', '發現',
    '查看', '閱讀', '深入了解',
  ],
  structure: '{關鍵字概述} {核心價值} {行動呼籲}',
};

private enhanceDescription(description: string, keyword: string): string {
  // 確保有行動呼籲
  if (!description.match(/了解|學習|掌握|探索|發現/)) {
    description += ` 立即了解更多${keyword}資訊。`;
  }

  return description;
}
```

## 錯誤處理

### 1. AI 生成失敗備用方案

```typescript
private async generateTitleWithFallback(input: MetaInput): Promise<string> {
  try {
    return await this.generateTitle(input);
  } catch (error) {
    console.error('AI 標題生成失敗，使用備用方案', error);

    // 使用第一個標題選項
    if (input.titleOptions && input.titleOptions.length > 0) {
      return this.optimizeTitle(input.titleOptions[0], input.keyword);
    }

    // 最後備用：從內容提取
    return this.extractTitleFromContent(input.content, input.keyword);
  }
}

private extractTitleFromContent(content: WritingOutput, keyword: string): string {
  // 從 markdown 提取第一個 H1 標題
  const h1Match = content.markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return this.optimizeTitle(h1Match[1], keyword);
  }

  // 備用：使用關鍵字生成簡單標題
  return `${keyword} 完整指南 ${new Date().getFullYear()}`;
}
```

## 使用範例

```typescript
const metaAgent = new MetaAgent({
  aiClient: new AIClient(),
});

const result = await metaAgent.execute({
  content: writingOutput,
  keyword: "SEO 優化",
  titleOptions: strategyOutput.titleOptions,
  model: "gpt-3.5-turbo",
  temperature: 0.5,
  maxTokens: 300,
});

console.log("SEO 標題:", result.title);
console.log("Meta Description:", result.description);
console.log("URL Slug:", result.slug);
console.log("Focus Keyphrase:", result.focusKeyphrase);

// 使用 Meta 資訊
const htmlMeta = `
<head>
  <title>${result.title}</title>
  <meta name="description" content="${result.description}">
  <link rel="canonical" href="https://example.com/${result.slug}">

  <!-- Open Graph -->
  <meta property="og:title" content="${result.openGraph.title}">
  <meta property="og:description" content="${result.openGraph.description}">
  <meta property="og:type" content="${result.openGraph.type}">
  ${result.openGraph.image ? `<meta property="og:image" content="${result.openGraph.image}">` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${result.twitterCard.card}">
  <meta name="twitter:title" content="${result.twitterCard.title}">
  <meta name="twitter:description" content="${result.twitterCard.description}">
  ${result.twitterCard.image ? `<meta name="twitter:image" content="${result.twitterCard.image}">` : ""}
</head>
`;
```

## 測試

```typescript
describe("MetaAgent", () => {
  it("should generate SEO title", async () => {
    const agent = new MetaAgent(mockConfig);

    const result = await agent.execute({
      content: mockContent,
      keyword: "SEO 優化",
      titleOptions: ["SEO 優化完整指南"],
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      maxTokens: 300,
    });

    expect(result.title).toBeDefined();
    expect(result.title.length).toBeGreaterThanOrEqual(30);
    expect(result.title.length).toBeLessThanOrEqual(70);
    expect(result.title.toLowerCase()).toContain("seo");
  });

  it("should generate meta description", async () => {
    const agent = new MetaAgent(mockConfig);
    const result = await agent.execute(mockInput);

    expect(result.description).toBeDefined();
    expect(result.description.length).toBeGreaterThanOrEqual(100);
    expect(result.description.length).toBeLessThanOrEqual(170);
  });

  it("should generate valid URL slug", () => {
    const agent = new MetaAgent(mockConfig);
    const slug = agent.generateSlug("SEO 優化完整指南 2025", "SEO 優化");

    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toMatch(/^-|-$/);
  });
});
```
