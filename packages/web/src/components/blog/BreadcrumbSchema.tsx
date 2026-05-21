import type { SupportedLocale } from "@/types/translations";

interface BreadcrumbSchemaProps {
  title: string;
  url: string;
  locale: SupportedLocale;
  category?: string;
}

/**
 * 麵包屑結構化資料組件 (JSON-LD)
 * 用於 SEO，幫助搜尋引擎理解頁面層級結構
 */
export function BreadcrumbSchema({
  title,
  url,
  locale,
  category,
}: BreadcrumbSchemaProps) {
  const baseUrl = "https://1wayseo.com";

  // 根據語言設定首頁和 Blog 名稱
  const homeLabel = locale === "zh-TW" ? "首頁" : "Home";
  const blogLabel = "Blog";

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: baseUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: blogLabel,
      item: `${baseUrl}/blog`,
    },
  ];

  // 如果有分類，加入分類層級
  if (category) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: category,
      item: `${baseUrl}/blog/category/${encodeURIComponent(category)}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: title,
      item: url,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: title,
      item: url,
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
