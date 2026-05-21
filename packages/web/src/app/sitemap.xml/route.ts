/**
 * Sitemap Index（主索引）
 * 路由: /sitemap.xml
 *
 * WordPress 風格的 sitemap 架構，指向各子 sitemap：
 * - /post-sitemap.xml - 文章
 * - /category-sitemap.xml - 分類
 * - /tag-sitemap.xml - 標籤
 * - /page-sitemap.xml - 靜態頁面
 */

import {
  BASE_URL,
  formatDate,
  generateSitemapIndexHeader,
  generateSitemapIndexFooter,
  generateSitemapIndexEntry,
  createSitemapResponse,
  getLatestArticleUpdate,
} from "@/lib/sitemap";

// ISR: 每小時重新生成
export const revalidate = 3600;

/**
 * 子 Sitemap 配置
 */
const SUB_SITEMAPS = [
  { name: "post-sitemap.xml", getLastmod: getLatestArticleUpdate },
  {
    name: "category-sitemap.xml",
    getLastmod: () => Promise.resolve(new Date()),
  },
  { name: "tag-sitemap.xml", getLastmod: () => Promise.resolve(new Date()) },
  { name: "page-sitemap.xml", getLastmod: () => Promise.resolve(new Date()) },
];

/**
 * GET /sitemap.xml
 * 生成 Sitemap Index，列出所有子 sitemap
 */
export async function GET() {
  try {
    const entries: string[] = [];

    // 生成每個子 sitemap 的條目
    for (const sitemap of SUB_SITEMAPS) {
      const lastmod = await sitemap.getLastmod();
      entries.push(
        generateSitemapIndexEntry({
          loc: `${BASE_URL}/${sitemap.name}`,
          lastmod: formatDate(lastmod),
        }),
      );
    }

    // 組合 XML
    const xml = `${generateSitemapIndexHeader()}
${entries.join("\n")}
${generateSitemapIndexFooter()}`;

    return createSitemapResponse(xml);
  } catch (error) {
    console.error("Error generating sitemap index:", error);

    // 返回基本 sitemap index
    const now = formatDate(new Date());
    const fallbackXml = `${generateSitemapIndexHeader()}
${generateSitemapIndexEntry({ loc: `${BASE_URL}/page-sitemap.xml`, lastmod: now })}
${generateSitemapIndexFooter()}`;

    return createSitemapResponse(fallbackXml, 300);
  }
}
