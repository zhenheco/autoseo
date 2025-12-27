/**
 * Sitemap 相關 TypeScript 類型定義
 */

/**
 * 單一 URL 條目的選項
 */
export interface UrlEntryOptions {
  loc: string;
  lastmod: string;
  changefreq:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: string;
  imageUrl?: string | null;
  hreflangLinks?: string;
}

/**
 * Sitemap Index 中的子 sitemap 條目
 */
export interface SitemapIndexEntry {
  loc: string;
  lastmod: string;
}

/**
 * 文章資料（用於 sitemap 生成）
 */
export interface ArticleForSitemap {
  id: string;
  slug: string;
  updated_at: string;
  featured_image_url?: string | null;
  article_translations: Array<{
    target_language: string;
    slug: string;
    updated_at: string;
  }> | null;
}

/**
 * Ping 結果
 */
export interface PingResult {
  service: "google" | "bing";
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * Sitemap revalidate 請求
 */
export interface RevalidateRequest {
  secret: string;
  sitemaps?: Array<"post" | "category" | "tag" | "page" | "index">;
  ping?: boolean;
}
