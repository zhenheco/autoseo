import { z } from "zod";
import type {
  QualityGateInput,
  QualityCheckResult,
  QualityCheckItem,
} from "@/types/agents";

export type { QualityGateInput, QualityCheckResult, QualityCheckItem };

export const QualityCheckResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      score: z.number().min(0).max(100),
      message: z.string(),
      severity: z.enum(["error", "warning", "info"]),
    }),
  ),
  suggestions: z.array(z.string()),
  blockers: z.array(z.string()),
});

interface CheckResult {
  name: string;
  passed: boolean;
  score: number;
  message: string;
  severity: "error" | "warning" | "info";
}

export class QualityGateAgent {
  private qualityThreshold: number;

  constructor(qualityThreshold: number = 70) {
    this.qualityThreshold = qualityThreshold;
  }

  async execute(input: QualityGateInput): Promise<QualityCheckResult> {
    console.log("[QualityGateAgent] 開始品質檢查...");

    const checks: CheckResult[] = [];
    const threshold = input.qualityThreshold ?? this.qualityThreshold;

    checks.push(this.checkWordCount(input));
    checks.push(this.checkKeywordUsage(input));
    checks.push(this.checkHeadingStructure(input));
    checks.push(this.checkReadability(input));
    checks.push(this.checkMetaQuality(input));
    checks.push(this.checkContentStructure(input));
    checks.push(this.checkImageAltText(input));
    checks.push(this.checkInternalLinks(input));

    const totalScore = this.calculateTotalScore(checks);
    const passed = totalScore >= threshold;

    const blockers = checks
      .filter((c) => c.severity === "error" && !c.passed)
      .map((c) => c.message);

    const suggestions = checks
      .filter((c) => c.severity === "warning" && !c.passed)
      .map((c) => c.message);

    console.log(`[QualityGateAgent] 品質分數: ${totalScore.toFixed(1)}/100`);
    console.log(`[QualityGateAgent] 通過: ${passed ? "是" : "否"}`);

    return {
      passed,
      score: totalScore,
      checks,
      suggestions,
      blockers,
    };
  }

  private checkWordCount(input: QualityGateInput): CheckResult {
    const wordCount = input.writing.statistics.wordCount;
    const minWords = Math.floor(input.targetWordCount * 0.8);
    const maxWords = Math.ceil(input.targetWordCount * 1.5);

    const passed = wordCount >= minWords;
    const score = passed
      ? Math.min(100, (wordCount / input.targetWordCount) * 100)
      : 50;

    let message = "";
    if (wordCount < minWords) {
      message = `字數不足：${wordCount} 字，最少需要 ${minWords} 字`;
    } else if (wordCount > maxWords) {
      message = `字數過多：${wordCount} 字，建議不超過 ${maxWords} 字`;
    } else {
      message = `字數適中：${wordCount} 字`;
    }

    return {
      name: "word_count",
      passed,
      score,
      message,
      severity:
        wordCount < minWords
          ? "error"
          : wordCount > maxWords
            ? "warning"
            : "info",
    };
  }

  private checkKeywordUsage(input: QualityGateInput): CheckResult {
    const { count, density } = input.writing.keywordUsage;
    const minDensity = 0.5;
    const maxDensity = 3.0;
    const minCount = 3;

    const densityOk = density >= minDensity && density <= maxDensity;
    const countOk = count >= minCount;
    const passed = densityOk && countOk;

    let score = 0;
    if (densityOk) score += 50;
    if (countOk) score += 50;

    let message = "";
    if (!countOk) {
      message = `關鍵字出現次數不足：${count} 次，建議至少 ${minCount} 次`;
    } else if (density < minDensity) {
      message = `關鍵字密度過低：${density.toFixed(2)}%，建議 ${minDensity}-${maxDensity}%`;
    } else if (density > maxDensity) {
      message = `關鍵字密度過高：${density.toFixed(2)}%，可能過度優化`;
    } else {
      message = `關鍵字使用良好：${count} 次，密度 ${density.toFixed(2)}%`;
    }

    return {
      name: "keyword_usage",
      passed,
      score,
      message,
      severity: !passed ? "warning" : "info",
    };
  }

  private checkHeadingStructure(input: QualityGateInput): CheckResult {
    const html = input.writing.html;

    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
    const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;

    const hasOneH1 = h1Count === 1;
    const hasEnoughH2 = h2Count >= 3;
    const hasH3 = h3Count >= 0;

    const passed = hasOneH1 && hasEnoughH2;
    let score = 0;
    if (hasOneH1) score += 40;
    if (hasEnoughH2) score += 40;
    if (hasH3) score += 20;

    let message = "";
    if (h1Count === 0) {
      message = "缺少 H1 標題";
    } else if (h1Count > 1) {
      message = `H1 標題過多：${h1Count} 個，應該只有 1 個`;
    } else if (!hasEnoughH2) {
      message = `H2 標題不足：${h2Count} 個，建議至少 3 個`;
    } else {
      message = `標題結構良好：H1=${h1Count}, H2=${h2Count}, H3=${h3Count}`;
    }

    return {
      name: "heading_structure",
      passed,
      score,
      message,
      severity: h1Count !== 1 ? "error" : !hasEnoughH2 ? "warning" : "info",
    };
  }

  private checkReadability(input: QualityGateInput): CheckResult {
    const { fleschReadingEase, fleschKincaidGrade } = input.writing.readability;

    const easeOk = fleschReadingEase >= 30;
    const gradeOk = fleschKincaidGrade <= 12;
    const passed = easeOk && gradeOk;

    let score = 0;
    if (fleschReadingEase >= 60) score += 50;
    else if (fleschReadingEase >= 30) score += 30;
    if (fleschKincaidGrade <= 8) score += 50;
    else if (fleschKincaidGrade <= 12) score += 30;

    let message = "";
    if (!easeOk) {
      message = `可讀性偏低：Flesch Reading Ease=${fleschReadingEase.toFixed(1)}，建議 > 30`;
    } else if (!gradeOk) {
      message = `閱讀難度偏高：Grade Level=${fleschKincaidGrade.toFixed(1)}，建議 < 12`;
    } else {
      message = `可讀性良好：Ease=${fleschReadingEase.toFixed(1)}, Grade=${fleschKincaidGrade.toFixed(1)}`;
    }

    return {
      name: "readability",
      passed,
      score,
      message,
      severity: !passed ? "warning" : "info",
    };
  }

  private checkMetaQuality(input: QualityGateInput): CheckResult {
    if (!input.meta) {
      return {
        name: "meta_quality",
        passed: false,
        score: 0,
        message: "缺少 Meta 資料",
        severity: "error",
      };
    }

    const titleLen = input.meta.seo.title.length;
    const descLen = input.meta.seo.description.length;

    const titleOk = titleLen >= 30 && titleLen <= 70;
    const descOk = descLen >= 100 && descLen <= 160;

    const passed = titleOk && descOk;
    let score = 0;
    if (titleOk) score += 50;
    if (descOk) score += 50;

    let message = "";
    if (!titleOk) {
      message = `Meta Title 長度不佳：${titleLen} 字元，建議 30-70 字元`;
    } else if (!descOk) {
      message = `Meta Description 長度不佳：${descLen} 字元，建議 100-160 字元`;
    } else {
      message = `Meta 資料良好：Title=${titleLen}字元, Description=${descLen}字元`;
    }

    return {
      name: "meta_quality",
      passed,
      score,
      message,
      severity: !passed ? "warning" : "info",
    };
  }

  private checkContentStructure(input: QualityGateInput): CheckResult {
    const html = input.writing.html;

    const paragraphs = (html.match(/<p[^>]*>/gi) || []).length;
    const lists = (html.match(/<(ul|ol)[^>]*>/gi) || []).length;
    const blockquotes = (html.match(/<blockquote[^>]*>/gi) || []).length;

    const hasEnoughParagraphs = paragraphs >= 5;
    const hasLists = lists >= 1;
    const passed = hasEnoughParagraphs;

    let score = 0;
    if (hasEnoughParagraphs) score += 60;
    if (hasLists) score += 25;
    if (blockquotes > 0) score += 15;

    let message = "";
    if (!hasEnoughParagraphs) {
      message = `段落數量不足：${paragraphs} 個，建議至少 5 個`;
    } else if (!hasLists) {
      message = `建議加入列表提升可讀性（目前 ${lists} 個）`;
    } else {
      message = `內容結構良好：${paragraphs} 段落, ${lists} 列表, ${blockquotes} 引用`;
    }

    return {
      name: "content_structure",
      passed,
      score,
      message,
      severity: !hasEnoughParagraphs ? "warning" : "info",
    };
  }

  private checkImageAltText(input: QualityGateInput): CheckResult {
    const html = input.writing.html;

    const imgTags = html.match(/<img[^>]*>/gi) || [];
    const imgsWithAlt = imgTags.filter((img) => /alt="[^"]+"/i.test(img));

    const totalImages = imgTags.length;
    const imagesWithAlt = imgsWithAlt.length;

    if (totalImages === 0) {
      return {
        name: "image_alt_text",
        passed: true,
        score: 80,
        message: "文章無圖片",
        severity: "info",
      };
    }

    const percentage = (imagesWithAlt / totalImages) * 100;
    const passed = percentage >= 80;

    let message = "";
    if (percentage < 100) {
      message = `部分圖片缺少 alt 文字：${imagesWithAlt}/${totalImages} (${percentage.toFixed(0)}%)`;
    } else {
      message = `所有圖片都有 alt 文字：${totalImages} 張`;
    }

    return {
      name: "image_alt_text",
      passed,
      score: percentage,
      message,
      severity: percentage < 80 ? "warning" : "info",
    };
  }

  private checkInternalLinks(input: QualityGateInput): CheckResult {
    const linkCount = input.writing.internalLinks?.length || 0;
    const minLinks = 2;
    const maxLinks = 10;

    const passed = linkCount >= minLinks;
    let score = 0;

    if (linkCount >= minLinks && linkCount <= maxLinks) {
      score = 100;
    } else if (linkCount > 0) {
      score = 50;
    }

    let message = "";
    if (linkCount < minLinks) {
      message = `內部連結不足：${linkCount} 個，建議至少 ${minLinks} 個`;
    } else if (linkCount > maxLinks) {
      message = `內部連結過多：${linkCount} 個，可能影響用戶體驗`;
    } else {
      message = `內部連結數量適中：${linkCount} 個`;
    }

    return {
      name: "internal_links",
      passed,
      score,
      message,
      severity: linkCount < minLinks ? "warning" : "info",
    };
  }

  private calculateTotalScore(checks: CheckResult[]): number {
    const weights: Record<string, number> = {
      word_count: 0.2,
      keyword_usage: 0.15,
      heading_structure: 0.15,
      readability: 0.1,
      meta_quality: 0.15,
      content_structure: 0.1,
      image_alt_text: 0.05,
      internal_links: 0.1,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const check of checks) {
      const weight = weights[check.name] || 0.1;
      weightedSum += check.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}

export default QualityGateAgent;
