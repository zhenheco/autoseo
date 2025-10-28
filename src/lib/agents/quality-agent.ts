import { BaseAgent } from './base-agent';
import type { QualityInput, QualityOutput, QualityCheck } from '@/types/agents';

export class QualityAgent extends BaseAgent<QualityInput, QualityOutput> {
  get agentName(): string {
    return 'QualityAgent';
  }

  protected async process(input: QualityInput): Promise<QualityOutput> {
    const checks = {
      wordCount: this.checkWordCount(input),
      keywordDensity: this.checkKeywordDensity(input),
      structure: this.checkStructure(input),
      internalLinks: this.checkInternalLinks(input),
      readability: this.checkReadability(input),
      seoOptimization: this.checkSEOOptimization(input),
      images: this.checkImages(input),
      formatting: this.checkFormatting(input),
    };

    const score = this.calculateScore(checks);
    const passed = score >= input.thresholds.quality_threshold;

    const recommendations = this.generateRecommendations(checks, input);
    const warnings = this.generateWarnings(checks);
    const errors = this.generateErrors(checks);

    return {
      score,
      passed,
      checks,
      recommendations,
      warnings,
      errors,
      executionInfo: {
        executionTime: this.startTime ? Date.now() - this.startTime : 0,
        checksPerformed: Object.keys(checks).length,
      },
    };
  }

  private checkWordCount(input: QualityInput): QualityOutput['checks']['wordCount'] {
    const { wordCount } = input.content.statistics;
    const { content_length_min, content_length_max } = input.thresholds;

    const passed = wordCount >= content_length_min && wordCount <= content_length_max;
    const score = passed ? 100 : (wordCount / content_length_min) * 100;

    return {
      passed,
      weight: 15,
      score: Math.min(100, score),
      actual: wordCount,
      expected: `${content_length_min}-${content_length_max}`,
    };
  }

  private checkKeywordDensity(
    input: QualityInput
  ): QualityOutput['checks']['keywordDensity'] {
    const { density } = input.content.keywordUsage;
    const { keyword_density_min, keyword_density_max } = input.thresholds;

    const passed = density >= keyword_density_min && density <= keyword_density_max;
    const score = passed ? 100 : 50;

    return {
      passed,
      weight: 15,
      score,
      actual: density,
      expected: `${keyword_density_min}-${keyword_density_max}%`,
    };
  }

  private checkStructure(input: QualityInput): QualityOutput['checks']['structure'] {
    const html = input.content.html;

    const h1Count = (html.match(/<h1[^>]*>/g) || []).length;
    const h2Count = (html.match(/<h2[^>]*>/g) || []).length;
    const h3Count = (html.match(/<h3[^>]*>/g) || []).length;

    const passed = h1Count === 1 && h2Count >= 3 && h3Count >= 2;
    let score = 0;

    if (h1Count === 1) score += 40;
    if (h2Count >= 3) score += 30;
    if (h3Count >= 2) score += 30;

    return {
      passed,
      weight: 10,
      score,
      h1Count,
      h2Count,
      h3Count,
    };
  }

  private checkInternalLinks(
    input: QualityInput
  ): QualityOutput['checks']['internalLinks'] {
    const { internalLinks } = input.content;
    const expected = 3;

    const passed = internalLinks.length >= expected;
    const score = (internalLinks.length / expected) * 100;

    return {
      passed,
      weight: 10,
      score: Math.min(100, score),
      count: internalLinks.length,
      expected,
    };
  }

  private checkReadability(
    input: QualityInput
  ): QualityOutput['checks']['readability'] {
    const { fleschReadingEase } = input.content.readability;

    let level: string;
    let score: number;

    if (fleschReadingEase >= 70) {
      level = 'Easy';
      score = 100;
    } else if (fleschReadingEase >= 50) {
      level = 'Medium';
      score = 80;
    } else {
      level = 'Hard';
      score = 60;
    }

    return {
      passed: fleschReadingEase >= 50,
      weight: 15,
      score: fleschReadingEase,
      level,
    };
  }

  private checkSEOOptimization(
    input: QualityInput
  ): QualityOutput['checks']['seoOptimization'] {
    const issues: string[] = [];

    if (!input.meta.title || input.meta.title.length > 60) {
      issues.push('標題長度應在 50-60 字元之間');
    }

    if (!input.meta.description || input.meta.description.length > 160) {
      issues.push('描述長度應在 150-160 字元之間');
    }

    if (!input.meta.slug || input.meta.slug.length > 75) {
      issues.push('URL slug 應簡短且包含關鍵字');
    }

    const passed = issues.length === 0;
    const score = ((3 - issues.length) / 3) * 100;

    return {
      passed,
      weight: 15,
      score,
      issues,
    };
  }

  private checkImages(input: QualityInput): QualityOutput['checks']['images'] {
    const images = [
      input.images.featuredImage,
      ...input.images.contentImages,
    ].filter((img): img is NonNullable<typeof img> => img !== null);

    const totalImages = images.length;
    const hasAltText = images.every((img) => img.altText && img.altText.length > 0);

    const passed = totalImages >= 2 && hasAltText;
    let score = 0;

    if (totalImages >= 2) score += 50;
    if (hasAltText) score += 50;

    return {
      passed,
      weight: 10,
      score,
      count: totalImages,
      hasAltText,
    };
  }

  private checkFormatting(input: QualityInput): QualityOutput['checks']['formatting'] {
    const issues: string[] = [];
    const html = input.content.html;

    const hasLists = /<(ul|ol)[^>]*>/i.test(html);
    if (!hasLists) {
      issues.push('缺少列表元素（建議使用項目符號或編號列表）');
    }

    const hasBold = /<(strong|b)[^>]*>/i.test(html);
    if (!hasBold) {
      issues.push('缺少粗體文字（建議突出重點）');
    }

    const { paragraphCount } = input.content.statistics;
    if (paragraphCount < 5) {
      issues.push('段落數量過少（建議至少 5 段）');
    }

    const passed = issues.length === 0;
    const score = ((3 - issues.length) / 3) * 100;

    return {
      passed,
      weight: 10,
      score,
      issues,
    };
  }

  private calculateScore(checks: QualityOutput['checks']): number {
    let totalScore = 0;
    let totalWeight = 0;

    Object.values(checks).forEach((check) => {
      totalScore += check.score * check.weight;
      totalWeight += check.weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private generateRecommendations(
    checks: QualityOutput['checks'],
    input: QualityInput
  ): QualityOutput['recommendations'] {
    const recommendations: QualityOutput['recommendations'] = [];

    if (!checks.wordCount.passed) {
      recommendations.push({
        priority: 'high',
        category: 'Content Length',
        message: `文章字數 ${checks.wordCount.actual} 不符合目標範圍 ${checks.wordCount.expected}`,
      });
    }

    if (!checks.keywordDensity.passed) {
      recommendations.push({
        priority: 'high',
        category: 'Keyword Density',
        message: `關鍵字密度 ${checks.keywordDensity.actual.toFixed(2)}% 不在理想範圍 ${checks.keywordDensity.expected}`,
      });
    }

    if (!checks.structure.passed) {
      recommendations.push({
        priority: 'medium',
        category: 'Structure',
        message: `標題結構需改善：H1=${checks.structure.h1Count}, H2=${checks.structure.h2Count}, H3=${checks.structure.h3Count}`,
      });
    }

    if (!checks.internalLinks.passed) {
      recommendations.push({
        priority: 'medium',
        category: 'Internal Links',
        message: `內部連結不足，目前 ${checks.internalLinks.count} 個，建議至少 ${checks.internalLinks.expected} 個`,
      });
    }

    if (!checks.readability.passed) {
      recommendations.push({
        priority: 'low',
        category: 'Readability',
        message: `可讀性偏低（${checks.readability.level}），建議簡化句子結構`,
      });
    }

    checks.seoOptimization.issues.forEach((issue) => {
      recommendations.push({
        priority: 'high',
        category: 'SEO',
        message: issue,
      });
    });

    checks.formatting.issues.forEach((issue) => {
      recommendations.push({
        priority: 'low',
        category: 'Formatting',
        message: issue,
      });
    });

    return recommendations;
  }

  private generateWarnings(checks: QualityOutput['checks']): string[] {
    const warnings: string[] = [];

    if (checks.wordCount.score < 80) {
      warnings.push('文章長度偏離目標範圍較多');
    }

    if (checks.keywordDensity.actual > 3) {
      warnings.push('關鍵字密度過高，可能被視為關鍵字堆砌');
    }

    if (checks.structure.h1Count > 1) {
      warnings.push('文章中有多個 H1 標題，不符合 SEO 最佳實踐');
    }

    return warnings;
  }

  private generateErrors(checks: QualityOutput['checks']): string[] {
    const errors: string[] = [];

    if (checks.structure.h1Count === 0) {
      errors.push('文章缺少 H1 標題');
    }

    if (checks.images.count === 0) {
      errors.push('文章沒有圖片');
    }

    if (!checks.images.hasAltText) {
      errors.push('圖片缺少 alt 文字');
    }

    return errors;
  }
}
