/**
 * Sitemap 共用工具函數
 * 從現有 sitemap.xml/route.ts 提取並模組化
 */

import { createClient } from "@supabase/supabase-js";
import type { UrlEntryOptions, SitemapIndexEntry } from "./types";

// Supabase client (使用 service role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 網站基礎 URL
export const BASE_URL = "https://1wayseo.com";

/**
 * 取得 Platform Blog 的 ID
 */
export async function getPlatformBlogId(): Promise<string | null> {
  const { data } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  return data?.id || null;
}

/**
 * 格式化日期為 ISO 8601 格式（台灣時區 +08:00）
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().replace("Z", "+08:00");
}

/**
 * XML 轉義特殊字元
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 生成 xhtml:link hreflang 標籤
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
 */
export function generateSitemapFooter(): string {
  return `</urlset>`;
}

/**
 * 生成 Sitemap Index header
 */
export function generateSitemapIndexHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-index.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
}

/**
 * 生成 Sitemap Index footer
 */
export function generateSitemapIndexFooter(): string {
  return `</sitemapindex>`;
}

/**
 * 生成 Sitemap Index 條目
 */
export function generateSitemapIndexEntry(entry: SitemapIndexEntry): string {
  return `  <sitemap>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </sitemap>`;
}

/**
 * 取得所有已發布文章（用於 sitemap）
 */
export async function getPublishedArticles() {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      updated_at,
      cover_image_url,
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

  return data || [];
}

/**
 * 取得所有分類（從已發布文章）
 */
export async function getPublishedCategories(): Promise<string[]> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data } = await supabase
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
 */
export async function getPublishedTags(): Promise<string[]> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return [];
  }

  const { data } = await supabase
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
 */
export async function getLatestArticleUpdate(): Promise<Date> {
  const platformBlogId = await getPlatformBlogId();

  if (!platformBlogId) {
    return new Date();
  }

  const { data } = await supabase
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
