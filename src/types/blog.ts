/**
 * Blog 相關類型定義
 */

/**
 * 公開 Blog 文章（用於前端展示）
 */
export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  html_content: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  categories: string[];
  tags: string[];
  reading_time: number | null;
  word_count: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;

  // SEO 欄位
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  keywords: string[] | null;

  // Open Graph
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;

  // 閱讀統計（來自 article_views 表）
  article_views?: {
    total_views: number;
    views_this_week: number;
  } | null;
}

/**
 * 文章列表項目（簡化版，用於列表頁）
 */
export interface BlogArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image_url: string | null;
  categories: string[];
  tags: string[];
  reading_time: number | null;
  published_at: string | null;
  article_views?: {
    total_views: number;
  } | null;
}

/**
 * 文章閱讀統計
 */
export interface ArticleViewStats {
  total_views: number;
  unique_views: number;
  views_today: number;
  views_this_week: number;
  views_this_month: number;
}

/**
 * 分類統計（用於側邊欄）
 */
export interface CategoryCount {
  name: string;
  count: number;
}

/**
 * 標籤統計（用於標籤雲）
 */
export interface TagCount {
  name: string;
  count: number;
}

/**
 * 文章列表 API 回應
 */
export interface BlogArticlesResponse {
  articles: BlogArticleListItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}

/**
 * 文章詳情 API 回應
 */
export interface BlogArticleResponse {
  article: BlogArticle;
  relatedArticles: BlogArticleListItem[];
}

/**
 * 分類列表 API 回應
 */
export interface CategoriesResponse {
  categories: CategoryCount[];
}

/**
 * 標籤列表 API 回應
 */
export interface TagsResponse {
  tags: TagCount[];
}

/**
 * 熱門文章（依閱讀數排序）
 */
export interface PopularArticle {
  id: string;
  slug: string;
  title: string;
  featured_image_url: string | null;
  total_views: number;
}
