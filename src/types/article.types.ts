export interface ArticlePublishInfo {
  published_to_website_id: string | null;
  published_to_website_at: string | null;
}

export interface GeneratedArticle {
  id: string;
  article_job_id: string | null;
  company_id: string;
  website_id: string | null;
  user_id: string | null;
  title: string;
  slug: string;
  markdown_content: string;
  html_content: string;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  keywords: string[];
  categories: string[];
  tags: string[];
  word_count: number | null;
  reading_time: number | null;
  quality_score: number | null;
  quality_passed: boolean;
  wordpress_post_id: number | null;
  wordpress_post_url: string | null;
  wordpress_status: string | null;
  status: 'generated' | 'reviewed' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  published_to_website_id: string | null;
  published_to_website_at: string | null;
}

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  quality_score: number | null;
  word_count: number | null;
  reading_time: number | null;
  wordpress_post_url: string | null;
  created_at: string;
  published_at: string | null;
  html_content: string;
  published_to_website_id: string | null;
  published_to_website_at: string | null;
}

export interface UpdateArticleRequest {
  html_content?: string;
  title?: string;
  published_to_website_id?: string;
  published_to_website_at?: string;
}

export interface PublishArticleRequest {
  target: 'wordpress';
  website_id: string;
  status: 'draft' | 'publish' | 'scheduled';
  scheduled_time?: string;
}

export interface BatchPublishRequest {
  article_ids: string[];
  website_id: string;
  target: 'wordpress';
  status: 'draft' | 'publish' | 'scheduled';
}

export interface BatchPublishResponse {
  success: boolean;
  results: {
    article_id: string;
    success: boolean;
    error?: string;
  }[];
  stats: {
    total: number;
    success: number;
    failed: number;
  };
}
