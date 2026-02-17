// Agent 相關型別定義

export interface BrandVoice {
  id: string;
  website_id: string;
  tone_of_voice: string;
  target_audience: string;
  keywords: string[];
  sentence_style?: string;
  interactivity?: string;

  brand_name?: string;

  voice_examples?: {
    good_examples: string[];
    bad_examples?: string[];
  };

  /** Writing style preset ID (string stored in DB) */
  writing_style?: string;

  /** Legacy detailed writing style config (for backwards compat) */
  writing_style_config?: {
    sentence_style:
      | "short_punchy"
      | "conversational"
      | "academic"
      | "storytelling"
      | "mixed";
    interactivity_level: "low" | "medium" | "high";
    use_questions: boolean;
    examples_preference: "minimal" | "moderate" | "extensive";
  };

  brand_integration?: {
    max_brand_mentions: number;
    value_first: boolean;
  };
}

// Writing Style Preset IDs
export type WritingStylePreset =
  | "professionalFormal"
  | "casualFriendly"
  | "educational"
  | "persuasive"
  | "zhihuViral"
  | "businessMedia"
  | "deepAnalysis";

// Material Extractor Types
export interface MaterialsProfile {
  stories: Array<{
    subject: string;
    narrative: string;
    source: string;
    relevantTopics: string[];
  }>;
  statistics: Array<{
    fact: string;
    source: string;
    year?: number;
    confidence: "verified" | "inferred" | "uncertain";
  }>;
  quotes: Array<{
    text: string;
    speaker: string;
    source: string;
    relevantTopics: string[];
  }>;
  cases: Array<{
    title: string;
    description: string;
    outcome: "success" | "failure" | "mixed";
    source: string;
    timeframe?: string;
    relevantTopics: string[];
  }>;
  experts: Array<{
    name: string;
    title: string;
    relevance: string;
  }>;
  meta: {
    fetchedUrls: number;
    totalUrls: number;
    perplexitySufficient: boolean;
    extractionModel: string;
  };
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
  complex_processing_model?: string; // 複雜處理（研究、策略）
  simple_processing_model?: string; // 簡單功能（寫作、分類、標籤）

  // 舊的配置（向後相容）
  research_model: string;
  strategy_model: string;
  writing_model: string;
  image_model: string;
  featured_image_model?: string; // 精選圖片模型（如 gemini）
  content_image_model?: string; // 內容圖片模型（如 gpt-image-1-mini）
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
  status: "active" | "used" | "archived";
  priority: number;
  created_at: string;
  last_used_at?: string;
}

// Research Agent Types
export interface ResearchInput {
  title: string;
  region?: string;
  targetLanguage?: string;
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
  searchIntent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational";
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
  referenceMapping?: {
    url: string;
    title: string;
    type: ExternalReference["type"];
    suggestedSections: string[];
    relevanceScore: number;
  }[];
  deepResearch?: {
    trends?: {
      content: string;
      citations: string[];
      executionTime: number;
    };
    userQuestions?: {
      content: string;
      citations: string[];
      executionTime: number;
    };
    authorityData?: {
      content: string;
      citations: string[];
      executionTime: number;
    };
  };
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
  targetLanguage?: string;
  industry?: string | null;
  region?: string;
  title?: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface MainSection {
  heading: string;
  subheadings: string[];
  keyPoints: string[];
  targetWordCount: number;
  keywords: string[];
}

export interface Outline {
  introduction: {
    hook: string;
    context: string;
    thesis: string;
    wordCount: number;
  };
  mainSections: MainSection[];
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
  imageGuidance?: ImageGuidance; // 圖片生成指引
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// 圖片生成指引類型
export interface ImageGuidance {
  style: string; // 圖片風格描述（如："professional, modern, minimalist"）
  featuredImageText?: string; // 特色圖片的文字（可選）
  sectionImageTexts?: string[]; // 各段落圖片的文字（每個 mainSection 對應一個）
}

// Writing Agent Types
export interface PreviousArticle {
  id: string;
  title: string;
  slug: string;
  url: string;
  keywords: string[];
  excerpt: string;
}

export interface WritingInput {
  strategy: StrategyOutput;
  brandVoice: BrandVoice;
  previousArticles: PreviousArticle[];
  competitorAnalysis?: CompetitorAnalysisOutput;
  model: string;
  temperature: number;
  maxTokens: number;
  targetLanguage?: string;
  targetRegion?: string;
  materialsProfile?: MaterialsProfile;
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
  featuredImageModel?: string; // 精選圖片專用模型
  contentImageModel?: string; // 內容圖片專用模型
  quality: "low" | "medium" | "high" | "auto";
  size: string;
  targetLanguage?: string;
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
  featuredImage: GeneratedImage | null;
  contentImages: GeneratedImage[];
  executionInfo: {
    model?: string;
    totalImages: number;
    executionTime: number;
    totalCost: number;
  };
}

export interface FeaturedImageInput {
  title: string;
  brandStyle?: {
    colorScheme?: string[];
    style?: string;
    mood?: string;
  };
  model: string;
  quality: "low" | "medium" | "high" | "auto";
  size: string;
  targetLanguage?: string;
  articleContext?: {
    outline?: string[];
    mainTopics?: string[];
    keywords?: string[];
  };
  imageStyle?: string; // 從 Strategy 傳來的風格
  imageText?: string; // 要在圖片中顯示的文字（用雙引號包起來）
}

export interface FeaturedImageOutput {
  image: GeneratedImage | null;
  executionInfo: {
    model: string;
    executionTime: number;
    cost: number;
    skippedReason?: string;
  };
}

export interface ArticleImageInput {
  title: string;
  outline: Outline;
  brandStyle?: {
    colorScheme?: string[];
    style?: string;
    mood?: string;
  };
  model: string;
  quality: "low" | "medium" | "high" | "auto";
  size: string;
  targetLanguage?: string;
  maxImages?: number;
  imageStyle?: string; // 從 Strategy 傳來的風格
  sectionImageTexts?: string[]; // 各段落的圖片文字
}

export interface ArticleImageOutput {
  images: GeneratedImage[];
  executionInfo: {
    model: string;
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
  targetLanguage?: string;
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
    type: "article";
    image?: string;
  };
  twitterCard: {
    card: "summary_large_image";
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
  type:
    | "wikipedia"
    | "official_docs"
    | "research"
    | "news"
    | "blog"
    | "service"
    | "industry"
    | "tutorial";
  relevantSection?: string;
  description: string;
  relevance_score?: number;
}

export interface InternalLink {
  url: string;
  title: string;
  keywords?: string[];
  anchor?: string;
  isInternal?: boolean;
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
    structure: QualityCheck & {
      h1Count: number;
      h2Count: number;
      h3Count: number;
    };
    internalLinks: QualityCheck & { count: number; expected: number };
    readability: QualityCheck & { score: number; level: string };
    seoOptimization: QualityCheck & { issues: string[] };
    images: QualityCheck & { count: number; hasAltText: boolean };
    formatting: QualityCheck & { issues: string[] };
  };
  recommendations: {
    priority: "high" | "medium" | "low";
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
  industry?: string | null;
  language?: string;
  writingStyleOverride?: string;
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
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  messages?: AIMessage[];
  format?: "text" | "json";
  responseFormat?: {
    type: "json_object" | "json_schema";
    json_schema?: Record<string, unknown>;
  };
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
  targetLanguage?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  contentContext?: ContentContext;
  researchSummary?: ResearchSummary;
  materialsProfile?: MaterialsProfile;
}

export interface IntroductionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface ResearchContext {
  relevantData: string;
  citations: string[];
  statistics: string[];
}

export interface ResearchSummary {
  keyFindings: string;
  trendHighlight: string;
  topCitations: string[];
}

export interface SectionInput {
  section: MainSection;
  previousSummary?: string;
  sectionImage: GeneratedImage | null;
  brandVoice: BrandVoice;
  targetLanguage?: string;
  index: number;
  model: string;
  temperature?: number;
  maxTokens?: number;
  contentContext?: ContentContext;
  specialBlock?: SpecialBlock;
  researchContext?: ResearchContext;
  sectionMaterials?: Partial<MaterialsProfile>;
}

export interface SectionOutput {
  markdown: string;
  summary: string;
  wordCount: number;
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface ConclusionInput {
  outline: Outline;
  brandVoice: BrandVoice;
  targetLanguage?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  contentContext?: ContentContext;
  researchHighlights?: string;
}

export interface ConclusionOutput {
  markdown: string;
  wordCount: number;
  executionInfo: {
    model?: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

export interface QAInput {
  title: string;
  outline: Outline;
  brandVoice: BrandVoice;
  targetLanguage?: string;
  count?: number;
  model: string;
  temperature?: number;
  maxTokens?: number;
  contentContext?: ContentContext;
  userQuestions?: string;
}

export interface QAOutput {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  markdown: string;
  schemaJson: string;
  executionInfo: {
    model?: string;
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
  statistics: ArticleStatistics;
  executionInfo: {
    executionTime: number;
  };
}

// WritingAgent Output Types
export interface WritingAgentOutput {
  markdown: string;
  html: string;
  statistics: ArticleStatistics;
  readability: ReadabilityMetrics;
  keywordUsage: KeywordUsage;
  internalLinks: InternalLink[];
}

export interface ArticleStatistics {
  totalWords: number;
  totalParagraphs: number;
  totalSections: number;
  totalFAQs?: number;
}

export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  averageSentenceLength: number;
  averageWordLength: number;
}

export interface KeywordUsage {
  keyword: string;
  count: number;
  density: number;
  positions: string[];
  inTitle: boolean;
  inHeadings: boolean;
  inFirstParagraph: boolean;
  inLastParagraph: boolean;
}

// Link Enrichment Agent Types (deprecated - use LinkProcessorAgent)
export interface LinkEnrichmentInput {
  html: string;
  internalLinks: InternalLink[];
  externalReferences: ExternalReference[];
  targetLanguage?: string;
}

export interface LinkEnrichmentOutput {
  html: string;
  linkStats: {
    internalLinksInserted: number;
    externalLinksInserted: number;
    totalLinksInserted: number;
  };
  insertedLinks: {
    type: "internal" | "external";
    anchor: string;
    url: string;
    position: string;
  }[];
  executionInfo: {
    executionTime: number;
  };
}

// Link Processor Agent Types (unified link processing with semantic scoring)
export interface LinkProcessorConfig {
  maxInternalLinks: number;
  maxExternalLinks: number;
  maxLinksPerUrl: number;
  minDistanceBetweenLinks: number;
  minSemanticScore: number;
}

export interface LinkProcessorInput {
  html: string;
  internalLinks: InternalLink[];
  externalReferences: ExternalReference[];
  targetLanguage?: string;
}

export interface LinkInsertionStats {
  internalLinksInserted: number;
  externalLinksInserted: number;
  totalLinksInserted: number;
  semanticScoreAverage: number;
  rejectedLowScore: number;
}

export interface InsertedLinkDetail {
  type: "internal" | "external";
  anchor: string;
  url: string;
  position: string;
  section: string;
  semanticScore: number;
}

export interface LinkProcessorOutput {
  html: string;
  linkStats: LinkInsertionStats;
  insertedLinks: InsertedLinkDetail[];
  executionInfo: {
    executionTime: number;
  };
}

// Deep Research Types (Perplexity Integration)
export interface DeepResearchQueryResult {
  content: string;
  citations: string[];
  executionTime: number;
}

export interface DeepResearchResult {
  trends?: DeepResearchQueryResult;
  userQuestions?: DeepResearchQueryResult;
  authorityData?: DeepResearchQueryResult;
}

// Content Context Types (for topic alignment)
export interface ContentContext {
  primaryKeyword: string;
  selectedTitle: string;
  searchIntent: string;
  targetAudience: string;
  topicKeywords: string[];
  regionContext?: string;
  industryContext?: string;
  brandName?: string;
  toneGuidance?: string;
}

// Special Block Types
export interface SpecialBlock {
  type:
    | "expert_tip"
    | "tip_block"
    | "local_advantage"
    | "expert_warning"
    | "warning_block";
  content: string;
}

// Content Plan Agent Types
export interface ContentPlanInput {
  strategy: StrategyOutput;
  research: ResearchOutput;
  competitorAnalysis?: CompetitorAnalysisOutput;
  brandVoice: BrandVoice;
  targetLanguage?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SectionPlan {
  h2Title: string;
  subheadings: string[];
  writingInstructions: string;
  researchInsights: string[];
  targetWordCount: number;
  specialBlock?: SpecialBlock;
  keyPoints: string[];
  materialQuery?: string;
}

export interface FAQPlan {
  h2Title: string;
  questions: {
    question: string;
    answerGuidelines: string;
  }[];
  targetWordCount: number;
}

export interface ContentPlanOutput {
  optimizedTitle: {
    primary: string;
    alternatives: string[];
    reasoning: string;
  };
  contentStrategy: {
    primaryAngle: string;
    userPainPoints: string[];
    valueProposition: string;
    differentiationPoints: string[];
    toneGuidance: string;
  };
  detailedOutline: {
    introduction: {
      hook: string;
      context: string;
      thesis: string;
      targetWordCount: number;
    };
    mainSections: SectionPlan[];
    faq: FAQPlan;
    conclusion: {
      summary: string;
      callToAction: string;
      targetWordCount: number;
    };
  };
  seoOptimization: {
    primaryKeyword: string;
    secondaryKeywords: string[];
    lsiKeywords: string[];
    keywordPlacement: {
      title: boolean;
      h2Headings: boolean;
      firstParagraph: boolean;
      conclusion: boolean;
    };
  };
  localization: {
    region: string;
    culturalNotes: string[];
    localExamples: string[];
  };
  researchInsights: {
    trendTopics: string[];
    userConcerns: string[];
    authorityPoints: string[];
  };
  executionInfo: {
    model: string;
    totalTokens: number;
    latencyMs: number;
  };
}

// Competitor Analysis Agent Types
export interface CompetitorAnalysisInput {
  serpData: ResearchOutput;
  primaryKeyword: string;
  targetLanguage: string;
}

export interface CompetitorAnalysisOutput {
  competitorAnalysis: {
    topSiteFeatures: string;
    contentLength: string;
    titlePatterns: string;
    contentStructure: string;
    missingAngles: string[];
  };
  differentiationStrategy: {
    contentAngle: string;
    valueEnhancement: string;
    userExperience: string;
  };
  seoOpportunities: {
    keywordGaps: string[];
    structureOptimization: string;
    eatImprovement: string;
  };
  contentRecommendations: {
    mustInclude: string[];
    canSkip: string[];
    focusAreas: string[];
  };
  executionInfo: {
    model: string;
    executionTime: number;
    tokenUsage: { input: number; output: number };
  };
}

// Unified Strategy Agent Types (Linear Pipeline)
export interface UnifiedStrategyInput {
  research: ResearchOutput;
  competitorAnalysis?: CompetitorAnalysisOutput;
  brandVoice?: BrandVoice;
  targetWordCount: number;
  targetLanguage?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface UnifiedStrategyOutput {
  strategy: StrategyOutput;
  contentPlan: ContentPlanOutput;
}

// Unified Writing Agent Types (Linear Pipeline)
export interface UnifiedWritingInput {
  strategy: StrategyOutput;
  contentPlan?: ContentPlanOutput;
  brandVoice: BrandVoice;
  imageOutput?: ImageOutput;
  targetLanguage?: string;
  primaryKeyword: string;
  industry?: string;
  region?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// Quality Gate Agent Types (Linear Pipeline)
export interface QualityGateInput {
  writing: WritingOutput;
  meta?: MetaOutput;
  strategy?: StrategyOutput;
  primaryKeyword: string;
  targetWordCount: number;
  targetLanguage: string;
  qualityThreshold?: number;
}

export interface QualityCheckItem {
  name: string;
  passed: boolean;
  score: number;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  checks: QualityCheckItem[];
  suggestions: string[];
  blockers: string[];
}
