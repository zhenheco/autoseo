export interface CardSize {
  width: number;
  height: number;
}

export interface Brand {
  id: string;
  name: string;
  primaryColor?: string | null;
  primary_color?: string | null;
  secondaryColor?: string | null;
  secondary_color?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
}

export interface GeneratedArticle {
  id: string;
  title: string;
  excerpt?: string | null;
  markdown_content?: string | null;
  html_content?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  word_count?: number | null;
  reading_time?: number | null;
  featured_image_url?: string | null;
  featuredImageUrl?: string | null;
  og_image?: string | null;
  twitter_image?: string | null;
  takeaways?: string[] | null;
  article_metadata?: unknown;
  content_json?: unknown;
}

export interface CardTemplateProps {
  brand: Brand;
  article: GeneratedArticle;
  size: CardSize;
}

export type CardTemplateName = "quote" | "stat" | "list" | "hero";
export type CardFormat = "ig_square" | "ig_story" | "og";
