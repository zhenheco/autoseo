/**
 * Schema.org 結構化數據組件
 * 用於提供豐富的搜尋結果片段
 */

import { useLocale } from "next-intl";

interface OrganizationSchemaProps {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}

export function OrganizationSchema({
  name,
  url,
  logo,
  description,
  sameAs = [],
}: OrganizationSchemaProps) {
  const locale = useLocale();

  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo && { logo }),
    ...(description && { description }),
    ...(sameAs.length > 0 && { sameAs }),
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface WebSiteSchemaProps {
  name: string;
  url: string;
  description?: string;
  searchUrl?: string;
}

export function WebSiteSchema({
  name,
  url,
  description,
  searchUrl,
}: WebSiteSchemaProps) {
  const locale = useLocale();

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(description && { description }),
    ...(searchUrl && {
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${searchUrl}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    }),
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BlogPostSchemaProps {
  headline: string;
  description: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  url: string;
  image?: string;
  tags?: string[];
}

export function BlogPostSchema({
  headline,
  description,
  author,
  publishedAt,
  updatedAt,
  url,
  image,
  tags,
}: BlogPostSchemaProps) {
  const locale = useLocale();

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    author: {
      "@type": "Person",
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
      "@id": url,
    },
    ...(image && {
      image: {
        "@type": "ImageObject",
        url: image,
      },
    }),
    ...(tags && {
      keywords: tags.join(", "),
    }),
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbSchemaProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ProductSchemaProps {
  name: string;
  description: string;
  price: number;
  currency: string;
  availability: "InStock" | "OutOfStock" | "PreOrder";
  url: string;
  image?: string;
  brand?: string;
  sku?: string;
  rating?: {
    value: number;
    count: number;
  };
}

export function ProductSchema({
  name,
  description,
  price,
  currency,
  availability,
  url,
  image,
  brand = "1waySEO",
  sku,
  rating,
}: ProductSchemaProps) {
  const locale = useLocale();

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    brand: {
      "@type": "Brand",
      name: brand,
    },
    offers: {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      url,
    },
    ...(image && { image }),
    ...(sku && { sku }),
    ...(rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating.value,
        reviewCount: rating.count,
      },
    }),
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface FAQSchemaProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export function FAQSchema({ questions }: FAQSchemaProps) {
  const locale = useLocale();

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
    inLanguage: locale,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
