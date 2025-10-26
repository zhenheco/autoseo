# Image Agent

## 概述
Image Agent 負責為文章生成高品質的配圖,包括特色圖片和內文圖片。

## 職責

### 1. 圖片需求分析
- 分析文章內容確定圖片需求
- 確定圖片類型和風格
- 規劃圖片位置

### 2. 提示詞生成
- 根據文章內容生成圖片提示詞
- 優化提示詞以獲得最佳結果
- 確保圖片與品牌風格一致

### 3. 圖片生成
- 使用 AI 圖片生成服務
- 優化圖片尺寸和格式
- 生成替代文字（alt text）

### 4. 品質控制
- 驗證圖片品質
- 確保圖片相關性
- 檢查圖片合規性

## 輸入

```typescript
interface ImageInput {
  // 文章資訊
  title: string;
  outline: Outline;

  // 圖片需求
  count: number;                 // 需要的圖片數量 (0-10)

  // 品牌風格（可選）
  brandStyle?: {
    colorScheme?: string[];      // 色彩方案
    style?: string;              // 視覺風格
    mood?: string;               // 情緒氛圍
  };

  // AI 配置
  model: string;                 // dall-e-3, dall-e-2, nano-banana, chatgpt-image-mini
  quality: 'standard' | 'hd';    // 僅 DALL-E 3
  size: string;                  // 1024x1024, 1024x1792, 1792x1024
}
```

## 輸出

```typescript
interface ImageOutput {
  // 特色圖片
  featuredImage: {
    url: string;
    localPath?: string;          // 如果已下載
    prompt: string;              // 使用的提示詞
    altText: string;             // SEO 替代文字
    width: number;
    height: number;
    model: string;
  };

  // 內文圖片
  contentImages: {
    url: string;
    localPath?: string;
    prompt: string;
    altText: string;
    suggestedSection: string;    // 建議插入的章節
    width: number;
    height: number;
    model: string;
  }[];

  // 執行資訊
  executionInfo: {
    model: string;
    totalImages: number;
    executionTime: number;
    totalCost: number;
  };
}
```

## 支援的圖片模型

### 模型比較表

| 模型 | 提供商 | 品質 | 速度 | 成本/張 | 推薦場景 |
|------|--------|------|------|---------|---------|
| **dall-e-3** | OpenAI | 極高 | 慢 | $0.04-0.12 | 高品質特色圖 ⭐ |
| dall-e-2 | OpenAI | 中 | 快 | $0.02 | 經濟型選擇 |
| **nano-banana** | Nano | 高 | 很快 | $0.01 | 快速生成 🚀 |
| **chatgpt-image-mini** | OpenAI | 中高 | 快 | $0.015 | 平衡選擇 ⚖️ |

### 模型詳細配置

```typescript
const IMAGE_MODELS = {
  'dall-e-3': {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/images/generations',
    sizes: ['1024x1024', '1024x1792', '1792x1024'],
    qualities: ['standard', 'hd'],
    maxPromptLength: 4000,
    pricing: {
      'standard-1024x1024': 0.04,
      'hd-1024x1024': 0.08,
      'hd-1024x1792': 0.12,
      'hd-1792x1024': 0.12,
    },
  },

  'dall-e-2': {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/images/generations',
    sizes: ['256x256', '512x512', '1024x1024'],
    qualities: ['standard'],
    maxPromptLength: 1000,
    pricing: {
      '256x256': 0.016,
      '512x512': 0.018,
      '1024x1024': 0.02,
    },
  },

  'nano-banana': {
    provider: 'nano',
    endpoint: 'https://api.nano.com/v1/images/generate',
    sizes: ['1024x1024', '512x512'],
    qualities: ['standard', 'high'],
    maxPromptLength: 2000,
    pricing: {
      'standard-1024x1024': 0.01,
      'high-1024x1024': 0.015,
    },
  },

  'chatgpt-image-mini': {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/images/generations',
    sizes: ['1024x1024'],
    qualities: ['standard'],
    maxPromptLength: 1500,
    pricing: {
      'standard-1024x1024': 0.015,
    },
  },
};
```

## 核心邏輯

### 1. 主執行流程

```typescript
class ImageAgent extends BaseAgent {
  async execute(input: ImageInput): Promise<ImageOutput> {
    const startTime = Date.now();

    if (input.count === 0) {
      return this.emptyResult(input.model);
    }

    // 1. 分析圖片需求
    const imageNeeds = this.analyzeImageNeeds(input);

    // 2. 生成提示詞
    const prompts = await this.generatePrompts(imageNeeds, input);

    // 3. 生成圖片
    const images = await this.generateImages(prompts, input);

    // 4. 下載和優化（可選）
    const optimizedImages = await this.optimizeImages(images);

    return {
      featuredImage: optimizedImages[0],
      contentImages: optimizedImages.slice(1),
      executionInfo: {
        model: input.model,
        totalImages: optimizedImages.length,
        executionTime: Date.now() - startTime,
        totalCost: this.calculateCost(input, optimizedImages.length),
      },
    };
  }
}
```

### 2. 圖片需求分析

```typescript
private analyzeImageNeeds(input: ImageInput): ImageNeed[] {
  const needs: ImageNeed[] = [];

  // 特色圖片（必要）
  needs.push({
    type: 'featured',
    title: input.title,
    context: `文章標題：${input.title}`,
    priority: 10,
  });

  // 內文圖片（根據章節）
  const sectionsNeedingImages = this.selectSectionsForImages(
    input.outline.mainSections,
    input.count - 1 // 減去特色圖片
  );

  sectionsNeedingImages.forEach((section, index) => {
    needs.push({
      type: 'content',
      title: section.heading,
      context: `章節：${section.heading}\n要點：${section.keyPoints.join(', ')}`,
      section: section.heading,
      priority: 10 - index,
    });
  });

  return needs;
}

private selectSectionsForImages(
  sections: MainSection[],
  count: number
): MainSection[] {
  // 根據章節重要性和內容複雜度選擇需要圖片的章節
  return sections
    .map(section => ({
      section,
      score: this.calculateImageNeedScore(section),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(item => item.section);
}

private calculateImageNeedScore(section: MainSection): number {
  let score = 0;

  // 較長的章節更需要圖片
  score += section.targetWordCount / 100;

  // 包含步驟或流程的章節需要圖片
  if (section.heading.includes('步驟') || section.heading.includes('如何')) {
    score += 5;
  }

  // 技術性或複雜的章節需要圖片
  if (section.keyPoints.some(p => p.includes('技術') || p.includes('方法'))) {
    score += 3;
  }

  return score;
}
```

### 3. 提示詞生成

```typescript
private async generatePrompts(
  imageNeeds: ImageNeed[],
  input: ImageInput
): Promise<ImagePrompt[]> {
  const prompts: ImagePrompt[] = [];

  for (const need of imageNeeds) {
    const prompt = await this.generateSinglePrompt(need, input);
    prompts.push(prompt);
  }

  return prompts;
}

private async generateSinglePrompt(
  need: ImageNeed,
  input: ImageInput
): Promise<ImagePrompt> {
  const basePrompt = this.buildBasePrompt(need, input);
  const enhancedPrompt = this.enhancePromptForModel(basePrompt, input.model);
  const altText = this.generateAltText(need);

  return {
    prompt: enhancedPrompt,
    altText,
    type: need.type,
    section: need.section,
  };
}

private buildBasePrompt(need: ImageNeed, input: ImageInput): string {
  let prompt = '';

  // 基礎場景描述
  if (need.type === 'featured') {
    prompt = `A professional, eye-catching featured image for an article titled "${need.title}". `;
  } else {
    prompt = `An illustrative image for the section "${need.title}". `;
  }

  // 加入品牌風格
  if (input.brandStyle) {
    if (input.brandStyle.style) {
      prompt += `Style: ${input.brandStyle.style}. `;
    }
    if (input.brandStyle.mood) {
      prompt += `Mood: ${input.brandStyle.mood}. `;
    }
    if (input.brandStyle.colorScheme) {
      prompt += `Color scheme: ${input.brandStyle.colorScheme.join(', ')}. `;
    }
  }

  // 通用品質要求
  prompt += 'High quality, professional, clean composition, modern design.';

  return prompt;
}

private enhancePromptForModel(prompt: string, model: string): string {
  const modelConfig = IMAGE_MODELS[model];

  // 確保提示詞不超過長度限制
  if (prompt.length > modelConfig.maxPromptLength) {
    prompt = prompt.substring(0, modelConfig.maxPromptLength - 3) + '...';
  }

  // 針對不同模型優化提示詞
  switch (model) {
    case 'dall-e-3':
      // DALL-E 3 喜歡詳細的描述
      return prompt;

    case 'dall-e-2':
      // DALL-E 2 偏好簡潔的描述
      return this.simplifyPrompt(prompt);

    case 'nano-banana':
      // Nano Banana 對關鍵詞敏感
      return this.emphasizeKeywords(prompt);

    case 'chatgpt-image-mini':
      // ChatGPT Image Mini 平衡型
      return prompt;

    default:
      return prompt;
  }
}

private generateAltText(need: ImageNeed): string {
  if (need.type === 'featured') {
    return `${need.title} 的特色圖片`;
  } else {
    return `關於${need.title}的插圖`;
  }
}
```

### 4. 圖片生成

```typescript
private async generateImages(
  prompts: ImagePrompt[],
  input: ImageInput
): Promise<GeneratedImage[]> {
  const modelConfig = IMAGE_MODELS[input.model];
  const images: GeneratedImage[] = [];

  for (const prompt of prompts) {
    try {
      const image = await this.generateSingleImage(prompt, input, modelConfig);
      images.push(image);
    } catch (error) {
      console.error(`圖片生成失敗: ${prompt.prompt}`, error);

      // 非特色圖片失敗可以跳過
      if (prompt.type === 'featured') {
        throw error;
      }
    }
  }

  return images;
}

private async generateSingleImage(
  prompt: ImagePrompt,
  input: ImageInput,
  modelConfig: ModelConfig
): Promise<GeneratedImage> {
  const requestBody = this.buildImageRequest(prompt, input, modelConfig);

  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getApiKey(modelConfig.provider)}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`圖片生成 API 錯誤: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    url: data.data[0].url,
    prompt: prompt.prompt,
    altText: prompt.altText,
    type: prompt.type,
    section: prompt.section,
    model: input.model,
    ...this.parseSize(input.size),
  };
}

private buildImageRequest(
  prompt: ImagePrompt,
  input: ImageInput,
  modelConfig: ModelConfig
): any {
  const base = {
    prompt: prompt.prompt,
    n: 1,
  };

  switch (input.model) {
    case 'dall-e-3':
      return {
        ...base,
        model: 'dall-e-3',
        size: input.size,
        quality: input.quality,
      };

    case 'dall-e-2':
      return {
        ...base,
        model: 'dall-e-2',
        size: input.size,
      };

    case 'nano-banana':
      return {
        ...base,
        model: 'nano-banana',
        size: input.size,
        quality: input.quality === 'hd' ? 'high' : 'standard',
      };

    case 'chatgpt-image-mini':
      return {
        ...base,
        model: 'chatgpt-image-mini',
        size: input.size,
      };

    default:
      throw new Error(`不支援的圖片模型: ${input.model}`);
  }
}
```

### 5. 圖片優化

```typescript
private async optimizeImages(
  images: GeneratedImage[]
): Promise<OptimizedImage[]> {
  const optimized: OptimizedImage[] = [];

  for (const image of images) {
    try {
      // 下載圖片
      const buffer = await this.downloadImage(image.url);

      // 優化尺寸和格式
      const optimizedBuffer = await this.optimizeImageBuffer(buffer);

      // 上傳到儲存服務
      const localPath = await this.uploadToStorage(optimizedBuffer, image);

      optimized.push({
        ...image,
        localPath,
      });
    } catch (error) {
      console.error('圖片優化失敗', error);

      // 使用原始 URL 作為備用
      optimized.push(image);
    }
  }

  return optimized;
}

private async downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

private async optimizeImageBuffer(buffer: Buffer): Promise<Buffer> {
  // 使用 sharp 進行圖片優化
  const sharp = require('sharp');

  return sharp(buffer)
    .jpeg({ quality: 85, progressive: true })
    .resize({ width: 1200, withoutEnlargement: true })
    .toBuffer();
}

private async uploadToStorage(
  buffer: Buffer,
  image: GeneratedImage
): Promise<string> {
  const filename = `images/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

  // 上傳到 Supabase Storage 或 S3
  const { data, error } = await this.storageClient
    .from('article-images')
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 年
    });

  if (error) throw error;

  return data.path;
}
```

## 成本計算

```typescript
private calculateCost(input: ImageInput, imageCount: number): number {
  const modelConfig = IMAGE_MODELS[input.model];
  const sizeKey = input.quality === 'hd'
    ? `hd-${input.size}`
    : `standard-${input.size}`;

  const costPerImage = modelConfig.pricing[sizeKey] || modelConfig.pricing['standard-1024x1024'];

  return costPerImage * imageCount;
}
```

## 錯誤處理

### 1. API 錯誤重試

```typescript
private async generateSingleImageWithRetry(
  prompt: ImagePrompt,
  input: ImageInput,
  maxRetries: number = 3
): Promise<GeneratedImage> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.generateSingleImage(prompt, input, IMAGE_MODELS[input.model]);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      console.warn(`圖片生成失敗，重試 ${attempt}/${maxRetries}`, error);
      await this.delay(2000 * attempt);
    }
  }
}
```

### 2. 降級策略

```typescript
private async generateWithFallback(input: ImageInput): Promise<ImageOutput> {
  try {
    return await this.execute(input);
  } catch (error) {
    console.error('主要模型失敗，嘗試降級', error);

    // 降級到較便宜的模型
    const fallbackInput = {
      ...input,
      model: this.getFallbackModel(input.model),
      quality: 'standard' as const,
    };

    return await this.execute(fallbackInput);
  }
}

private getFallbackModel(originalModel: string): string {
  const fallbackChain = {
    'dall-e-3': 'chatgpt-image-mini',
    'chatgpt-image-mini': 'nano-banana',
    'nano-banana': 'dall-e-2',
    'dall-e-2': 'dall-e-2', // 最後備用
  };

  return fallbackChain[originalModel] || 'dall-e-2';
}
```

## 使用範例

```typescript
const imageAgent = new ImageAgent({
  storageClient: supabaseStorage,
});

// 使用 DALL-E 3 生成高品質圖片
const result1 = await imageAgent.execute({
  title: 'SEO 優化完整指南',
  outline: strategyOutput.outline,
  count: 4,
  model: 'dall-e-3',
  quality: 'hd',
  size: '1024x1024',
  brandStyle: {
    style: 'modern minimalist',
    mood: 'professional and trustworthy',
    colorScheme: ['blue', 'white', 'gray'],
  },
});

// 使用 Nano Banana 快速生成
const result2 = await imageAgent.execute({
  title: '快速 SEO 技巧',
  outline: strategyOutput.outline,
  count: 3,
  model: 'nano-banana',
  quality: 'standard',
  size: '1024x1024',
});

console.log('總成本:', result1.executionInfo.totalCost);
console.log('特色圖片:', result1.featuredImage.url);
console.log('內文圖片數量:', result1.contentImages.length);
```

## 測試

```typescript
describe('ImageAgent', () => {
  it('should generate images with DALL-E 3', async () => {
    const agent = new ImageAgent(mockConfig);

    const result = await agent.execute({
      title: '測試文章',
      outline: mockOutline,
      count: 3,
      model: 'dall-e-3',
      quality: 'standard',
      size: '1024x1024',
    });

    expect(result.featuredImage).toBeDefined();
    expect(result.contentImages.length).toBe(2);
  });

  it('should handle API failures gracefully', async () => {
    const agent = new ImageAgent(mockConfig);
    agent.generateSingleImage = jest.fn().mockRejectedValue(new Error('API Error'));

    await expect(agent.execute(mockInput)).rejects.toThrow();
  });
});
```
