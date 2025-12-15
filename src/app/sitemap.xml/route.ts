import { createClient } from "@supabase/supabase-js";

// ISR: 每小時重新生成
export const revalidate = 3600;

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 取得公開 Blog 文章（包含翻譯版本）
 */
async function getBlogArticles() {
  // 先取得平台 Blog 站點 ID
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return {
      articles: [],
      categories: new Set<string>(),
      tags: new Set<string>(),
    };
  }

  // 取得所有已發布文章（包含翻譯資訊和封面圖）
  const { data } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      updated_at,
      categories,
      tags,
      cover_image_url,
      article_translations (
        target_language,
        slug,
        updated_at
      )
    `,
    )
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .not("slug", "is", null);

  const articles = data || [];
  const categories = new Set<string>();
  const tags = new Set<string>();

  for (const article of articles) {
    for (const cat of article.categories || []) {
      if (cat) categories.add(cat);
    }
    for (const tag of article.tags || []) {
      if (tag) tags.add(tag);
    }
  }

  return { articles, categories, tags };
}

/**
 * 格式化日期為 ISO 8601 格式（台灣時區 +08:00）
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().replace("Z", "+08:00");
}

/**
 * XML 轉義特殊字元
 */
function escapeXml(str: string): string {
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
function generateHreflangLinks(
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
function generateUrlEntry(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: string,
  imageUrl?: string | null,
  hreflangLinks?: string,
): string {
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
 * 生成完整的 sitemap XML
 */
function generateSitemapXML(
  baseUrl: string,
  articles: Array<{
    id: string;
    slug: string;
    updated_at: string;
    cover_image_url?: string | null;
    article_translations: Array<{
      target_language: string;
      slug: string;
      updated_at: string;
    }> | null;
  }>,
  categories: Set<string>,
  tags: Set<string>,
): string {
  const now = formatDate(new Date());
  const urls: string[] = [];

  // 1. 靜態頁面
  urls.push(generateUrlEntry(`${baseUrl}`, now, "weekly", "1.0"));
  urls.push(generateUrlEntry(`${baseUrl}/pricing`, now, "monthly", "0.8"));
  urls.push(generateUrlEntry(`${baseUrl}/login`, now, "monthly", "0.5"));
  urls.push(generateUrlEntry(`${baseUrl}/terms`, now, "monthly", "0.3"));
  urls.push(generateUrlEntry(`${baseUrl}/privacy`, now, "monthly", "0.3"));

  // 2. Blog 首頁
  urls.push(generateUrlEntry(`${baseUrl}/blog`, now, "daily", "0.9"));

  // 3. Blog 文章（中文原文 + 翻譯版本）
  for (const article of articles) {
    const translations = (article.article_translations || []) as Array<{
      target_language: string;
      slug: string;
      updated_at: string;
    }>;

    // 生成 hreflang 標籤
    const hreflangLinks = generateHreflangLinks(
      baseUrl,
      article.slug,
      translations,
    );

    // 中文原文
    urls.push(
      generateUrlEntry(
        `${baseUrl}/blog/${article.slug}`,
        formatDate(article.updated_at),
        "weekly",
        "0.7",
        article.cover_image_url,
        hreflangLinks,
      ),
    );

    // 翻譯版本
    for (const translation of translations) {
      urls.push(
        generateUrlEntry(
          `${baseUrl}/blog/lang/${translation.target_language}/${translation.slug}`,
          formatDate(translation.updated_at),
          "weekly",
          "0.7",
          undefined, // 翻譯版本不重複圖片
          hreflangLinks,
        ),
      );
    }
  }

  // 4. 分類頁面
  for (const category of categories) {
    urls.push(
      generateUrlEntry(
        `${baseUrl}/blog/category/${encodeURIComponent(category)}`,
        now,
        "weekly",
        "0.6",
      ),
    );
  }

  // 5. 標籤頁面
  for (const tag of tags) {
    urls.push(
      generateUrlEntry(
        `${baseUrl}/blog/tag/${encodeURIComponent(tag)}`,
        now,
        "weekly",
        "0.5",
      ),
    );
  }

  // 組合完整 XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return xml;
}

/**
 * GET /sitemap.xml
 * 生成標準 XML 格式的 sitemap
 */
export async function GET() {
  const baseUrl = "https://1wayseo.com";

  try {
    // 取得文章資料
    const { articles, categories, tags } = await getBlogArticles();

    // 生成 XML
    const xml = generateSitemapXML(baseUrl, articles, categories, tags);

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);

    // 返回基本 sitemap（僅靜態頁面）
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${formatDate(new Date())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallbackXml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }
}
