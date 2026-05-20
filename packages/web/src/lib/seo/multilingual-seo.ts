import { Metadata } from "next";
import {
  UI_LOCALES,
  LOCALE_FULL_NAMES,
  DEFAULT_UI_LOCALE,
} from "@/lib/i18n/locales";
import { getLocaleName } from "@/lib/i18n/locales";

interface MultilingualSEOConfig {
  title: string | Record<string, string>;
  description: string | Record<string, string>;
  keywords?: string | Record<string, string>;
  currentLocale: string;
  alternateLocales?: string[];
  canonicalUrl?: string;
  ogImage?: string | Record<string, string>;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  structuredData?: object;
}

/**
 * 生成多語系 SEO Metadata
 */
export function generateMultilingualSEO(
  config: MultilingualSEOConfig,
): Metadata {
  const {
    title,
    description,
    keywords,
    currentLocale,
    alternateLocales,
    canonicalUrl,
    ogImage,
    twitterCard = "summary_large_image",
    structuredData,
  } = config;

  // 取得當前語系的內容
  const currentTitle =
    typeof title === "string"
      ? title
      : title[currentLocale] || title[DEFAULT_UI_LOCALE];
  const currentDescription =
    typeof description === "string"
      ? description
      : description[currentLocale] || description[DEFAULT_UI_LOCALE];
  const currentKeywords =
    typeof keywords === "string"
      ? keywords
      : keywords?.[currentLocale] || keywords?.[DEFAULT_UI_LOCALE];
  const currentOgImage =
    typeof ogImage === "string"
      ? ogImage
      : ogImage?.[currentLocale] || ogImage?.[DEFAULT_UI_LOCALE];

  // 生成替代語系連結
  const alternates: Record<string, string> = {};
  const supportedLocales = alternateLocales || UI_LOCALES.map((l) => l.code);

  if (canonicalUrl) {
    alternates.canonical = canonicalUrl;

    // 生成 hreflang 標籤
    supportedLocales.forEach((locale) => {
      const hrefLang = locale.toLowerCase(); // zh-TW → zh-tw
      alternates[hrefLang] = canonicalUrl.replace(
        /\/[a-z]{2}-[A-Z]{2}\//,
        `/${locale}/`,
      );
    });

    // x-default 指向預設語系
    alternates["x-default"] = canonicalUrl.replace(
      /\/[a-z]{2}-[A-Z]{2}\//,
      `/${DEFAULT_UI_LOCALE}/`,
    );
  }

  // 構建 Metadata
  const metadata: Metadata = {
    title: currentTitle,
    description: currentDescription,
    ...(currentKeywords && {
      keywords: currentKeywords.split(",").map((k) => k.trim()),
    }),

    // 語系相關
    alternates: Object.keys(alternates).length > 0 ? alternates : undefined,

    // Open Graph
    openGraph: {
      title: currentTitle,
      description: currentDescription,
      locale: currentLocale,
      type: "website",
      ...(currentOgImage && { images: [{ url: currentOgImage }] }),
      // 添加替代語系
      ...(supportedLocales.length > 1 && {
        alternateLocale: supportedLocales.filter((l) => l !== currentLocale),
      }),
    },

    // Twitter Card
    twitter: {
      card: twitterCard,
      title: currentTitle,
      description: currentDescription,
      ...(currentOgImage && { images: [currentOgImage] }),
    },

    // 其他 meta 標籤
    other: {
      // 語系資訊
      "content-language": currentLocale,
      "accept-language": supportedLocales.join(","),

      // 結構化數據
      ...(structuredData && {
        "application/ld+json": JSON.stringify({
          "@context": "https://schema.org",
          ...structuredData,
          inLanguage: currentLocale,
        }),
      }),
    },
  };

  return metadata;
}

/**
 * 生成網站根目錄的語系選擇頁面 metadata
 */
export function generateLocaleSelectionSEO(): Metadata {
  const title = "1waySEO - Choose Your Language / 選擇語言 / 言語を選択";
  const description =
    "Select your preferred language for 1waySEO AI-powered SEO content platform.";

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: "https://1wayseo.com",
      languages: UI_LOCALES.reduce(
        (acc, locale) => {
          acc[locale.code] = `https://1wayseo.com/${locale.code}`;
          return acc;
        },
        {} as Record<string, string>,
      ),
    },
  };
}

/**
 * 生成部落格文章的多語系 SEO
 */
export function generateBlogSEO({
  title,
  description,
  slug,
  locale,
  publishedAt,
  updatedAt,
  tags,
  author = "1waySEO Team",
  ogImage,
}: {
  title: string;
  description: string;
  slug: string;
  locale: string;
  publishedAt: string;
  updatedAt?: string;
  tags?: string[];
  author?: string;
  ogImage?: string;
}): Metadata {
  const canonicalUrl = `https://1wayseo.com/${locale}/blog/${slug}`;
  const currentLocaleName = getLocaleName(locale);

  return generateMultilingualSEO({
    title: `${title} | 1waySEO Blog`,
    description,
    keywords: tags?.join(", "),
    currentLocale: locale,
    canonicalUrl,
    ogImage: ogImage || "https://1wayseo.com/og-blog.jpg",
    structuredData: {
      "@type": "BlogPosting",
      headline: title,
      description,
      author: {
        "@type": "Organization",
        name: author,
      },
      publisher: {
        "@type": "Organization",
        name: "1waySEO",
        logo: {
          "@type": "ImageObject",
          url: "https://1wayseo.com/logo.svg",
        },
      },
      datePublished: publishedAt,
      ...(updatedAt && { dateModified: updatedAt }),
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      inLanguage: locale,
      ...(ogImage && {
        image: {
          "@type": "ImageObject",
          url: ogImage,
        },
      }),
      ...(tags && {
        keywords: tags.join(", "),
      }),
    },
  });
}

/**
 * 生成首頁的多語系 SEO
 */
export function generateHomeSEO(locale: string): Metadata {
  const localizedContent = {
    "zh-TW": {
      title: "1waySEO - AI 驅動的 SEO 寫文平台",
      description:
        "智能 SEO 文章生成平台，依照關鍵字與搜尋結果自動決定最佳架構，幫助您輕鬆創建高排名內容。",
      keywords: "SEO工具, AI寫作, 內容行銷, 關鍵字優化, 文章生成",
    },
    "en-US": {
      title: "1waySEO - AI-Powered SEO Content Platform",
      description:
        "Intelligent SEO article generation platform that automatically determines optimal structure based on keywords and search results.",
      keywords:
        "SEO tools, AI writing, content marketing, keyword optimization, article generation",
    },
    "ja-JP": {
      title: "1waySEO - AI駆動のSEOライティングプラットフォーム",
      description:
        "キーワードと検索結果に基づいて最適な構造を自動決定する、インテリジェントなSEO記事生成プラットフォーム。",
      keywords:
        "SEOツール, AIライティング, コンテンツマーケティング, キーワード最適化, 記事生成",
    },
  };

  const content =
    localizedContent[locale as keyof typeof localizedContent] ||
    localizedContent["zh-TW"];

  return generateMultilingualSEO({
    title: content.title,
    description: content.description,
    keywords: content.keywords,
    currentLocale: locale,
    canonicalUrl: `https://1wayseo.com/${locale}`,
    ogImage: "https://1wayseo.com/og-home.jpg",
    structuredData: {
      "@type": "WebSite",
      name: "1waySEO",
      url: "https://1wayseo.com",
      description: content.description,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://1wayseo.com/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  });
}
