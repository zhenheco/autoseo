import type { BrandVoice, WorkflowSettings, AgentConfig } from "@/types/agents";

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  id: "",
  website_id: "",
  tone_of_voice: "professional",
  target_audience: "general audience",
  keywords: [],
  brand_name: "",
  writing_style: "professionalFormal",
  writing_style_config: {
    sentence_style: "mixed",
    interactivity_level: "medium",
    use_questions: true,
    examples_preference: "moderate",
  },
};

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  id: "",
  website_id: "",
  serp_analysis_enabled: true,
  competitor_count: 5,
  content_length_min: 1000,
  content_length_max: 1500,
  keyword_density_min: 0,
  keyword_density_max: 10,
  quality_threshold: 70,
  auto_publish: false,
  serp_model: "deepseek-chat",
  content_model: "deepseek-chat",
  meta_model: "deepseek-chat",
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
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

export const QUALITY_THRESHOLDS = {
  minWordCount: 1000,
  maxWordCount: 1500,
  minKeywordDensity: 0,
  maxKeywordDensity: 10,
  minH2Count: 3,
  maxH2Count: 10,
  minParagraphCount: 5,
  minReadabilityScore: 30,
  qualityPassScore: 70,
} as const;

export const METRICS = {
  PIPELINE_SUCCESS_RATE: "pipeline.success.rate",
  PIPELINE_DURATION: "pipeline.duration.ms",
  PHASE_DURATION: "phase.duration.ms",
  AGENT_TOKEN_USAGE: "agent.token.usage",
  CHECKPOINT_SAVE: "checkpoint.save.count",
  CHECKPOINT_RESUME: "checkpoint.resume.count",
  IDEMPOTENCY_HIT: "idempotency.hit.count",
  QUALITY_SCORE: "quality.score",
} as const;

export function getBrandVoiceWithDefaults(
  partial?: Partial<BrandVoice>,
): BrandVoice {
  const result: BrandVoice = {
    ...DEFAULT_BRAND_VOICE,
    ...partial,
  };

  // writing_style is now a string preset ID
  if (!result.writing_style) {
    result.writing_style = DEFAULT_BRAND_VOICE.writing_style;
  }

  // Merge writing_style_config if provided
  if (
    partial?.writing_style_config ||
    DEFAULT_BRAND_VOICE.writing_style_config
  ) {
    result.writing_style_config = {
      ...DEFAULT_BRAND_VOICE.writing_style_config,
      ...partial?.writing_style_config,
    } as BrandVoice["writing_style_config"];
  }

  return result;
}

export function getWorkflowSettingsWithDefaults(
  partial?: Partial<WorkflowSettings>,
): WorkflowSettings {
  return {
    ...DEFAULT_WORKFLOW_SETTINGS,
    ...partial,
  };
}

export function getAgentConfigWithDefaults(
  partial?: Partial<AgentConfig>,
): AgentConfig {
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...partial,
  };
}
