/**
 * 網站健康檢查服務
 * 整合 Google PageSpeed Insights API、Meta 標籤分析、基礎 SEO 檢查和 AI 建議生成
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AIClient } from "@/lib/ai/ai-client";
import {
  HealthCheckResult,
  HealthCheckStatus,
  DeviceType,
  CoreWebVitals,
  LighthouseScores,
  MetaAnalysisResult,
  StructuredDataResult,
  BasicSeoResult,
  Recommendation,
  PageSpeedApiResponse,
  getVitalRating,
  VITAL_THRESHOLDS,
} from "@/types/health-check";

// ============================================================
// 配置與常數
// ============================================================

/** Meta 標籤長度限制 */
const META_LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
} as const;

/** PageSpeed API 端點 */
const PAGESPEED_API_URL =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// ============================================================
// 型別定義
// ============================================================

export interface HealthCheckOptions {
  websiteId: string;
  companyId: string;
  url: string;
  device: DeviceType;
  includeAIRecommendations: boolean;
}

interface HealthCheckData {
  pageSpeedResult: PageSpeedApiResponse | null;
  metaAnalysis: MetaAnalysisResult;
  structuredData: StructuredDataResult;
  basicSeo: BasicSeoResult;
}

// ============================================================
// 主服務類別
// ============================================================

export class WebsiteHealthService {
  private supabase: SupabaseClient;
  private aiClient: AIClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.aiClient = new AIClient({
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
    });
  }

  /**
   * 執行完整健康檢查
   */
  async runHealthCheck(
    options: HealthCheckOptions,
  ): Promise<HealthCheckResult> {
    const checkId = await this.createCheckRecord(options);

    try {
      // 更新狀態為處理中
      await this.updateCheckStatus(checkId, "processing");

      // 並行執行各項檢查
      const [pageSpeedResult, metaAnalysis, structuredData, basicSeo] =
        await Promise.all([
          this.callPageSpeedAPI(options.url, options.device).catch((error) => {
            console.error("[HealthCheck] PageSpeed API 失敗:", error);
            return null;
          }),
          this.analyzeMetaTags(options.url),
          this.checkStructuredData(options.url),
          this.checkBasicSeo(options.url),
        ]);

      // 生成 AI 建議（如果啟用）
      let recommendations: Recommendation[] = [];
      if (options.includeAIRecommendations) {
        recommendations = await this.generateAIRecommendations({
          pageSpeedResult,
          metaAnalysis,
          structuredData,
          basicSeo,
        });
      }

      // 轉換結果
      const result = this.buildResult(checkId, options, {
        pageSpeedResult,
        metaAnalysis,
        structuredData,
        basicSeo,
        recommendations,
      });

      // 儲存結果
      await this.saveResult(checkId, result);

      return result;
    } catch (error) {
      await this.markCheckFailed(
        checkId,
        error instanceof Error ? error.message : "未知錯誤",
      );
      throw error;
    }
  }

  // ============================================================
  // 資料庫操作
  // ============================================================

  /**
   * 建立健檢記錄
   */
  private async createCheckRecord(
    options: HealthCheckOptions,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("website_health_checks")
      .insert({
        website_id: options.websiteId,
        company_id: options.companyId,
        url_checked: options.url,
        device_type: options.device,
        status: "pending",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`建立健檢記錄失敗: ${error.message}`);
    }

    return data.id;
  }

  /**
   * 更新健檢狀態
   */
  private async updateCheckStatus(
    checkId: string,
    status: HealthCheckStatus,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("website_health_checks")
      .update({ status })
      .eq("id", checkId);

    if (error) {
      console.error("[HealthCheck] 更新狀態失敗:", error);
    }
  }

  /**
   * 儲存健檢結果
   */
  private async saveResult(
    checkId: string,
    result: HealthCheckResult,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("website_health_checks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        // Core Web Vitals
        lcp_score: result.coreWebVitals.lcp.value,
        inp_score: result.coreWebVitals.inp.value,
        cls_score: result.coreWebVitals.cls.value,
        fcp_score: result.coreWebVitals.fcp.value,
        ttfb_score: result.coreWebVitals.ttfb.value,
        // Lighthouse 分數
        performance_score: result.scores.performance,
        accessibility_score: result.scores.accessibility,
        seo_score: result.scores.seo,
        best_practices_score: result.scores.bestPractices,
        // JSONB 欄位
        meta_analysis: result.metaAnalysis,
        structured_data: result.structuredData,
        ai_recommendations: result.recommendations,
        // 基礎 SEO
        robots_txt_exists: result.basicSeo.robotsTxt.exists,
        robots_txt_issues: result.basicSeo.robotsTxt.issues,
        sitemap_exists: result.basicSeo.sitemap.exists,
        sitemap_url: result.basicSeo.sitemap.url,
        sitemap_issues: result.basicSeo.sitemap.issues,
      })
      .eq("id", checkId);

    if (error) {
      throw new Error(`儲存健檢結果失敗: ${error.message}`);
    }
  }

  /**
   * 標記健檢失敗
   */
  private async markCheckFailed(
    checkId: string,
    errorMessage: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("website_health_checks")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkId);

    if (error) {
      console.error("[HealthCheck] 更新失敗狀態失敗:", error);
    }
  }

  // ============================================================
  // PageSpeed API
  // ============================================================

  /**
   * 呼叫 Google PageSpeed Insights API
   */
  private async callPageSpeedAPI(
    url: string,
    device: DeviceType,
  ): Promise<PageSpeedApiResponse> {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

    const params = new URLSearchParams({
      url,
      strategy: device,
      category: "performance",
    });
    params.append("category", "accessibility");
    params.append("category", "seo");
    params.append("category", "best-practices");

    if (apiKey) {
      params.append("key", apiKey);
    }

    const apiUrl = `${PAGESPEED_API_URL}?${params.toString()}`;

    console.log(`[HealthCheck] 呼叫 PageSpeed API: ${url} (${device})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 秒超時

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `PageSpeed API 錯誤 (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as PageSpeedApiResponse;
      console.log("[HealthCheck] PageSpeed API 成功");

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("PageSpeed API 超時（60 秒）");
      }
      throw error;
    }
  }

  // ============================================================
  // Meta 標籤分析
  // ============================================================

  /**
   * 分析頁面 Meta 標籤
   */
  private async analyzeMetaTags(url: string): Promise<MetaAnalysisResult> {
    try {
      console.log(`[HealthCheck] 分析 Meta 標籤: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; 1waySEO-HealthCheck/1.0; +https://1wayseo.com)",
        },
      });

      if (!response.ok) {
        throw new Error(`無法存取網頁: ${response.status}`);
      }

      const html = await response.text();
      return this.parseMetaTags(html, url);
    } catch (error) {
      console.error("[HealthCheck] Meta 標籤分析失敗:", error);
      return this.createEmptyMetaAnalysis();
    }
  }

  /**
   * 解析 HTML 中的 Meta 標籤
   */
  private parseMetaTags(html: string, pageUrl: string): MetaAnalysisResult {
    const result: MetaAnalysisResult = {
      title: { exists: false, issues: [] },
      description: { exists: false, issues: [] },
      ogTitle: { exists: false, issues: [] },
      ogDescription: { exists: false, issues: [] },
      ogImage: { exists: false, issues: [] },
      canonical: { exists: false, issues: [] },
      robots: { exists: false, issues: [] },
      viewport: { exists: false, issues: [] },
      totalIssues: 0,
    };

    // 解析 title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      const content = titleMatch[1].trim();
      result.title = {
        exists: true,
        content,
        length: content.length,
        issues: this.validateTitle(content),
      };
    } else {
      result.title.issues.push("缺少 <title> 標籤");
    }

    // 解析 meta description
    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
      );
    if (descMatch) {
      const content = descMatch[1].trim();
      result.description = {
        exists: true,
        content,
        length: content.length,
        issues: this.validateDescription(content),
      };
    } else {
      result.description.issues.push("缺少 meta description");
    }

    // 解析 OG tags
    result.ogTitle = this.extractMetaProperty(html, "og:title");
    result.ogDescription = this.extractMetaProperty(html, "og:description");
    result.ogImage = this.extractMetaProperty(html, "og:image");

    // 驗證 og:image URL
    if (result.ogImage.exists && result.ogImage.content) {
      result.ogImage.url = result.ogImage.content;
      if (!result.ogImage.content.startsWith("http")) {
        result.ogImage.issues.push("og:image 應使用絕對 URL");
      }
    }

    // 解析 canonical
    const canonicalMatch = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
    );
    if (canonicalMatch) {
      const url = canonicalMatch[1].trim();
      result.canonical = {
        exists: true,
        url,
        content: url,
        issues: [],
      };
      if (url !== pageUrl && !url.endsWith("/") && pageUrl !== url + "/") {
        // 允許尾隨斜線差異
        result.canonical.issues.push("canonical URL 與當前頁面不符");
      }
    } else {
      result.canonical.issues.push("缺少 canonical 標籤");
    }

    // 解析 robots
    const robotsMatch = html.match(
      /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    );
    if (robotsMatch) {
      const content = robotsMatch[1].trim().toLowerCase();
      result.robots = {
        exists: true,
        content,
        issues: [],
      };
      if (content.includes("noindex")) {
        result.robots.issues.push("頁面設定為 noindex，將不會被搜尋引擎索引");
      }
    }

    // 解析 viewport
    const viewportMatch = html.match(
      /<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    );
    if (viewportMatch) {
      result.viewport = {
        exists: true,
        content: viewportMatch[1].trim(),
        issues: [],
      };
    } else {
      result.viewport.issues.push("缺少 viewport 標籤，可能影響行動裝置顯示");
    }

    // 計算總問題數
    result.totalIssues = Object.values(result)
      .filter(
        (v): v is { issues: string[] } =>
          typeof v === "object" && "issues" in v,
      )
      .reduce((sum, item) => sum + item.issues.length, 0);

    return result;
  }

  /**
   * 提取 meta property 標籤
   */
  private extractMetaProperty(
    html: string,
    property: string,
  ): { exists: boolean; content?: string; issues: string[] } {
    const match =
      html.match(
        new RegExp(
          `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`,
          "i",
        ),
      ) ||
      html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["'][^>]*>`,
          "i",
        ),
      );

    if (match) {
      return {
        exists: true,
        content: match[1].trim(),
        issues: [],
      };
    }

    return {
      exists: false,
      issues: [`缺少 ${property}`],
    };
  }

  /**
   * 驗證 title
   */
  private validateTitle(title: string): string[] {
    const issues: string[] = [];
    if (title.length < META_LIMITS.title.min) {
      issues.push(
        `標題過短（${title.length} 字元），建議至少 ${META_LIMITS.title.min} 字元`,
      );
    }
    if (title.length > META_LIMITS.title.max) {
      issues.push(
        `標題過長（${title.length} 字元），建議不超過 ${META_LIMITS.title.max} 字元`,
      );
    }
    return issues;
  }

  /**
   * 驗證 description
   */
  private validateDescription(description: string): string[] {
    const issues: string[] = [];
    if (description.length < META_LIMITS.description.min) {
      issues.push(
        `描述過短（${description.length} 字元），建議至少 ${META_LIMITS.description.min} 字元`,
      );
    }
    if (description.length > META_LIMITS.description.max) {
      issues.push(
        `描述過長（${description.length} 字元），建議不超過 ${META_LIMITS.description.max} 字元`,
      );
    }
    return issues;
  }

  /**
   * 建立空的 Meta 分析結果
   */
  private createEmptyMetaAnalysis(): MetaAnalysisResult {
    return {
      title: { exists: false, issues: ["無法分析"] },
      description: { exists: false, issues: ["無法分析"] },
      ogTitle: { exists: false, issues: ["無法分析"] },
      ogDescription: { exists: false, issues: ["無法分析"] },
      ogImage: { exists: false, issues: ["無法分析"] },
      canonical: { exists: false, issues: ["無法分析"] },
      robots: { exists: false, issues: ["無法分析"] },
      viewport: { exists: false, issues: ["無法分析"] },
      totalIssues: 0,
    };
  }

  // ============================================================
  // 結構化資料檢查
  // ============================================================

  /**
   * 檢查頁面的結構化資料
   */
  private async checkStructuredData(
    url: string,
  ): Promise<StructuredDataResult> {
    try {
      console.log(`[HealthCheck] 檢查結構化資料: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; 1waySEO-HealthCheck/1.0; +https://1wayseo.com)",
        },
      });

      if (!response.ok) {
        return {
          hasJsonLd: false,
          typesFound: [],
          issues: ["無法存取網頁"],
        };
      }

      const html = await response.text();
      return this.parseStructuredData(html);
    } catch (error) {
      console.error("[HealthCheck] 結構化資料檢查失敗:", error);
      return {
        hasJsonLd: false,
        typesFound: [],
        issues: ["檢查過程發生錯誤"],
      };
    }
  }

  /**
   * 解析結構化資料
   */
  private parseStructuredData(html: string): StructuredDataResult {
    const result: StructuredDataResult = {
      hasJsonLd: false,
      typesFound: [],
      issues: [],
      rawData: [],
    };

    // 尋找 JSON-LD script 標籤
    const jsonLdMatches = html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );

    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        result.hasJsonLd = true;
        result.rawData?.push(jsonData);

        // 提取 @type
        if (jsonData["@type"]) {
          const types = Array.isArray(jsonData["@type"])
            ? jsonData["@type"]
            : [jsonData["@type"]];
          result.typesFound.push(...types);
        }

        // 檢查 @graph 結構
        if (jsonData["@graph"] && Array.isArray(jsonData["@graph"])) {
          for (const item of jsonData["@graph"]) {
            if (item["@type"]) {
              const types = Array.isArray(item["@type"])
                ? item["@type"]
                : [item["@type"]];
              result.typesFound.push(...types);
            }
          }
        }
      } catch {
        result.issues.push("JSON-LD 語法錯誤");
      }
    }

    // 去重
    result.typesFound = [...new Set(result.typesFound)];

    if (!result.hasJsonLd) {
      result.issues.push("缺少 JSON-LD 結構化資料");
    }

    return result;
  }

  // ============================================================
  // 基礎 SEO 檢查
  // ============================================================

  /**
   * 檢查 robots.txt 和 sitemap
   */
  private async checkBasicSeo(url: string): Promise<BasicSeoResult> {
    const baseUrl = new URL(url).origin;

    const [robotsTxt, sitemap] = await Promise.all([
      this.checkRobotsTxt(baseUrl),
      this.checkSitemap(baseUrl),
    ]);

    return { robotsTxt, sitemap };
  }

  /**
   * 檢查 robots.txt
   */
  private async checkRobotsTxt(
    baseUrl: string,
  ): Promise<{ exists: boolean; issues: string[]; content?: string }> {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      console.log(`[HealthCheck] 檢查 robots.txt: ${robotsUrl}`);

      const response = await fetch(robotsUrl);

      if (!response.ok) {
        return {
          exists: false,
          issues: ["robots.txt 不存在或無法存取"],
        };
      }

      const content = await response.text();
      const issues: string[] = [];

      // 基本檢查
      if (!content.toLowerCase().includes("user-agent")) {
        issues.push("robots.txt 缺少 User-agent 指令");
      }

      if (!content.toLowerCase().includes("sitemap")) {
        issues.push("robots.txt 中未指定 Sitemap 位置");
      }

      return {
        exists: true,
        issues,
        content: content.substring(0, 500), // 只保留前 500 字元
      };
    } catch (error) {
      console.error("[HealthCheck] robots.txt 檢查失敗:", error);
      return {
        exists: false,
        issues: ["robots.txt 檢查過程發生錯誤"],
      };
    }
  }

  /**
   * 檢查 sitemap
   */
  private async checkSitemap(
    baseUrl: string,
  ): Promise<{
    exists: boolean;
    url?: string;
    issues: string[];
    urlCount?: number;
  }> {
    const possibleUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ];

    for (const sitemapUrl of possibleUrls) {
      try {
        console.log(`[HealthCheck] 檢查 sitemap: ${sitemapUrl}`);
        const response = await fetch(sitemapUrl);

        if (response.ok) {
          const content = await response.text();
          const issues: string[] = [];

          // 檢查是否為有效 XML
          if (
            !content.includes("<?xml") &&
            !content.includes("<urlset") &&
            !content.includes("<sitemapindex")
          ) {
            issues.push("Sitemap 格式可能不正確");
          }

          // 計算 URL 數量
          const urlCount = (content.match(/<loc>/g) || []).length;

          return {
            exists: true,
            url: sitemapUrl,
            issues,
            urlCount,
          };
        }
      } catch {
        // 繼續嘗試下一個 URL
      }
    }

    return {
      exists: false,
      issues: ["未找到 sitemap.xml"],
    };
  }

  // ============================================================
  // AI 建議生成
  // ============================================================

  /**
   * 生成 AI 改善建議
   */
  private async generateAIRecommendations(
    data: HealthCheckData,
  ): Promise<Recommendation[]> {
    try {
      console.log("[HealthCheck] 生成 AI 建議");

      const prompt = this.buildRecommendationPrompt(data);

      const response = await this.aiClient.complete(prompt, {
        model: "deepseek-chat",
        temperature: 0.3,
        maxTokens: 2000,
        format: "json",
      });

      const parsed = JSON.parse(response.content) as {
        recommendations: Recommendation[];
      };

      // 確保每個建議都有 id
      const recommendations = (parsed.recommendations || []).map(
        (rec, index) => ({
          ...rec,
          id: rec.id || `rec-${index + 1}`,
        }),
      );

      return recommendations;
    } catch (error) {
      console.error("[HealthCheck] AI 建議生成失敗:", error);
      return [];
    }
  }

  /**
   * 建構 AI prompt
   */
  private buildRecommendationPrompt(data: HealthCheckData): string {
    const scores = data.pageSpeedResult?.lighthouseResult?.categories;
    const vitals = data.pageSpeedResult?.lighthouseResult?.audits;

    return `你是一位專業的 SEO 和網站效能顧問。請根據以下網站健檢數據，提供 3-5 條具體可行的改善建議。

## 健檢數據

### Lighthouse 分數
- 效能: ${scores?.performance?.score ? Math.round(scores.performance.score * 100) : "無資料"}
- 無障礙: ${scores?.accessibility?.score ? Math.round(scores.accessibility.score * 100) : "無資料"}
- SEO: ${scores?.seo?.score ? Math.round(scores.seo.score * 100) : "無資料"}
- 最佳實踐: ${scores?.["best-practices"]?.score ? Math.round(scores["best-practices"].score * 100) : "無資料"}

### Core Web Vitals
- LCP: ${vitals?.["largest-contentful-paint"]?.numericValue ? Math.round(vitals["largest-contentful-paint"].numericValue) + " ms" : "無資料"}
- INP: ${vitals?.["interaction-to-next-paint"]?.numericValue ? Math.round(vitals["interaction-to-next-paint"].numericValue) + " ms" : "無資料"}
- CLS: ${vitals?.["cumulative-layout-shift"]?.numericValue?.toFixed(3) || "無資料"}

### Meta 標籤問題
${data.metaAnalysis.totalIssues > 0 ? JSON.stringify(data.metaAnalysis, null, 2) : "無明顯問題"}

### 結構化資料
${data.structuredData.hasJsonLd ? `已有 JSON-LD，類型: ${data.structuredData.typesFound.join(", ")}` : "缺少結構化資料"}

### 基礎 SEO
- robots.txt: ${data.basicSeo.robotsTxt.exists ? "存在" : "缺少"}
- sitemap: ${data.basicSeo.sitemap.exists ? data.basicSeo.sitemap.url : "缺少"}

## 輸出要求

請以 JSON 格式輸出，結構如下：

{
  "recommendations": [
    {
      "id": "rec-1",
      "priority": "high" | "medium" | "low",
      "category": "performance" | "seo" | "accessibility" | "best-practices",
      "title": "簡短的建議標題",
      "description": "詳細說明問題和解決方案",
      "impact": "高" | "中" | "低",
      "effort": "高" | "中" | "低",
      "steps": ["步驟1", "步驟2", "..."]
    }
  ]
}

注意：
1. 優先處理影響最大的問題
2. 建議要具體可執行
3. 使用繁體中文
4. 不要重複相似的建議`;
  }

  // ============================================================
  // 結果組裝
  // ============================================================

  /**
   * 組裝完整的健檢結果
   */
  private buildResult(
    checkId: string,
    options: HealthCheckOptions,
    data: HealthCheckData & { recommendations: Recommendation[] },
  ): HealthCheckResult {
    const now = new Date().toISOString();

    // 解析 Core Web Vitals
    const coreWebVitals = this.extractCoreWebVitals(data.pageSpeedResult);

    // 解析 Lighthouse 分數
    const scores = this.extractLighthouseScores(data.pageSpeedResult);

    return {
      id: checkId,
      websiteId: options.websiteId,
      companyId: options.companyId,
      status: "completed",
      urlChecked: options.url,
      deviceType: options.device,
      coreWebVitals,
      scores,
      metaAnalysis: data.metaAnalysis,
      structuredData: data.structuredData,
      basicSeo: data.basicSeo,
      recommendations: data.recommendations,
      createdAt: now,
      completedAt: now,
    };
  }

  /**
   * 提取 Core Web Vitals
   */
  private extractCoreWebVitals(
    pageSpeedResult: PageSpeedApiResponse | null,
  ): CoreWebVitals {
    const audits = pageSpeedResult?.lighthouseResult?.audits;
    const fieldData = pageSpeedResult?.loadingExperience?.metrics;

    // 優先使用 field data（真實用戶數據），否則使用 lab data
    const getLcpValue = () => {
      if (fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile) {
        return fieldData.LARGEST_CONTENTFUL_PAINT_MS.percentile;
      }
      return audits?.["largest-contentful-paint"]?.numericValue || 0;
    };

    const getInpValue = () => {
      if (fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile) {
        return fieldData.INTERACTION_TO_NEXT_PAINT.percentile;
      }
      return audits?.["interaction-to-next-paint"]?.numericValue || 0;
    };

    const getClsValue = () => {
      if (fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile) {
        return fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100; // 轉換為 0-1 範圍
      }
      return audits?.["cumulative-layout-shift"]?.numericValue || 0;
    };

    const getFcpValue = () => {
      if (fieldData?.FIRST_CONTENTFUL_PAINT_MS?.percentile) {
        return fieldData.FIRST_CONTENTFUL_PAINT_MS.percentile;
      }
      return audits?.["first-contentful-paint"]?.numericValue || 0;
    };

    const getTtfbValue = () => {
      if (fieldData?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile) {
        return fieldData.EXPERIMENTAL_TIME_TO_FIRST_BYTE.percentile;
      }
      return audits?.["server-response-time"]?.numericValue || 0;
    };

    const lcpValue = getLcpValue();
    const inpValue = getInpValue();
    const clsValue = getClsValue();
    const fcpValue = getFcpValue();
    const ttfbValue = getTtfbValue();

    return {
      lcp: {
        value: lcpValue,
        rating: getVitalRating("lcp", lcpValue),
        displayValue: `${(lcpValue / 1000).toFixed(1)} 秒`,
      },
      inp: {
        value: inpValue,
        rating: getVitalRating("inp", inpValue),
        displayValue: `${Math.round(inpValue)} ms`,
      },
      cls: {
        value: clsValue,
        rating: getVitalRating("cls", clsValue),
        displayValue: clsValue.toFixed(3),
      },
      fcp: {
        value: fcpValue,
        rating: getVitalRating("fcp", fcpValue),
        displayValue: `${(fcpValue / 1000).toFixed(1)} 秒`,
      },
      ttfb: {
        value: ttfbValue,
        rating: getVitalRating("ttfb", ttfbValue),
        displayValue: `${Math.round(ttfbValue)} ms`,
      },
    };
  }

  /**
   * 提取 Lighthouse 分數
   */
  private extractLighthouseScores(
    pageSpeedResult: PageSpeedApiResponse | null,
  ): LighthouseScores {
    const categories = pageSpeedResult?.lighthouseResult?.categories;

    return {
      performance: categories?.performance?.score
        ? Math.round(categories.performance.score * 100)
        : 0,
      accessibility: categories?.accessibility?.score
        ? Math.round(categories.accessibility.score * 100)
        : 0,
      seo: categories?.seo?.score ? Math.round(categories.seo.score * 100) : 0,
      bestPractices: categories?.["best-practices"]?.score
        ? Math.round(categories["best-practices"].score * 100)
        : 0,
    };
  }

  // ============================================================
  // 公開查詢方法
  // ============================================================

  /**
   * 取得最新的健檢結果
   */
  async getLatestHealthCheck(
    websiteId: string,
  ): Promise<HealthCheckResult | null> {
    const { data, error } = await this.supabase
      .from("website_health_checks")
      .select("*")
      .eq("website_id", websiteId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbRowToResult(data);
  }

  /**
   * 取得健檢歷史
   */
  async getHealthCheckHistory(
    websiteId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ checks: HealthCheckResult[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const { data, error, count } = await this.supabase
      .from("website_health_checks")
      .select("*", { count: "exact" })
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`查詢健檢歷史失敗: ${error.message}`);
    }

    return {
      checks: (data || []).map((row) => this.mapDbRowToResult(row)),
      total: count || 0,
    };
  }

  /**
   * 將資料庫記錄轉換為結果物件
   */
  private mapDbRowToResult(row: Record<string, unknown>): HealthCheckResult {
    return {
      id: row.id as string,
      websiteId: row.website_id as string,
      companyId: row.company_id as string,
      status: row.status as HealthCheckStatus,
      urlChecked: row.url_checked as string,
      deviceType: row.device_type as DeviceType,
      coreWebVitals: {
        lcp: {
          value: (row.lcp_score as number) || 0,
          rating: getVitalRating("lcp", (row.lcp_score as number) || 0),
        },
        inp: {
          value: (row.inp_score as number) || 0,
          rating: getVitalRating("inp", (row.inp_score as number) || 0),
        },
        cls: {
          value: (row.cls_score as number) || 0,
          rating: getVitalRating("cls", (row.cls_score as number) || 0),
        },
        fcp: {
          value: (row.fcp_score as number) || 0,
          rating: getVitalRating("fcp", (row.fcp_score as number) || 0),
        },
        ttfb: {
          value: (row.ttfb_score as number) || 0,
          rating: getVitalRating("ttfb", (row.ttfb_score as number) || 0),
        },
      },
      scores: {
        performance: (row.performance_score as number) || 0,
        accessibility: (row.accessibility_score as number) || 0,
        seo: (row.seo_score as number) || 0,
        bestPractices: (row.best_practices_score as number) || 0,
      },
      metaAnalysis:
        (row.meta_analysis as MetaAnalysisResult) ||
        this.createEmptyMetaAnalysis(),
      structuredData: (row.structured_data as StructuredDataResult) || {
        hasJsonLd: false,
        typesFound: [],
        issues: [],
      },
      basicSeo: {
        robotsTxt: {
          exists: (row.robots_txt_exists as boolean) || false,
          issues: (row.robots_txt_issues as string[]) || [],
        },
        sitemap: {
          exists: (row.sitemap_exists as boolean) || false,
          url: row.sitemap_url as string | undefined,
          issues: (row.sitemap_issues as string[]) || [],
        },
      },
      recommendations: (row.ai_recommendations as Recommendation[]) || [],
      errorMessage: row.error_message as string | undefined,
      createdAt: row.created_at as string,
      startedAt: row.started_at as string | undefined,
      completedAt: row.completed_at as string | undefined,
    };
  }
}
