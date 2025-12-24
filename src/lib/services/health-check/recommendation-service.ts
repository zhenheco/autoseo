/**
 * 健康檢查建議生成服務
 * 使用 AI 生成具體的改善建議
 */

import { AIClient } from "@/lib/ai/ai-client";
import type {
  CoreWebVitals,
  LighthouseScores,
  MetaAnalysis,
  AiRecommendation,
} from "@/types/health-check";

interface HealthCheckData {
  url: string;
  coreWebVitals: CoreWebVitals;
  lighthouseScores: LighthouseScores;
  metaAnalysis: MetaAnalysis;
  robotsTxtExists: boolean;
  sitemapExists: boolean;
}

export class RecommendationService {
  private aiClient: AIClient;

  constructor() {
    this.aiClient = new AIClient({});
  }

  /**
   * 生成健康檢查建議
   * @param data 健康檢查數據
   * @returns AI 生成的建議列表
   */
  async generateRecommendations(
    data: HealthCheckData,
  ): Promise<AiRecommendation[]> {
    console.log(
      `[RecommendationService] Generating recommendations for ${data.url}...`,
    );

    const prompt = this.buildPrompt(data);

    try {
      const systemPrompt = `你是一位專業的 SEO 和網站效能優化專家。根據提供的網站健康檢查數據，生成具體且可執行的改善建議。

請以 JSON 格式回覆，格式如下：
{
  "recommendations": [
    {
      "category": "performance" | "seo" | "accessibility" | "best-practices",
      "priority": "high" | "medium" | "low",
      "title": "建議標題（簡短）",
      "description": "詳細說明和具體步驟",
      "estimatedImpact": "預估影響（例如：可提升 10-20 分）"
    }
  ]
}

重要規則：
1. 只根據實際發現的問題提供建議
2. 每個類別最多 2 個建議，總共不超過 5 個
3. 優先處理 high priority 問題
4. 建議必須具體可執行，不要泛泛而談`;

      const response = await this.aiClient.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        {
          model: "deepseek-chat",
          temperature: 0.3,
          format: "json",
        },
      );

      const content = response.content;

      // 解析 JSON 回應
      try {
        const parsed = JSON.parse(content);
        const recommendations: AiRecommendation[] =
          parsed.recommendations || [];

        console.log(
          `[RecommendationService] Generated ${recommendations.length} recommendations`,
        );

        return recommendations;
      } catch (parseError) {
        console.error(
          "[RecommendationService] Failed to parse AI response:",
          parseError,
        );
        return this.getFallbackRecommendations(data);
      }
    } catch (error) {
      console.error("[RecommendationService] AI call failed:", error);
      return this.getFallbackRecommendations(data);
    }
  }

  /**
   * 建構 AI prompt
   */
  private buildPrompt(data: HealthCheckData): string {
    const { coreWebVitals, lighthouseScores, metaAnalysis } = data;

    let prompt = `## 網站健康檢查報告

**網址**: ${data.url}

### Lighthouse 分數
- 效能分數: ${lighthouseScores.performance_score ?? "N/A"}/100
- SEO 分數: ${lighthouseScores.seo_score ?? "N/A"}/100
- 無障礙分數: ${lighthouseScores.accessibility_score ?? "N/A"}/100
- 最佳實踐分數: ${lighthouseScores.best_practices_score ?? "N/A"}/100

### Core Web Vitals
- LCP (最大內容繪製): ${coreWebVitals.lcp_ms ? `${coreWebVitals.lcp_ms}ms` : "N/A"}
- INP (互動至下一次繪製): ${coreWebVitals.inp_ms ? `${coreWebVitals.inp_ms}ms` : "N/A"}
- CLS (累積版面配置位移): ${coreWebVitals.cls ?? "N/A"}
- FCP (首次內容繪製): ${coreWebVitals.fcp_ms ? `${coreWebVitals.fcp_ms}ms` : "N/A"}
- TTFB (首位元組時間): ${coreWebVitals.ttfb_ms ? `${coreWebVitals.ttfb_ms}ms` : "N/A"}

### Meta 標籤分析
`;

    // 添加 Meta 分析問題
    if (metaAnalysis.title?.issues?.length) {
      prompt += `\n**Title 問題**: ${metaAnalysis.title.issues.join(", ")}`;
    }
    if (metaAnalysis.description?.issues?.length) {
      prompt += `\n**Description 問題**: ${metaAnalysis.description.issues.join(", ")}`;
    }
    if (metaAnalysis.canonical?.issues?.length) {
      prompt += `\n**Canonical 問題**: ${metaAnalysis.canonical.issues.join(", ")}`;
    }
    if (metaAnalysis.ogTags?.issues?.length) {
      prompt += `\n**Open Graph 問題**: ${metaAnalysis.ogTags.issues.join(", ")}`;
    }

    // 添加基礎 SEO 狀態
    prompt += `\n\n### 基礎 SEO
- robots.txt: ${data.robotsTxtExists ? "✅ 存在" : "❌ 不存在"}
- sitemap: ${data.sitemapExists ? "✅ 存在" : "❌ 不存在"}`;

    prompt += `\n\n請根據以上數據，生成具體的改善建議。`;

    return prompt;
  }

  /**
   * 當 AI 失敗時，根據數據生成基本建議
   */
  private getFallbackRecommendations(
    data: HealthCheckData,
  ): AiRecommendation[] {
    const recommendations: AiRecommendation[] = [];

    // 效能建議
    if (
      data.lighthouseScores.performance_score !== null &&
      data.lighthouseScores.performance_score < 50
    ) {
      recommendations.push({
        category: "performance",
        priority: "high",
        title: "優化網站載入效能",
        description:
          "您的效能分數較低，建議：1) 壓縮和優化圖片 2) 啟用 CDN 3) 減少 JavaScript 和 CSS 檔案大小 4) 使用瀏覽器快取",
        estimatedImpact: "可大幅提升使用者體驗和 SEO 排名",
      });
    }

    // SEO 建議
    if (
      data.metaAnalysis.title?.issues?.length ||
      data.metaAnalysis.description?.issues?.length
    ) {
      recommendations.push({
        category: "seo",
        priority: "high",
        title: "優化 Meta 標籤",
        description:
          "請確保每個頁面都有獨特且描述性的 title 和 meta description。Title 建議 30-60 字元，Description 建議 70-160 字元。",
        estimatedImpact: "改善搜尋結果的點擊率",
      });
    }

    // robots.txt 建議
    if (!data.robotsTxtExists) {
      recommendations.push({
        category: "seo",
        priority: "medium",
        title: "新增 robots.txt",
        description:
          "建議新增 robots.txt 檔案來指導搜尋引擎如何抓取您的網站。這有助於控制哪些頁面應該被索引。",
        estimatedImpact: "改善搜尋引擎爬蟲效率",
      });
    }

    // sitemap 建議
    if (!data.sitemapExists) {
      recommendations.push({
        category: "seo",
        priority: "medium",
        title: "新增 XML Sitemap",
        description:
          "建議建立 XML sitemap 並提交到 Google Search Console。這有助於搜尋引擎更快地發現和索引您的頁面。",
        estimatedImpact: "加速新頁面被索引的速度",
      });
    }

    return recommendations.slice(0, 5);
  }
}
