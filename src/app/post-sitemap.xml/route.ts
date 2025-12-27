/**
 * 文章 Sitemap
 * 路由: /post-sitemap.xml
 *
 * 包含：
 * - 所有已發布文章（中文原文）
 * - 所有翻譯版本
 * - hreflang 多語言標籤
 * - image:image 圖片標籤
 */

import {
  BASE_URL,
  formatDate,
  generateUrlEntry,
  generateHreflangLinks,
  createSitemapResponse,
  getPublishedArticles,
} from "@/lib/sitemap";

// ISR: 每小時重新生成（on-demand revalidation 會覆蓋）
export const revalidate = 3600;

/**
 * 生成 Post Sitemap header（包含 image 和 xhtml namespace）
 */
function generatePostSitemapHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
}

/**
 * GET /post-sitemap.xml
 */
export async function GET() {
  try {
    const articles = await getPublishedArticles();
    const urls: string[] = [];

    for (const article of articles) {
      const translations = (article.article_translations || []) as Array<{
        target_language: string;
        slug: string;
        updated_at: string;
      }>;

      // 生成 hreflang 標籤
      const hreflangLinks = generateHreflangLinks(
        BASE_URL,
        article.slug,
        translations,
      );

      // 中文原文
      urls.push(
        generateUrlEntry({
          loc: `${BASE_URL}/blog/${article.slug}`,
          lastmod: formatDate(article.updated_at),
          changefreq: "weekly",
          priority: "0.7",
          imageUrl: article.featured_image_url,
          hreflangLinks,
        }),
      );

      // 翻譯版本
      for (const translation of translations) {
        urls.push(
          generateUrlEntry({
            loc: `${BASE_URL}/blog/lang/${translation.target_language}/${translation.slug}`,
            lastmod: formatDate(translation.updated_at),
            changefreq: "weekly",
            priority: "0.7",
            // 翻譯版本不重複圖片，但保留 hreflang
            hreflangLinks,
          }),
        );
      }
    }

    // 組合 XML
    const xml = `${generatePostSitemapHeader()}
${urls.join("\n")}
</urlset>`;

    return createSitemapResponse(xml);
  } catch (error) {
    console.error("Error generating post sitemap:", error);

    // 返回空 sitemap
    const fallbackXml = `${generatePostSitemapHeader()}
</urlset>`;

    return createSitemapResponse(fallbackXml, 300);
  }
}
