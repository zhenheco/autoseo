/**
 * 標籤頁面 Sitemap
 * 路由: /tag-sitemap.xml
 */

import {
  BASE_URL,
  formatDate,
  generateUrlEntry,
  generateSitemapHeader,
  generateSitemapFooter,
  createSitemapResponse,
  getPublishedTags,
} from "@/lib/sitemap";

// ISR: 每小時重新生成
export const revalidate = 3600;

/**
 * GET /tag-sitemap.xml
 */
export async function GET() {
  try {
    const now = formatDate(new Date());
    const tags = await getPublishedTags();
    const urls: string[] = [];

    // 生成所有標籤頁面 URL
    for (const tag of tags) {
      urls.push(
        generateUrlEntry({
          loc: `${BASE_URL}/blog/tag/${encodeURIComponent(tag)}`,
          lastmod: now,
          changefreq: "weekly",
          priority: "0.5",
        }),
      );
    }

    // 組合 XML
    const xml = `${generateSitemapHeader()}
${urls.join("\n")}
${generateSitemapFooter()}`;

    return createSitemapResponse(xml);
  } catch (error) {
    console.error("Error generating tag sitemap:", error);

    // 返回空 sitemap
    const fallbackXml = `${generateSitemapHeader()}
${generateSitemapFooter()}`;

    return createSitemapResponse(fallbackXml, 300);
  }
}
