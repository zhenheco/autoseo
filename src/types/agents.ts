// Agent 相關型別定義

export interface BrandVoice {
  id: string;
  website_id: string;
  tone_of_voice: string;
  target_audience: string;
  keywords: string[];
  sentence_style?: string;
  interactivity?: string;
}

export interface WorkflowSettings {
  id: string;
  website_id: string;
  serp_analysis_enabled: boolean;
  competitor_count: number;
  content_length_min: number;
  content_length_max: number;
  keyword_density_min: number;
  keyword_density_max: number;
  quality_threshold: number;
  auto_publish: boolean;
  serp_model: string;
  content_model: string;
  meta_model: string;
}

export interface AgentConfig {
  // 新的模型配置系統
  complex_processing_model?: string;  // 複雜處理（研究、策略）
  simple_processing_model?: string;   // 簡單功能（寫作、分類、標籤）

  // 舊的配置（向後相容）
  research_model: string;
  strategy_model: string;
  writing_model: string;
  image_model: string;
  research_temperature: number;
  strategy_temperature: number;
  writing_temperature: number;
  research_max_tokens: number;
  strategy_max_tokens: number;
  writing_max_tokens: number;
  image_size: string;
  image_count: number;
  meta_enabled: boolean;
  meta_model: string;
  meta_temperature: number;
  meta_max_tokens: number;
}

export interface Keyword {
  id: string;
  website_id: string;
  keyword: string;
  region?: string;
  search_volume?: number;
  difficulty?: number;
  status: 'active' | 'used' | 'archived';
  priority: number;
  created_at: string;
  last_used_at?: string;
}

// Research Agent Types
export interface ResearchInput {
  title: string;
  region?: string;
  competitorCount: number;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface SERPResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface ResearchOutput {
  title: string;
  region?: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  intentConfidence: number;
  topRankingFeatures: {
    contentLength: { min: number; max: number; avg: number };
    titlePatterns: string[];
    structurePatterns: string[];
    commonTopics: string[];
    commonFormats: string[];
  };
  contentGaps: string[];
  competitorAnalysis: {
    url: string;
    title: string;
    position: number;
    domain: string;
    estimatedWordCount: number;
    strengths: string[];
    weaknesses: string[];
    uniqueAngles: string[];
  }[];
  recommendedStrategy: string;
  relatedKeywords: string[];
  externalReferences?: ExternalReference[];
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Strategy Agent Types
export interface StrategyInput {
  researchData: ResearchOutput;
  brandVoice: BrandVoice;
  targetWordCount: number;
  title?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface Outline {
  introduction: {
    hook: string;
    context: string;
    thesis: string;
    wordCount: number;
  };
  mainSections: {
    heading: string;
    subheadings: string[];
    keyPoints: string[];
    targetWordCount: number;
    keywords: string[];
  }[];
  conclusion: {
    summary: string;
    callToAction: string;
    wordCount: number;
  };
  faq: {
    question: string;
    answerOutline: string;
  }[];
}

export interface StrategyOutput {
  titleOptions: string[];
  selectedTitle: string;
  outline: Outline;
  targetWordCount: number;
  sectionWordDistribution: {
    introduction: number;
    mainSections: number;
    conclusion: number;
    faq: number;
  };
  keywordDensityTarget: number;
  keywords: string[];
  relatedKeywords: string[];
  lsiKeywords: string[];
  internalLinkingStrategy: {
    targetSections: string[];
    suggestedTopics: string[];
    minLinks: number;
  };
  differentiationStrategy: {
    uniqueAngles: string[];
    valueProposition: string;
    competitiveAdvantages: string[];
  };
  externalReferences?: ExternalReference[];
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Writing Agent Types
export interface PreviousArticle {
  id: string;
  title: string;
  url: string;
  keywords: string[];
  excerpt: string;
}

export interface WritingInput {
  strategy: StrategyOutput;
  brandVoice: BrandVoice;
  previousArticles: PreviousArticle[];
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface WritingOutput {
  markdown: string;
  html: string;
  statistics: {
    wordCount: number;
    paragraphCount: number;
    sentenceCount: number;
    readingTime: number;
    averageSentenceLength: number;
  };
  internalLinks: {
    anchor: string;
    url: string;
    section: string;
    articleId: string;
  }[];
  keywordUsage: {
    count: number;
    density: number;
    distribution: { section: string; count: number }[];
  };
  readability: {
    fleschKincaidGrade: number;
    fleschReadingEase: number;
    gunningFogIndex: number;
  };
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Image Agent Types
export interface ImageInput {
  title: string;
  outline: Outline;
  count: number;
  brandStyle?: {
    colorScheme?: string[];
    style?: string;
    mood?: string;
  };
  model: string;
  quality: 'standard' | 'hd';
  size: string;
}

export interface GeneratedImage {
  url: string;
  localPath?: string;
  prompt: string;
  altText: string;
  suggestedSection?: string;
  width: number;
  height: number;
  model: string;
}

export interface ImageOutput {
  featuredImage: GeneratedImage;
  contentImages: GeneratedImage[];
  executionInfo: {
    model?: string;
    totalImages: number;
    executionTime: number;
    totalCost: number;
  };
}

// Meta Agent Types
export interface MetaInput {
  content: WritingOutput;
  keyword: string;
  titleOptions: string[];
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface MetaOutput {
  title: string;
  description: string;
  slug: string;
  seo: {
    title: string;
    description: string;
    keywords?: string[];
  };
  openGraph: {
    title: string;
    description: string;
    type: 'article';
    image?: string;
  };
  twitterCard: {
    card: 'summary_large_image';
    title: string;
    description: string;
    image?: string;
  };
  canonicalUrl?: string;
  focusKeyphrase: string;
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// HTML Agent Types
export interface ExternalReference {
  url: string;
  title: string;
  domain?: string;
  snippet?: string;
  type: 'wikipedia' | 'official_docs' | 'research' | 'news' | 'blog';
  relevantSection?: string;
  description: string;
}

export interface InternalLink {
  url: string;
  title: string;
  keywords: string[];
}

export interface HTMLInput {
  html: string;
  internalLinks: InternalLink[];
  externalReferences: ExternalReference[];
}

export interface HTMLOutput {
  html: string;
  linkCount: {
    internal: number;
    external: number;
  };
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Category Agent Types
export interface CategoryInput {
  title: string;
  content: string;
  keywords: string[];
  outline: StrategyOutput;
  language?: string;
}

export interface CategoryOutput {
  categories: {
    name: string;
    slug: string;
    confidence: number;
  }[];
  tags: {
    name: string;
    slug: string;
    relevance: number;
  }[];
  focusKeywords: string[];
  executionInfo?: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Quality Agent Types
export interface QualityInput {
  content: WritingOutput;
  images: ImageOutput;
  meta: MetaOutput;
  thresholds: {
    quality_threshold: number;
    content_length_min: number;
    content_length_max: number;
    keyword_density_min: number;
    keyword_density_max: number;
  };
}

export interface QualityCheck {
  passed: boolean;
  weight: number;
  score: number;
}

export interface QualityOutput {
  score: number;
  passed: boolean;
  checks: {
    wordCount: QualityCheck & { actual: number; expected: string };
    keywordDensity: QualityCheck & { actual: number; expected: string };
    structure: QualityCheck & { h1Count: number; h2Count: number; h3Count: number };
    internalLinks: QualityCheck & { count: number; expected: number };
    readability: QualityCheck & { score: number; level: string };
    seoOptimization: QualityCheck & { issues: string[] };
    images: QualityCheck & { count: number; hasAltText: boolean };
    formatting: QualityCheck & { issues: string[] };
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    message: string;
    section?: string;
  }[];
  warnings: string[];
  errors: string[];
  executionInfo: {
    executionTime: number;
    checksPerformed: number;
  };
}

// Orchestrator Types
export interface ArticleGenerationInput {
  articleJobId: string;
  companyId: string;
  websiteId: string;
  userId?: string;
  title: string;
  region?: string;
  targetLanguage?: string;
  wordCount?: number;
  imageCount?: number;
}

export interface ArticleGenerationResult {
  success: boolean;
  articleJobId: string;
  research?: ResearchOutput;
  strategy?: StrategyOutput;
  writing?: WritingOutput;
  image?: ImageOutput;
  meta?: MetaOutput;
  category?: CategoryOutput;
  quality?: QualityOutput;
  wordpress?: {
    postId: number;
    postUrl: string;
    status: string;
  };
  savedArticle?: {
    id: string;
    recommendationsCount: number;
  };
  executionStats: {
    totalTime: number;
    phases: {
      research: number;
      strategy: number;
      contentGeneration: number;
      metaGeneration: number;
    };
    parallelSpeedup: number;
  };
  errors?: Record<string, Error>;
  costBreakdown?: {
    research: { model: string; cost: number; tokens: number };
    strategy: { model: string; cost: number; tokens: number };
    writing: { model: string; cost: number; tokens: number };
    image: { model: string; cost: number; count: number };
    meta: { model: string; cost: number; tokens: number };
    total: number;
  };
}

// AI Client Types
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  messages?: AIMessage[];
  format?: 'text' | 'json';
  responseFormat?: any;
}

export interface AICompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface AIClientConfig {
  // API Keys
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  openaiApiKey?: string;
  perplexityApiKey?: string;

  // 配置
  maxRetries?: number;
  timeout?: number;
  enableFallback?: boolean;
}

export interface IntroductionInput {
  outline: Outline;
  featuredImage: GeneratedImage | null;
  brandVoice: BrandVoice;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface IntroductionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface SectionInput {
  section: MainSection;
  previousSummary?: string;
  sectionImage: GeneratedImage | null;
  brandVoice: BrandVoice;
  index: number;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SectionOutput {
  markdown: string;
  summary: string;
  wordCount: number;
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface ConclusionInput {
  outline: Outline;
  brandVoice: BrandVoice;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ConclusionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface QAInput {
  title: string;
  outline: Outline;
  brandVoice: BrandVoice;
  count?: number;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface QAOutput {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  markdown: string;
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface ContentAssemblerInput {
  title: string;
  introduction: IntroductionOutput;
  sections: SectionOutput[];
  conclusion: ConclusionOutput;
  qa: QAOutput;
}

export interface ContentAssemblerOutput {
  markdown: string;
  html: string;
  statistics: {
    totalWords: number;
    totalParagraphs: number;
    totalSections: number;
    totalFAQs: number;
  };
  executionInfo: {
    executionTime: number;
  };
}
