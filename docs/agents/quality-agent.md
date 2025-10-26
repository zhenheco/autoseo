# Quality Agent

## 概述
Quality Agent 負責全面評估文章品質,確保符合 SEO 標準和內容要求。

## 職責

### 1. 內容品質檢查
- 字數驗證
- 結構完整性
- 可讀性評估

### 2. SEO 優化檢查
- 關鍵字密度
- 標題優化程度
- 內部連結數量

### 3. 格式檢查
- HTML 有效性
- 圖片 alt 文字
- 標題層級

### 4. 品質評分
- 綜合評分計算
- 問題識別
- 改進建議

## 輸入

```typescript
interface QualityInput {
  // Writing Agent 的輸出
  content: WritingOutput;

  // Image Agent 的輸出
  images: ImageOutput;

  // Meta Agent 的輸出
  meta: MetaOutput;

  // 品質門檻設定
  thresholds: {
    quality_threshold: number;     // 最低品質分數 (0-100)
    content_length_min: number;
    content_length_max: number;
    keyword_density_min: number;
    keyword_density_max: number;
  };
}
```

## 輸出

```typescript
interface QualityOutput {
  // 總體評分
  score: number;                   // 0-100
  passed: boolean;                 // 是否通過品質門檻

  // 詳細檢查結果
  checks: {
    wordCount: {
      passed: boolean;
      actual: number;
      expected: string;
      weight: number;
      score: number;
    };

    keywordDensity: {
      passed: boolean;
      actual: number;
      expected: string;
      weight: number;
      score: number;
    };

    structure: {
      passed: boolean;
      h1Count: number;
      h2Count: number;
      h3Count: number;
      weight: number;
      score: number;
    };

    internalLinks: {
      passed: boolean;
      count: number;
      expected: number;
      weight: number;
      score: number;
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
      score: number;
    };

    images: {
      passed: boolean;
      count: number;
      hasAltText: boolean;
      weight: number;
      score: number;
    };

    formatting: {
      passed: boolean;
      issues: string[];
      weight: number;
      score: number;
    };
  };

  // 改進建議
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    section?: string;
  }[];

  // 警告和錯誤
  warnings: string[];
  errors: string[];

  // 執行資訊
  executionInfo: {
    executionTime: number;
    checksPerformed: number;
  };
}
```

## 核心邏輯

### 1. 主執行流程

```typescript
class QualityAgent extends BaseAgent {
  async execute(input: QualityInput): Promise<QualityOutput> {
    const startTime = Date.now();

    // 執行所有檢查
    const checks = {
      wordCount: this.checkWordCount(input),
      keywordDensity: this.checkKeywordDensity(input),
      structure: this.checkStructure(input),
      internalLinks: this.checkInternalLinks(input),
      readability: this.checkReadability(input),
      seoOptimization: this.checkSEO(input),
      images: this.checkImages(input),
      formatting: this.checkFormatting(input),
    };

    // 計算總分
    const score = this.calculateOverallScore(checks);
    const passed = score >= input.thresholds.quality_threshold;

    // 生成建議
    const recommendations = this.generateRecommendations(checks, input);
    const warnings = this.collectWarnings(checks);
    const errors = this.collectErrors(checks);

    return {
      score,
      passed,
      checks,
      recommendations,
      warnings,
      errors,
      executionInfo: {
        executionTime: Date.now() - startTime,
        checksPerformed: Object.keys(checks).length,
      },
    };
  }
}
```

### 2. 字數檢查

```typescript
private checkWordCount(input: QualityInput): WordCountCheck {
  const actual = input.content.statistics.wordCount;
  const min = input.thresholds.content_length_min;
  const max = input.thresholds.content_length_max;

  const passed = actual >= min && actual <= max;
  const weight = 25; // 字數權重 25%

  let score = 0;
  if (passed) {
    score = weight;
  } else if (actual < min) {
    // 字數不足，按比例扣分
    score = (actual / min) * weight;
  } else {
    // 字數過多，輕微扣分
    const excess = actual - max;
    const penalty = Math.min((excess / max) * weight, weight * 0.3);
    score = weight - penalty;
  }

  return {
    passed,
    actual,
    expected: `${min}-${max}`,
    weight,
    score: Math.round(score),
  };
}
```

### 3. 關鍵字密度檢查

```typescript
private checkKeywordDensity(input: QualityInput): KeywordDensityCheck {
  const actual = input.content.keywordUsage.density;
  const min = input.thresholds.keyword_density_min;
  const max = input.thresholds.keyword_density_max;

  const passed = actual >= min && actual <= max;
  const weight = 30; // 關鍵字密度權重 30%

  let score = 0;
  if (passed) {
    score = weight;
  } else if (actual < min) {
    // 密度過低
    score = (actual / min) * weight;
  } else {
    // 密度過高（過度優化）
    const excess = actual - max;
    const penalty = Math.min((excess / max) * weight, weight * 0.5);
    score = weight - penalty;
  }

  return {
    passed,
    actual: parseFloat(actual.toFixed(2)),
    expected: `${min}-${max}%`,
    weight,
    score: Math.round(score),
  };
}
```

### 4. 結構檢查

```typescript
private checkStructure(input: QualityInput): StructureCheck {
  const html = input.content.html;

  // 計算標題數量
  const h1Count = (html.match(/<h1/g) || []).length;
  const h2Count = (html.match(/<h2/g) || []).length;
  const h3Count = (html.match(/<h3/g) || []).length;

  // 檢查規則
  const hasOneH1 = h1Count === 1;
  const hasMultipleH2 = h2Count >= 3;
  const hasMultipleH3 = h3Count >= 5;

  const passed = hasOneH1 && hasMultipleH2 && hasMultipleH3;
  const weight = 25; // 結構權重 25%

  let score = 0;
  if (hasOneH1) score += weight * 0.3;
  if (hasMultipleH2) score += weight * 0.4;
  if (hasMultipleH3) score += weight * 0.3;

  return {
    passed,
    h1Count,
    h2Count,
    h3Count,
    weight,
    score: Math.round(score),
  };
}
```

### 5. 內部連結檢查

```typescript
private checkInternalLinks(input: QualityInput): InternalLinksCheck {
  const count = input.content.internalLinks.length;
  const expected = 3; // 最少 3 個內部連結

  const passed = count >= expected;
  const weight = 20; // 內部連結權重 20%

  const score = passed
    ? weight
    : Math.round((count / expected) * weight);

  return {
    passed,
    count,
    expected,
    weight,
    score,
  };
}
```

### 6. 可讀性檢查

```typescript
private checkReadability(input: QualityInput): ReadabilityCheck {
  const readability = input.content.readability;
  const weight = 15; // 可讀性權重 15%

  // Flesch Reading Ease 分數:
  // 90-100: 非常容易
  // 80-89: 容易
  // 70-79: 相當容易
  // 60-69: 標準
  // 50-59: 相當困難
  // 30-49: 困難
  // 0-29: 非常困難

  const ease = readability.fleschReadingEase;
  let level: string;
  let passed: boolean;

  if (ease >= 60) {
    level = '易讀';
    passed = true;
  } else if (ease >= 50) {
    level = '中等';
    passed = true;
  } else {
    level = '困難';
    passed = false;
  }

  // 計算分數（60 分以上給滿分）
  const score = ease >= 60
    ? weight
    : Math.round((ease / 60) * weight);

  return {
    passed,
    score: readability.fleschReadingEase,
    level,
    weight,
    score,
  };
}
```

### 7. SEO 優化檢查

```typescript
private checkSEO(input: QualityInput): SEOCheck {
  const html = input.content.html;
  const meta = input.meta;
  const issues: string[] = [];
  const weight = 20;

  // 檢查標題是否包含關鍵字
  if (meta && !meta.title.toLowerCase().includes(meta.focusKeyphrase.toLowerCase())) {
    issues.push('標題未包含主要關鍵字');
  }

  // 檢查 meta description
  if (meta && meta.description.length < 120) {
    issues.push('Meta description 過短（建議 120-160 字元）');
  }

  // 檢查第一段是否包含關鍵字
  const firstParagraph = html.match(/<p>(.*?)<\/p>/)?.[1] || '';
  if (meta && !firstParagraph.toLowerCase().includes(meta.focusKeyphrase.toLowerCase())) {
    issues.push('第一段未包含主要關鍵字');
  }

  // 檢查 strong/bold 標籤
  const strongCount = (html.match(/<strong>|<b>/g) || []).length;
  if (strongCount < 3) {
    issues.push('重點強調不足（建議至少 3 處粗體）');
  }

  // 檢查列表
  const hasLists = /<ul>|<ol>/.test(html);
  if (!hasLists) {
    issues.push('缺少列表（建議使用項目符號或編號列表）');
  }

  const passed = issues.length === 0;
  const score = Math.round(weight * (1 - issues.length * 0.15));

  return {
    passed,
    issues,
    weight,
    score: Math.max(score, 0),
  };
}
```

### 8. 圖片檢查

```typescript
private checkImages(input: QualityInput): ImagesCheck {
  const images = input.images;
  const weight = 10;

  const count = images.contentImages.length + (images.featuredImage ? 1 : 0);
  const hasAltText = images.contentImages.every(img => img.altText);

  const passed = count >= 1 && hasAltText;

  let score = 0;
  if (count >= 1) score += weight * 0.5;
  if (hasAltText) score += weight * 0.5;

  return {
    passed,
    count,
    hasAltText,
    weight,
    score,
  };
}
```

### 9. 格式檢查

```typescript
private checkFormatting(input: QualityInput): FormattingCheck {
  const html = input.content.html;
  const issues: string[] = [];
  const weight = 10;

  // 檢查段落長度
  const paragraphs = html.match(/<p>.*?<\/p>/g) || [];
  const longParagraphs = paragraphs.filter(p => {
    const text = p.replace(/<[^>]*>/g, '');
    return text.split(/[.!?]/).length > 7;
  });

  if (longParagraphs.length > paragraphs.length * 0.3) {
    issues.push('過多長段落（建議每段 3-5 句）');
  }

  // 檢查 HTML 有效性
  const unclosedTags = this.findUnclosedTags(html);
  if (unclosedTags.length > 0) {
    issues.push(`HTML 標籤未正確閉合: ${unclosedTags.join(', ')}`);
  }

  // 檢查連續換行
  if (/<br>\s*<br>/.test(html)) {
    issues.push('存在多餘的換行');
  }

  const passed = issues.length === 0;
  const score = Math.round(weight * (1 - issues.length * 0.2));

  return {
    passed,
    issues,
    weight,
    score: Math.max(score, 0),
  };
}

private findUnclosedTags(html: string): string[] {
  const stack: string[] = [];
  const unclosed: string[] = [];
  const tagRegex = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;

  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const isClosing = match[0].startsWith('</');

    // 自閉合標籤
    if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tag)) {
      continue;
    }

    if (isClosing) {
      if (stack.length === 0 || stack[stack.length - 1] !== tag) {
        unclosed.push(tag);
      } else {
        stack.pop();
      }
    } else {
      stack.push(tag);
    }
  }

  return [...new Set([...unclosed, ...stack])];
}
```

### 10. 總分計算

```typescript
private calculateOverallScore(checks: QualityChecks): number {
  const totalScore = Object.values(checks).reduce(
    (sum, check) => sum + check.score,
    0
  );

  return Math.min(Math.round(totalScore), 100);
}
```

### 11. 建議生成

```typescript
private generateRecommendations(
  checks: QualityChecks,
  input: QualityInput
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 字數建議
  if (!checks.wordCount.passed) {
    const { actual, expected } = checks.wordCount;
    if (actual < input.thresholds.content_length_min) {
      recommendations.push({
        priority: 'high',
        category: 'content',
        message: `文章字數不足。目前 ${actual} 字，建議增加至 ${expected} 字範圍。`,
      });
    }
  }

  // 關鍵字密度建議
  if (!checks.keywordDensity.passed) {
    const { actual } = checks.keywordDensity;
    if (actual < input.thresholds.keyword_density_min) {
      recommendations.push({
        priority: 'high',
        category: 'seo',
        message: `關鍵字密度過低（${actual.toFixed(2)}%）。建議在文章中自然地多使用主要關鍵字。`,
      });
    } else {
      recommendations.push({
        priority: 'high',
        category: 'seo',
        message: `關鍵字密度過高（${actual.toFixed(2)}%）。可能被視為關鍵字堆砌，建議減少使用頻率。`,
      });
    }
  }

  // 結構建議
  if (!checks.structure.passed) {
    if (checks.structure.h1Count !== 1) {
      recommendations.push({
        priority: 'high',
        category: 'structure',
        message: `H1 標題數量異常（${checks.structure.h1Count}）。一篇文章應該只有一個 H1。`,
      });
    }
    if (checks.structure.h2Count < 3) {
      recommendations.push({
        priority: 'medium',
        category: 'structure',
        message: `H2 章節不足（${checks.structure.h2Count}）。建議至少有 3-5 個主要章節。`,
      });
    }
  }

  // 內部連結建議
  if (!checks.internalLinks.passed) {
    recommendations.push({
      priority: 'medium',
      category: 'seo',
      message: `內部連結不足（${checks.internalLinks.count}）。建議至少加入 ${checks.internalLinks.expected} 個相關文章連結。`,
    });
  }

  // 可讀性建議
  if (!checks.readability.passed) {
    recommendations.push({
      priority: 'low',
      category: 'content',
      message: `文章可讀性偏低（${checks.readability.level}）。建議使用更簡單的詞彙和較短的句子。`,
    });
  }

  // SEO 建議
  checks.seoOptimization.issues.forEach(issue => {
    recommendations.push({
      priority: 'medium',
      category: 'seo',
      message: issue,
    });
  });

  // 格式建議
  checks.formatting.issues.forEach(issue => {
    recommendations.push({
      priority: 'low',
      category: 'formatting',
      message: issue,
    });
  });

  return recommendations;
}
```

## 品質報告範例

```typescript
{
  score: 85,
  passed: true,
  checks: {
    wordCount: {
      passed: true,
      actual: 2156,
      expected: "1500-2500",
      weight: 25,
      score: 25
    },
    keywordDensity: {
      passed: true,
      actual: 1.8,
      expected: "1.5-2.5%",
      weight: 30,
      score: 30
    },
    structure: {
      passed: true,
      h1Count: 1,
      h2Count: 5,
      h3Count: 8,
      weight: 25,
      score: 25
    },
    internalLinks: {
      passed: true,
      count: 4,
      expected: 3,
      weight: 20,
      score: 20
    },
    readability: {
      passed: true,
      score: 72.5,
      level: "易讀",
      weight: 15,
      score: 15
    },
    seoOptimization: {
      passed: false,
      issues: ["第一段未包含主要關鍵字"],
      weight: 20,
      score: 17
    },
    images: {
      passed: true,
      count: 3,
      hasAltText: true,
      weight: 10,
      score: 10
    },
    formatting: {
      passed: true,
      issues: [],
      weight: 10,
      score: 10
    }
  },
  recommendations: [
    {
      priority: "medium",
      category: "seo",
      message: "第一段未包含主要關鍵字"
    }
  ],
  warnings: [],
  errors: []
}
```

## 使用範例

```typescript
const qualityAgent = new QualityAgent();

const result = await qualityAgent.execute({
  content: writingOutput,
  images: imageOutput,
  meta: metaOutput,
  thresholds: {
    quality_threshold: 80,
    content_length_min: 1500,
    content_length_max: 2500,
    keyword_density_min: 1.5,
    keyword_density_max: 2.5,
  },
});

if (result.passed) {
  console.log('✅ 文章品質通過', `分數: ${result.score}`);
} else {
  console.log('❌ 文章品質未達標', `分數: ${result.score}`);
  console.log('改進建議:', result.recommendations);
}
```
