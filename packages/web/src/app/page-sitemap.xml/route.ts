/**
 * 靜態頁面 Sitemap
 * 路由: /page-sitemap.xml
 */

import {
  BASE_URL,
  formatDate,
  generateUrlEntry,
  generateSitemapHeader,
  generateSitemapFooter,
  createSitemapResponse,
} from "@/lib/sitemap";

// ISR: 每天重新生成（靜態頁面變動少）
export const revalidate = 86400;

/**
 * 靜態頁面配置
 */
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" as const },
  { path: "/pricing", priority: "0.8", changefreq: "monthly" as const },
  { path: "/blog", priority: "0.9", changefreq: "daily" as const },
  { path: "/login", priority: "0.5", changefreq: "monthly" as const },
  { path: "/register", priority: "0.5", changefreq: "monthly" as const },
  { path: "/terms", priority: "0.3", changefreq: "monthly" as const },
  { path: "/privacy", priority: "0.3", changefreq: "monthly" as const },
];

/**
 * GET /page-sitemap.xml
 */
export async function GET() {
  const now = formatDate(new Date());
  const urls: string[] = [];

  // 生成所有靜態頁面 URL
  for (const page of STATIC_PAGES) {
    urls.push(
      generateUrlEntry({
        loc: `${BASE_URL}${page.path}`,
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
      }),
    );
  }

  // 組合 XML
  const xml = `${generateSitemapHeader()}
${urls.join("\n")}
${generateSitemapFooter()}`;

  return createSitemapResponse(xml, 86400);
}
