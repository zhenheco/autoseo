import type { BrandVoice, WorkflowSettings, AgentConfig } from "@/types/agents";

export const DEFAULT_BRAND_VOICE: BrandVoice = {
  id: "",
  website_id: "",
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

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  id: "",
  website_id: "",
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
  image_size: "1024x1024",
  image_count: 3,
  meta_enabled: true,
  meta_model: "deepseek-chat",
  meta_temperature: 0.3,
  meta_max_tokens: 1024,
};

export const QUALITY_THRESHOLDS = {
  minWordCount: 1500,
  maxWordCount: 4000,
  minKeywordDensity: 0.5,
  maxKeywordDensity: 2.5,
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

  if (partial?.writing_style || DEFAULT_BRAND_VOICE.writing_style) {
    result.writing_style = {
      sentence_style:
        partial?.writing_style?.sentence_style ??
        DEFAULT_BRAND_VOICE.writing_style?.sentence_style ??
        "mixed",
      interactivity_level:
        partial?.writing_style?.interactivity_level ??
        DEFAULT_BRAND_VOICE.writing_style?.interactivity_level ??
        "medium",
      use_questions:
        partial?.writing_style?.use_questions ??
        DEFAULT_BRAND_VOICE.writing_style?.use_questions ??
        true,
      examples_preference:
        partial?.writing_style?.examples_preference ??
        DEFAULT_BRAND_VOICE.writing_style?.examples_preference ??
        "moderate",
    };
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
