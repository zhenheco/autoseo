import type {
  BrandVoice,
  WorkflowSettings,
  AgentConfig,
  ResearchOutput,
  StrategyOutput,
  WritingOutput,
  ImageOutput,
  MetaOutput,
  CategoryOutput,
  ContentPlanOutput,
  CompetitorAnalysisOutput,
  ExternalReference,
} from "@/types/agents";

export enum PipelinePhase {
  INIT = "init",
  RESEARCH = "research",
  COMPETITOR_ANALYSIS = "competitor_analysis",
  STRATEGY = "strategy",
  CONTENT_PLAN = "content_plan",
  WRITING = "writing",
  LINK_ENRICHMENT = "link_enrichment",
  HTML = "html",
  META = "meta",
  IMAGE = "image",
  CATEGORY = "category",
  PUBLISH = "publish",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface PipelineError {
  phase: PipelinePhase;
  message: string;
  code?: string;
  timestamp: Date;
  retryCount?: number;
  stack?: string;
}

export interface PipelineWarning {
  phase: PipelinePhase;
  message: string;
  timestamp: Date;
}

export interface ReferenceMapping {
  url: string;
  title: string;
  type: ExternalReference["type"];
  suggestedSections: string[];
  relevanceScore: number;
}

export interface WebsiteSettings {
  id: string;
  name: string;
  url: string;
  targetLanguage: string;
  defaultIndustry?: string;
  defaultRegion?: string;
  competitorDomains?: string[];
}

export interface PipelineContextData {
  keyword: string;
  targetLanguage: string;
  industry?: string;
  region?: string;
  targetWordCount: number;
  imageCount: number;

  brandVoice: BrandVoice;
  websiteSettings: WebsiteSettings;
  workflowSettings: WorkflowSettings;
  agentConfig: AgentConfig;

  currentPhase: PipelinePhase;
  completedPhases: PipelinePhase[];
  startedAt: Date;
  updatedAt: Date;

  research?: ResearchOutput;
  competitorAnalysis?: CompetitorAnalysisOutput;
  strategy?: StrategyOutput;
  contentPlan?: ContentPlanOutput;
  writing?: WritingOutput;
  html?: string;
  meta?: MetaOutput;
  images?: ImageOutput;
  category?: CategoryOutput;

  referenceMapping?: ReferenceMapping[];

  errors: PipelineError[];
  warnings: PipelineWarning[];
}

export interface PipelineContextOptions {
  articleJobId: string;
  companyId: string;
  websiteId: string;
  userId?: string;
  keyword: string;
  targetLanguage?: string;
  targetWordCount?: number;
  imageCount?: number;
  industry?: string;
  region?: string;
}

export class PipelineContext {
  private data: PipelineContextData;
  private readonly articleJobId: string;
  private readonly companyId: string;
  private readonly websiteId: string;
  private readonly userId?: string;

  constructor(options: PipelineContextOptions) {
    this.articleJobId = options.articleJobId;
    this.companyId = options.companyId;
    this.websiteId = options.websiteId;
    this.userId = options.userId;

    this.data = {
      keyword: options.keyword,
      targetLanguage: options.targetLanguage || "zh-TW",
      industry: options.industry,
      region: options.region,
      targetWordCount: options.targetWordCount || 2000,
      imageCount: options.imageCount || 3,

      brandVoice: this.getDefaultBrandVoice(),
      websiteSettings: this.getDefaultWebsiteSettings(),
      workflowSettings: this.getDefaultWorkflowSettings(),
      agentConfig: this.getDefaultAgentConfig(),

      currentPhase: PipelinePhase.INIT,
      completedPhases: [],
      startedAt: new Date(),
      updatedAt: new Date(),

      errors: [],
      warnings: [],
    };
  }

  getArticleJobId(): string {
    return this.articleJobId;
  }

  getCompanyId(): string {
    return this.companyId;
  }

  getWebsiteId(): string {
    return this.websiteId;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  getKeyword(): string {
    return this.data.keyword;
  }

  getTargetLanguage(): string {
    return this.data.targetLanguage;
  }

  getIndustry(): string | undefined {
    return this.data.industry;
  }

  getRegion(): string | undefined {
    return this.data.region;
  }

  getTargetWordCount(): number {
    return this.data.targetWordCount;
  }

  getImageCount(): number {
    return this.data.imageCount;
  }

  getBrandVoice(): BrandVoice {
    return this.data.brandVoice;
  }

  getWebsiteSettings(): WebsiteSettings {
    return this.data.websiteSettings;
  }

  getWorkflowSettings(): WorkflowSettings {
    return this.data.workflowSettings;
  }

  getAgentConfig(): AgentConfig {
    return this.data.agentConfig;
  }

  getCurrentPhase(): PipelinePhase {
    return this.data.currentPhase;
  }

  getCompletedPhases(): PipelinePhase[] {
    return [...this.data.completedPhases];
  }

  getResearch(): ResearchOutput | undefined {
    return this.data.research;
  }

  getCompetitorAnalysis(): CompetitorAnalysisOutput | undefined {
    return this.data.competitorAnalysis;
  }

  getStrategy(): StrategyOutput | undefined {
    return this.data.strategy;
  }

  getContentPlan(): ContentPlanOutput | undefined {
    return this.data.contentPlan;
  }

  getWriting(): WritingOutput | undefined {
    return this.data.writing;
  }

  getHtml(): string | undefined {
    return this.data.html;
  }

  getMeta(): MetaOutput | undefined {
    return this.data.meta;
  }

  getImages(): ImageOutput | undefined {
    return this.data.images;
  }

  getCategory(): CategoryOutput | undefined {
    return this.data.category;
  }

  getReferenceMapping(): ReferenceMapping[] | undefined {
    return this.data.referenceMapping;
  }

  getErrors(): PipelineError[] {
    return [...this.data.errors];
  }

  getWarnings(): PipelineWarning[] {
    return [...this.data.warnings];
  }

  getStartedAt(): Date {
    return this.data.startedAt;
  }

  getElapsedTimeMs(): number {
    return Date.now() - this.data.startedAt.getTime();
  }

  setBrandVoice(brandVoice: BrandVoice): void {
    this.data.brandVoice = brandVoice;
    this.touch();
  }

  setWebsiteSettings(settings: WebsiteSettings): void {
    this.data.websiteSettings = settings;
    this.touch();
  }

  setWorkflowSettings(settings: WorkflowSettings): void {
    this.data.workflowSettings = settings;
    this.touch();
  }

  setAgentConfig(config: AgentConfig): void {
    this.data.agentConfig = config;
    this.touch();
  }

  setCurrentPhase(phase: PipelinePhase): void {
    this.data.currentPhase = phase;
    this.touch();
  }

  completePhase(phase: PipelinePhase): void {
    if (!this.data.completedPhases.includes(phase)) {
      this.data.completedPhases.push(phase);
    }
    this.touch();
  }

  setResearch(output: ResearchOutput): void {
    this.data.research = output;
    this.completePhase(PipelinePhase.RESEARCH);
  }

  setCompetitorAnalysis(output: CompetitorAnalysisOutput): void {
    this.data.competitorAnalysis = output;
    this.completePhase(PipelinePhase.COMPETITOR_ANALYSIS);
  }

  setStrategy(output: StrategyOutput): void {
    this.data.strategy = output;
    this.completePhase(PipelinePhase.STRATEGY);
  }

  setContentPlan(output: ContentPlanOutput): void {
    this.data.contentPlan = output;
    this.completePhase(PipelinePhase.CONTENT_PLAN);
  }

  setWriting(output: WritingOutput): void {
    this.data.writing = output;
    this.completePhase(PipelinePhase.WRITING);
  }

  setHtml(html: string): void {
    this.data.html = html;
    this.completePhase(PipelinePhase.HTML);
  }

  setMeta(output: MetaOutput): void {
    this.data.meta = output;
    this.completePhase(PipelinePhase.META);
  }

  setImages(output: ImageOutput): void {
    this.data.images = output;
    this.completePhase(PipelinePhase.IMAGE);
  }

  setCategory(output: CategoryOutput): void {
    this.data.category = output;
    this.completePhase(PipelinePhase.CATEGORY);
  }

  setReferenceMapping(mapping: ReferenceMapping[]): void {
    this.data.referenceMapping = mapping;
    this.touch();
  }

  addError(error: Omit<PipelineError, "timestamp">): void {
    this.data.errors.push({
      ...error,
      timestamp: new Date(),
    });
    this.touch();
  }

  addWarning(warning: Omit<PipelineWarning, "timestamp">): void {
    this.data.warnings.push({
      ...warning,
      timestamp: new Date(),
    });
    this.touch();
  }

  hasErrors(): boolean {
    return this.data.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.data.warnings.length > 0;
  }

  isPhaseCompleted(phase: PipelinePhase): boolean {
    return this.data.completedPhases.includes(phase);
  }

  markCompleted(): void {
    this.data.currentPhase = PipelinePhase.COMPLETED;
    this.completePhase(PipelinePhase.COMPLETED);
  }

  markFailed(error?: Omit<PipelineError, "timestamp">): void {
    this.data.currentPhase = PipelinePhase.FAILED;
    if (error) {
      this.addError(error);
    }
  }

  toJSON(): PipelineContextData & {
    articleJobId: string;
    companyId: string;
    websiteId: string;
    userId?: string;
  } {
    return {
      ...this.data,
      articleJobId: this.articleJobId,
      companyId: this.companyId,
      websiteId: this.websiteId,
      userId: this.userId,
    };
  }

  static fromJSON(
    json: PipelineContextData & {
      articleJobId: string;
      companyId: string;
      websiteId: string;
      userId?: string;
    },
  ): PipelineContext {
    const context = new PipelineContext({
      articleJobId: json.articleJobId,
      companyId: json.companyId,
      websiteId: json.websiteId,
      userId: json.userId,
      keyword: json.keyword,
      targetLanguage: json.targetLanguage,
      targetWordCount: json.targetWordCount,
      imageCount: json.imageCount,
      industry: json.industry,
      region: json.region,
    });

    context.data = {
      ...json,
      startedAt: new Date(json.startedAt),
      updatedAt: new Date(json.updatedAt),
      errors: json.errors.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      warnings: json.warnings.map((w) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      })),
    };

    return context;
  }

  private touch(): void {
    this.data.updatedAt = new Date();
  }

  private getDefaultBrandVoice(): BrandVoice {
    return {
      id: "",
      website_id: this.websiteId,
      tone_of_voice: "professional",
      target_audience: "general audience",
      keywords: [],
      brand_name: "",
      writing_style: {
        sentence_style: "mixed",
        interactivity_level: "medium",
        use_questions: true,
        examples_preference: "moderate",
      },
    };
  }

  private getDefaultWebsiteSettings(): WebsiteSettings {
    return {
      id: this.websiteId,
      name: "",
      url: "",
      targetLanguage: this.data?.targetLanguage || "zh-TW",
    };
  }

  private getDefaultWorkflowSettings(): WorkflowSettings {
    return {
      id: "",
      website_id: this.websiteId,
      serp_analysis_enabled: true,
      competitor_count: 5,
      content_length_min: 1500,
      content_length_max: 4000,
      keyword_density_min: 0.5,
      keyword_density_max: 2.5,
      quality_threshold: 70,
      auto_publish: false,
      serp_model: "deepseek-chat",
      content_model: "deepseek-chat",
      meta_model: "deepseek-chat",
    };
  }

  private getDefaultAgentConfig(): AgentConfig {
    return {
      research_model: "deepseek-chat",
      strategy_model: "deepseek-chat",
      writing_model: "deepseek-chat",
      image_model: "fal-ai/qwen-image",
      featured_image_model: "fal-ai/qwen-image",
      content_image_model: "fal-ai/qwen-image",
      research_temperature: 0.3,
      strategy_temperature: 0.5,
      writing_temperature: 0.7,
      research_max_tokens: 4096,
      strategy_max_tokens: 4096,
      writing_max_tokens: 8192,
      image_size: "1792x1024",
      image_count: 3,
      meta_enabled: true,
      meta_model: "deepseek-chat",
      meta_temperature: 0.3,
      meta_max_tokens: 1024,
    };
  }
}
