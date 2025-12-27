/**
 * 搜尋引擎 Ping 服務
 * 用於通知 Google/Bing 更新 sitemap
 */

import type { PingResult } from "./types";

// Ping URLs
const GOOGLE_PING_URL = "https://www.google.com/ping";
const BING_PING_URL = "https://www.bing.com/ping";

// 預設 sitemap URL
const DEFAULT_SITEMAP_URL = "https://1wayseo.com/sitemap.xml";

/**
 * Ping Google Search Console
 */
async function pingGoogle(sitemapUrl: string): Promise<PingResult> {
  try {
    const url = `${GOOGLE_PING_URL}?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "1waySEO-Sitemap-Ping/1.0",
      },
    });

    return {
      service: "google",
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      service: "google",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ping Bing Webmaster Tools
 */
async function pingBing(sitemapUrl: string): Promise<PingResult> {
  try {
    const url = `${BING_PING_URL}?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "1waySEO-Sitemap-Ping/1.0",
      },
    });

    return {
      service: "bing",
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      service: "bing",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ping 所有搜尋引擎
 * @param sitemapUrl 要 ping 的 sitemap URL（預設為主 sitemap）
 */
export async function pingAllSearchEngines(
  sitemapUrl: string = DEFAULT_SITEMAP_URL,
): Promise<PingResult[]> {
  // 檢查是否啟用 ping 功能
  const pingEnabled =
    process.env.SITEMAP_PING_ENABLED?.toLowerCase().trim() === "true";

  if (!pingEnabled) {
    console.log("[Sitemap Ping] Ping 功能未啟用，跳過");
    return [];
  }

  console.log(`[Sitemap Ping] 正在 ping: ${sitemapUrl}`);

  // 並行 ping Google 和 Bing
  const results = await Promise.all([
    pingGoogle(sitemapUrl),
    pingBing(sitemapUrl),
  ]);

  // 記錄結果
  for (const result of results) {
    if (result.success) {
      console.log(
        `[Sitemap Ping] ${result.service} ping 成功 (status: ${result.status})`,
      );
    } else {
      console.error(
        `[Sitemap Ping] ${result.service} ping 失敗: ${result.error || `status ${result.status}`}`,
      );
    }
  }

  return results;
}

/**
 * Ping 多個 sitemap
 */
export async function pingMultipleSitemaps(
  sitemapUrls: string[],
): Promise<PingResult[]> {
  const allResults: PingResult[] = [];

  for (const url of sitemapUrls) {
    const results = await pingAllSearchEngines(url);
    allResults.push(...results);
  }

  return allResults;
}

/**
 * 取得所有 sitemap URL
 */
export function getAllSitemapUrls(): string[] {
  const baseUrl = "https://1wayseo.com";
  return [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/category-sitemap.xml`,
    `${baseUrl}/tag-sitemap.xml`,
    `${baseUrl}/page-sitemap.xml`,
  ];
}
