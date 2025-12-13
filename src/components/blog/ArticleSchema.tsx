import type { BlogArticle } from "@/types/blog";

interface ArticleSchemaProps {
  article: BlogArticle;
  url: string;
}

/**
 * 文章結構化資料組件 (JSON-LD)
 * 用於 SEO，幫助搜尋引擎理解文章內容
 */
export function ArticleSchema({ article, url }: ArticleSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt || "",
    image: article.featured_image_url || article.og_image,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: "1waySEO",
      url: "https://1wayseo.com",
    },
    publisher: {
      "@type": "Organization",
      name: "1waySEO",
      url: "https://1wayseo.com",
      logo: {
        "@type": "ImageObject",
        url: "https://1wayseo.com/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    keywords: article.keywords?.join(", ") || article.focus_keyword || "",
    wordCount: article.word_count,
    articleSection: article.categories?.[0] || "Blog",
    inLanguage: "zh-TW",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
