/**
 * Meta 標籤分析服務
 * 負責抓取網頁並分析 SEO 相關的 meta 標籤
 */

import {
  fetchTextWithTimeout,
  FetchWithTimeoutOptions,
} from "@/lib/utils/fetch-with-timeout";
import type { MetaAnalysis } from "@/types/health-check";

export class MetaAnalysisService {
  private timeout: number;

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout || 10000; // 預設 10 秒
  }

  /**
   * 分析網頁的 Meta 標籤
   * @param url 要分析的網頁 URL
   * @returns Meta 標籤分析結果
   */
  async analyze(url: string): Promise<MetaAnalysis> {
    console.log(`[MetaAnalysisService] Analyzing ${url}...`);

    const fetchOptions: FetchWithTimeoutOptions = {
      timeout: this.timeout,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEOBot/1.0; +https://1wayseo.com/bot)",
        Accept: "text/html",
      },
    };

    try {
      const html = await fetchTextWithTimeout(url, fetchOptions);
      return this.parseHtml(html, url);
    } catch (error) {
      console.error("[MetaAnalysisService] Error fetching URL:", error);
      // 返回空結果而不是拋出錯誤
      return {
        title: {
          content: null,
          length: 0,
          issues: ["無法抓取網頁內容"],
        },
        description: {
          content: null,
          length: 0,
          issues: ["無法抓取網頁內容"],
        },
      };
    }
  }

  /**
   * 解析 HTML 並提取 Meta 標籤
   */
  private parseHtml(html: string, url: string): MetaAnalysis {
    const result: MetaAnalysis = {};

    // 提取 Title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleContent = titleMatch?.[1]?.trim() || null;
    const titleLength = titleContent?.length || 0;
    const titleIssues: string[] = [];

    if (!titleContent) {
      titleIssues.push("缺少 <title> 標籤");
    } else {
      if (titleLength < 30) {
        titleIssues.push(`標題太短（${titleLength} 字元），建議 30-60 字元`);
      } else if (titleLength > 60) {
        titleIssues.push(`標題太長（${titleLength} 字元），建議 30-60 字元`);
      }
    }

    result.title = {
      content: titleContent,
      length: titleLength,
      issues: titleIssues,
    };

    // 提取 Description
    const descMatch =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
      );
    const descContent = descMatch?.[1]?.trim() || null;
    const descLength = descContent?.length || 0;
    const descIssues: string[] = [];

    if (!descContent) {
      descIssues.push("缺少 meta description");
    } else {
      if (descLength < 70) {
        descIssues.push(`描述太短（${descLength} 字元），建議 70-160 字元`);
      } else if (descLength > 160) {
        descIssues.push(`描述太長（${descLength} 字元），建議 70-160 字元`);
      }
    }

    result.description = {
      content: descContent,
      length: descLength,
      issues: descIssues,
    };

    // 提取 Canonical URL
    const canonicalMatch =
      html.match(
        /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
      ) ||
      html.match(
        /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i,
      );
    const canonicalUrl = canonicalMatch?.[1]?.trim() || null;
    const canonicalIssues: string[] = [];

    if (!canonicalUrl) {
      canonicalIssues.push("缺少 canonical 標籤");
    } else {
      // 檢查 canonical URL 是否與當前 URL 匹配
      try {
        const currentUrl = new URL(url);
        const canonical = new URL(canonicalUrl, url);
        if (
          currentUrl.pathname !== canonical.pathname &&
          currentUrl.href !== canonical.href
        ) {
          canonicalIssues.push(
            `Canonical URL (${canonicalUrl}) 與當前 URL 不同，請確認是否正確`,
          );
        }
      } catch {
        canonicalIssues.push("Canonical URL 格式無效");
      }
    }

    result.canonical = {
      url: canonicalUrl,
      issues: canonicalIssues,
    };

    // 提取 Open Graph 標籤
    const ogTitle =
      this.extractMetaContent(html, 'property="og:title"') ||
      this.extractMetaContent(html, "property='og:title'");
    const ogDesc =
      this.extractMetaContent(html, 'property="og:description"') ||
      this.extractMetaContent(html, "property='og:description'");
    const ogImage =
      this.extractMetaContent(html, 'property="og:image"') ||
      this.extractMetaContent(html, "property='og:image'");
    const ogIssues: string[] = [];

    if (!ogTitle) ogIssues.push("缺少 og:title");
    if (!ogDesc) ogIssues.push("缺少 og:description");
    if (!ogImage) ogIssues.push("缺少 og:image（社群分享時會沒有預覽圖）");

    result.ogTags = {
      title: ogTitle,
      description: ogDesc,
      image: ogImage,
      issues: ogIssues,
    };

    console.log("[MetaAnalysisService] Analysis complete:", {
      hasTitle: !!titleContent,
      hasDescription: !!descContent,
      hasCanonical: !!canonicalUrl,
      hasOgTags: !!(ogTitle || ogDesc || ogImage),
    });

    return result;
  }

  /**
   * 輔助函數：從 HTML 中提取 meta content
   */
  private extractMetaContent(html: string, property: string): string | null {
    // 嘗試 property content 順序
    const pattern1 = new RegExp(
      `<meta[^>]*${property}[^>]*content=["']([^"']*)["'][^>]*>`,
      "i",
    );
    // 嘗試 content property 順序
    const pattern2 = new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*${property}[^>]*>`,
      "i",
    );

    const match = html.match(pattern1) || html.match(pattern2);
    return match?.[1]?.trim() || null;
  }
}
