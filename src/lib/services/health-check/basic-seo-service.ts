/**
 * 基礎 SEO 檢查服務
 * 負責檢查 robots.txt 和 sitemap 的存在性
 */

import { checkUrlExists } from "@/lib/utils/fetch-with-timeout";

export interface BasicSeoResult {
  robotsTxtExists: boolean;
  sitemapExists: boolean;
  sitemapUrl: string | null;
}

export class BasicSeoService {
  private timeout: number;

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout || 5000; // 預設 5 秒
  }

  /**
   * 執行基礎 SEO 檢查
   * @param url 網站 URL（會自動提取 domain）
   * @returns 基礎 SEO 檢查結果
   */
  async analyze(url: string): Promise<BasicSeoResult> {
    console.log(`[BasicSeoService] Checking ${url}...`);

    // 提取 base URL
    let baseUrl: string;
    try {
      const urlObj = new URL(url);
      baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      console.error("[BasicSeoService] Invalid URL:", url);
      return {
        robotsTxtExists: false,
        sitemapExists: false,
        sitemapUrl: null,
      };
    }

    // 並行檢查 robots.txt 和常見的 sitemap 位置
    const robotsUrl = `${baseUrl}/robots.txt`;
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/wp-sitemap.xml`, // WordPress 預設
      `${baseUrl}/sitemap/sitemap-index.xml`, // Yoast SEO
    ];

    // 並行檢查
    const [robotsExists, ...sitemapResults] = await Promise.all([
      checkUrlExists(robotsUrl, this.timeout),
      ...sitemapUrls.map((sitemapUrl) =>
        checkUrlExists(sitemapUrl, this.timeout).then((exists) => ({
          url: sitemapUrl,
          exists,
        })),
      ),
    ]);

    // 找到第一個存在的 sitemap
    const foundSitemap = sitemapResults.find((result) => result.exists);

    const result: BasicSeoResult = {
      robotsTxtExists: robotsExists,
      sitemapExists: !!foundSitemap,
      sitemapUrl: foundSitemap?.url || null,
    };

    console.log("[BasicSeoService] Results:", result);

    return result;
  }
}
