/**
 * Web Fetcher — 使用 @mozilla/readability 提取網頁正文
 */
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const BLOCKED_DOMAINS = [
  "businessweekly.com.tw",
  "cw.com.tw",
  "wsj.com",
  "ft.com",
  "medium.com",
  "reddit.com",
  "quora.com",
  "twitter.com",
  "x.com",
  "facebook.com",
];

export function isBlockedDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname;
    return BLOCKED_DOMAINS.some((d) => domain.includes(d));
  } catch {
    return true;
  }
}

export function scoreUrl(
  url: string,
  targetLanguage: string,
  type: string,
): number {
  let score = 0;
  try {
    const domain = new URL(url).hostname;

    if (["blog", "tutorial", "industry"].includes(type)) score += 2;
    if (type === "news") score += 1;
    if (["wikipedia", "service"].includes(type)) score -= 5;

    if (
      targetLanguage === "zh-TW" &&
      (domain.endsWith(".tw") || domain.includes("zh"))
    )
      score += 2;
    if (targetLanguage === "ja-JP" && domain.endsWith(".jp")) score += 2;

    if (isBlockedDomain(url)) score -= 10;
  } catch {
    score = -10;
  }
  return score;
}

export async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const html = await response.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const text = article?.textContent;
    if (!text || text.length < 200) return null;
    return text.substring(0, 4000);
  } catch {
    return null;
  }
}
