// ===========================================
// 多語系翻譯相關型別定義
// ===========================================

/**
 * 支援的翻譯目標語言
 */
export type TranslationLocale = "en-US" | "de-DE" | "fr-FR" | "es-ES";

/**
 * 所有支援的語言（包含原始語言）
 */
export type SupportedLocale = "zh-TW" | TranslationLocale;

/**
 * 語言配置
 */
export interface TranslationLanguageConfig {
  locale: SupportedLocale;
  name: string;
  nativeName: string;
  flagEmoji: string;
  isEnabled: boolean;
  displayOrder: number;
}

/**
 * 預設的語言配置
 */
export const TRANSLATION_LANGUAGES: Record<
  SupportedLocale,
  TranslationLanguageConfig
> = {
  "zh-TW": {
    locale: "zh-TW",
    name: "Traditional Chinese",
    nativeName: "繁體中文",
    flagEmoji: "🇹🇼",
    isEnabled: true,
    displayOrder: 0,
  },
  "en-US": {
    locale: "en-US",
    name: "English (US)",
    nativeName: "English",
    flagEmoji: "🇺🇸",
    isEnabled: true,
    displayOrder: 1,
  },
  "de-DE": {
    locale: "de-DE",
    name: "German",
    nativeName: "Deutsch",
    flagEmoji: "🇩🇪",
    isEnabled: true,
    displayOrder: 2,
  },
  "fr-FR": {
    locale: "fr-FR",
    name: "French",
    nativeName: "Français",
    flagEmoji: "🇫🇷",
    isEnabled: true,
    displayOrder: 3,
  },
  "es-ES": {
    locale: "es-ES",
    name: "Spanish",
    nativeName: "Español",
    flagEmoji: "🇪🇸",
    isEnabled: true,
    displayOrder: 4,
  },
};

/**
 * 翻譯目標語言陣列
 */
export const TRANSLATION_LOCALES: TranslationLocale[] = [
  "en-US",
  "de-DE",
  "fr-FR",
  "es-ES",
];

// ===========================================
// 翻譯文章型別
// ===========================================

/**
 * 翻譯文章狀態
 */
export type TranslationStatus = "draft" | "reviewed" | "published" | "archived";

/**
 * 翻譯文章
 */
export interface ArticleTranslation {
  id: string;
  source_article_id: string;
  company_id: string;
  website_id: string | null;
  user_id: string | null;

  // 語言資訊
  source_language: string;
  target_language: TranslationLocale;

  // 翻譯內容
  title: string;
  slug: string;
  markdown_content: string;
  html_content: string;
  excerpt: string | null;

  // SEO Metadata
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  keywords: string[];

  // OG/Twitter
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;

  // 分類與標籤
  categories: string[];
  tags: string[];

  // 統計
  word_count: number | null;
  reading_time: number | null;
  paragraph_count: number | null;
  sentence_count: number | null;

  // 連結資訊
  internal_links: InternalLink[];
  internal_links_count: number;
  external_references: ExternalReference[];
  external_links_count: number;

  // 品質與審核
  translation_quality_score: number | null;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;

  // AI 模型資訊
  translation_model: string | null;
  translation_tokens: {
    input: number;
    output: number;
  } | null;
  translation_cost: number | null;
  translation_time: number | null;

  // 狀態
  status: TranslationStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 內部連結
 */
export interface InternalLink {
  anchor: string;
  url: string;
  section: string | null;
  articleId: string | null;
}

/**
 * 外部引用
 */
export interface ExternalReference {
  url: string;
  title: string;
  domain: string;
  type: string;
}

// ===========================================
// 翻譯任務型別
// ===========================================

/**
 * 翻譯任務狀態
 */
export type TranslationJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 翻譯任務
 */
export interface TranslationJob {
  id: string;
  job_id: string;
  company_id: string;
  website_id: string | null;
  user_id: string | null;
  source_article_id: string;

  // 目標語言
  target_languages: TranslationLocale[];

  // 狀態追蹤
  status: TranslationJobStatus;
  progress: number;
  current_language: TranslationLocale | null;

  // 結果
  completed_languages: TranslationLocale[];
  failed_languages: Record<TranslationLocale, string>; // locale -> error message

  // 元資料
  metadata: Record<string, unknown>;
  error_message: string | null;

  // 時間追蹤
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * 帶有原文資訊的翻譯任務
 */
export interface TranslationJobWithSource extends TranslationJob {
  generated_articles: {
    id: string;
    title: string;
    slug: string;
    html_content: string;
    markdown_content: string;
    excerpt: string | null;
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    categories: string[];
    tags: string[];
    og_title: string | null;
    og_description: string | null;
  };
}

// ===========================================
// Translation Agent 型別
// ===========================================

/**
 * TranslationAgent 輸入
 */
export interface TranslationInput {
  // 來源文章
  sourceArticle: {
    id: string;
    title: string;
    markdown_content: string;
    html_content: string;
    excerpt: string | null;
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    categories: string[];
    tags: string[];
    og_title: string | null;
    og_description: string | null;
  };

  // 語言設定
  sourceLanguage: string;
  targetLanguage: TranslationLocale;

  // AI 設定
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * TranslationAgent 輸出
 */
export interface TranslationOutput {
  // 翻譯內容
  title: string;
  slug: string;
  markdown_content: string;
  html_content: string;
  excerpt: string | null;

  // 翻譯 SEO
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  keywords: string[];
  categories: string[];
  tags: string[];
  og_title: string | null;
  og_description: string | null;

  // 統計
  word_count: number;
  reading_time: number;
  paragraph_count: number;
  sentence_count: number;

  // 執行資訊
  executionInfo: TranslationExecutionInfo;
}

/**
 * 翻譯執行資訊
 */
export interface TranslationExecutionInfo {
  model: string;
  executionTime: number;
  tokenUsage: {
    input: number;
    output: number;
  };
  cost: number;
}

// ===========================================
// API 請求/響應型別
// ===========================================

/**
 * 建立翻譯任務請求
 */
export interface CreateTranslationJobRequest {
  article_ids: string[];
  target_languages: TranslationLocale[];
}

/**
 * 建立翻譯任務響應
 */
export interface CreateTranslationJobResponse {
  success: boolean;
  job_count: number;
  jobs: {
    job_id: string;
    source_article_id: string;
    target_languages: TranslationLocale[];
  }[];
}

/**
 * 翻譯進度響應
 */
export interface TranslationProgressResponse {
  job_id: string;
  status: TranslationJobStatus;
  progress: number;
  current_language: TranslationLocale | null;
  completed_languages: TranslationLocale[];
  failed_languages: Record<TranslationLocale, string>;
  source_article: {
    id: string;
    title: string;
  };
}

/**
 * 文章翻譯狀態摘要
 */
export interface ArticleTranslationSummary {
  article_id: string;
  article_title: string;
  translations: {
    locale: TranslationLocale;
    status: TranslationStatus | "not_translated";
    translation_id: string | null;
    published_at: string | null;
  }[];
}

// ===========================================
// Hreflang 相關型別
// ===========================================

/**
 * Hreflang 項目
 */
export interface HreflangEntry {
  locale: SupportedLocale;
  url: string;
}

/**
 * 文章的 Hreflang 資訊
 */
export interface ArticleHreflang {
  original: HreflangEntry;
  translations: HreflangEntry[];
  xDefault: string;
}
