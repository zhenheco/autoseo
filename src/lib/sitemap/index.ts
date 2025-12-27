/**
 * Sitemap 共用工具函數
 * 從現有 sitemap.xml/route.ts 提取並模組化
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { UrlEntryOptions, SitemapIndexEntry } from "./types";

// Supabase client (延遲初始化，避免模組載入時環境變數尚未就緒)
let _supabase: SupabaseClient | null = null;

/**
 * 取得 Supabase client（延遲初始化）
 * @returns Supabase client 實例
 * @throws Error 如果環境變數未設定
 */
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "[Sitemap] 缺少必要環境變數: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

// 網站基礎 URL
export const BASE_URL = "https://1wayseo.com";

/**
 * 取得 Platform Blog 的 ID
 * @returns Platform Blog 的 ID，如果不存在則返回 null
 */
export async function getPlatformBlogId(): Promise<string | null> {
  const { data } = await getSupabase()
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  return data?.id || null;
}

/**
 * 格式化日期為 ISO 8601 格式（UTC）
 * 使用 UTC 格式確保時間戳記正確，搜尋引擎完全支援
 * @param date 日期物件或字串
 * @returns ISO 8601 格式的日期字串
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toISOString();
}

/**
 * XML 轉義特殊字元
 * @param str 要轉義的字串
 * @returns 轉義後的安全 XML 字串
 */
export function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 生成 xhtml:link hreflang 標籤
 * @param baseUrl 網站基礎 URL
 * @param originalSlug 原文文章的 slug
 * @param translations 翻譯版本陣列
 * @returns 多語系 hreflang 標籤字串
 */
export function generateHreflangLinks(
  baseUrl: string,
  originalSlug: string,
  translations: Array<{ target_language: string; slug: string }>,
): string {
  const links: string[] = [];

  // 中文原文（x-default）
  links.push(
    `    <xhtml:link rel="alternate" hreflang="zh-TW" href="${baseUrl}/blog/${originalSlug}"/>`,
  );
  links.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/blog/${originalSlug}"/>`,
  );

  // 翻譯版本
  for (const t of translations || []) {
    links.push(
      `    <xhtml:link rel="alternate" hreflang="${t.target_language}" href="${baseUrl}/blog/lang/${t.target_language}/${t.slug}"/>`,
    );
  }

  return links.join("\n");
}

/**
 * 生成單個 URL 條目
 * @param options URL 條目選項（loc、lastmod、changefreq 等）
 * @returns XML 格式的 URL 條目字串
 */
export function generateUrlEntry(options: UrlEntryOptions): string {
  const { loc, lastmod, changefreq, priority, imageUrl, hreflangLinks } =
    options;

  let entry = `  <url>\n`;
  entry += `    <loc>${escapeXml(loc)}</loc>\n`;
  entry += `    <lastmod>${lastmod}</lastmod>\n`;
  entry += `    <changefreq>${changefreq}</changefreq>\n`;
  entry += `    <priority>${priority}</priority>\n`;

  if (imageUrl) {
    entry += `    <image:image>\n`;
    entry += `      <image:loc>${escapeXml(imageUrl)}</image:loc>\n`;
    entry += `    </image:image>\n`;
  }

  if (hreflangLinks) {
    entry += hreflangLinks + "\n";
  }

  entry += `  </url>`;
  return entry;
}

/**
 * 生成 Sitemap XML header
 * @param includeImage 是否包含 image namespace
 * @param includeXhtml 是否包含 xhtml namespace (for hreflang)
 */
export function generateSitemapHeader(
  includeImage = false,
  includeXhtml = false,
): string {
  const namespaces = ['xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'];

  if (includeXhtml) {
    namespaces.push('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  }

  if (includeImage) {
    namespaces.push(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset ${namespaces.join("\n        ")}>`;
}

/**
 * 生成 Sitemap XML footer
 * @returns Sitemap XML 結尾標籤
 */
export function generateSitemapFooter(): string {
  return `</urlset>`;
}

/**
 * 生成 Sitemap Index header
 * @returns Sitemap Index XML 開頭標籤
 */
export function generateSitemapIndexHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-index.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
}

/**
 * 生成 Sitemap Index footer
 * @returns Sitemap Index XML 結尾標籤
 */
export function generateSitemapIndexFooter(): string {
  return `</sitemapindex>`;
}

/**
 * 生成 Sitemap Index 條目
 * @param entry Sitemap Index 條目資料
 * @returns XML 格式的 sitemap 條目
 */
export function generateSitemapIndexEntry(entry: SitemapIndexEntry): string {
  return `  <sitemap>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </sitemap>`;
}

/**
 * 取得所有已發布文章（用於 sitemap）
 * @returns 已發布文章陣列，包含翻譯資訊
 */
export async function getPublishedArticles() {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data, error } = await getSupabase()
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      updated_at,
      featured_image_url,
      article_translations (
        target_language,
        slug,
        updated_at
      )
    `,
    )
    .eq("published_to_website_id", platformBlogId)
    .eq("status", "published")
    .not("slug", "is", null);

  if (error) {
    console.error("[Sitemap] getPublishedArticles error:", error);
    return [];
  }

  return data || [];
}

/**
 * 取得所有分類（從已發布文章）
 * @returns 分類名稱陣列
 */
export async function getPublishedCategories(): Promise<string[]> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data } = await getSupabase()
    .from("generated_articles")
    .select("categories")
    .eq("published_to_website_id", platformBlogId)
    .eq("status", "published")
    .not("slug", "is", null);

  const categories = new Set<string>();
  for (const article of data || []) {
    for (const cat of article.categories || []) {
      if (cat) categories.add(cat);
    }
  }

  return Array.from(categories);
}

/**
 * 取得所有標籤（從已發布文章）
 * @returns 標籤名稱陣列
 */
export async function getPublishedTags(): Promise<string[]> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data } = await getSupabase()
    .from("generated_articles")
    .select("tags")
    .eq("published_to_website_id", platformBlogId)
    .eq("status", "published")
    .not("slug", "is", null);

  const tags = new Set<string>();
  for (const article of data || []) {
    for (const tag of article.tags || []) {
      if (tag) tags.add(tag);
    }
  }

  return Array.from(tags);
}

/**
 * 取得最新文章更新時間
 * @returns 最新文章的更新時間，如果沒有文章則返回當前時間
 */
export async function getLatestArticleUpdate(): Promise<Date> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return new Date();
  }

  const { data } = await getSupabase()
    .from("generated_articles")
    .select("updated_at")
    .eq("published_to_website_id", platformBlogId)
    .eq("status", "published")
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return data?.updated_at ? new Date(data.updated_at) : new Date();
}

/**
 * 建立標準 Sitemap Response
 * @param xml Sitemap XML 內容
 * @param cacheMaxAge 快取時間（秒），預設 3600
 * @returns HTTP Response 物件
 */
export function createSitemapResponse(
  xml: string,
  cacheMaxAge = 3600,
): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge}`,
    },
  });
}
