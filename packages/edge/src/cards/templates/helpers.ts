import type { Brand, GeneratedArticle } from "../types";

export const DEFAULT_PRIMARY_COLOR = "#111827";
export const DEFAULT_SECONDARY_COLOR = "#f8fafc";

export function brandPrimaryColor(brand: Brand): string {
  return brand.primaryColor ?? brand.primary_color ?? DEFAULT_PRIMARY_COLOR;
}

export function brandSecondaryColor(brand: Brand): string {
  return brand.secondaryColor ?? brand.secondary_color ?? DEFAULT_SECONDARY_COLOR;
}

export function brandLogoUrl(brand: Brand): string | null {
  return brand.logoUrl ?? brand.logo_url ?? null;
}

export function articleHeroImageUrl(article: GeneratedArticle): string | null {
  return (
    article.featuredImageUrl ??
    article.featured_image_url ??
    article.og_image ??
    article.twitter_image ??
    null
  );
}

export function articleSubtitle(article: GeneratedArticle): string {
  return (
    article.excerpt ??
    article.seo_description ??
    article.focus_keyword ??
    "Fresh SEO insight for this week."
  );
}

export function articleTakeaways(article: GeneratedArticle): string[] {
  const explicit = compactStringArray(article.takeaways);
  if (explicit.length > 0) return explicit;

  const metadataTakeaways = compactStringArray(
    readPath(article.article_metadata, ["takeaways"]),
  );
  if (metadataTakeaways.length > 0) return metadataTakeaways;

  const contentTakeaways = compactStringArray(
    readPath(article.content_json, ["takeaways"]),
  );
  if (contentTakeaways.length > 0) return contentTakeaways;

  const bullets = extractBullets(
    [article.markdown_content, article.html_content].filter(isString).join("\n"),
  );
  if (bullets.length > 0) return bullets;

  return [articleSubtitle(article), article.title].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
}

export function quoteText(article: GeneratedArticle): string {
  return articleTakeaways(article)[0] ?? articleSubtitle(article);
}

export function statText(article: GeneratedArticle): {
  number: string;
  label: string;
} {
  if (typeof article.reading_time === "number" && article.reading_time > 0) {
    return { number: String(article.reading_time), label: "minute read" };
  }

  if (typeof article.word_count === "number" && article.word_count > 0) {
    return {
      number: Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(article.word_count),
      label: "words of SEO guidance",
    };
  }

  const count = Math.max(articleTakeaways(article).length, 1);
  return { number: String(count), label: "SEO wins this week" };
}

function extractBullets(content: string): string[] {
  const htmlListItems = [...content.matchAll(/<li[^>]*>(.*?)<\/li>/gis)].map(
    (match) => stripTags(match[1] ?? ""),
  );
  const markdownBullets = content
    .split("\n")
    .map((line) => line.trim().match(/^[-*]\s+(.+)$/)?.[1])
    .filter(isString);

  return [...htmlListItems, ...markdownBullets]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function compactStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(isString).map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function readPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
