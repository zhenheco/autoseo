/**
 * 分類頁面 Sitemap
 * 路由: /category-sitemap.xml
 */

import {
  BASE_URL,
  formatDate,
  generateUrlEntry,
  generateSitemapHeader,
  generateSitemapFooter,
  createSitemapResponse,
  getPublishedCategories,
} from "@/lib/sitemap";

// ISR: 每小時重新生成
export const revalidate = 3600;

/**
 * GET /category-sitemap.xml
 */
export async function GET() {
  try {
    const now = formatDate(new Date());
    const categories = await getPublishedCategories();
    const urls: string[] = [];

    // 生成所有分類頁面 URL
    for (const category of categories) {
      urls.push(
        generateUrlEntry({
          loc: `${BASE_URL}/blog/category/${encodeURIComponent(category)}`,
          lastmod: now,
          changefreq: "weekly",
          priority: "0.6",
        }),
      );
    }

    // 組合 XML
    const xml = `${generateSitemapHeader()}
${urls.join("\n")}
${generateSitemapFooter()}`;

    return createSitemapResponse(xml);
  } catch (error) {
    console.error("Error generating category sitemap:", error);

    // 返回空 sitemap
    const fallbackXml = `${generateSitemapHeader()}
${generateSitemapFooter()}`;

    return createSitemapResponse(fallbackXml, 300);
  }
}
