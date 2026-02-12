/**
 * Pipeline 共用 Helper 函數
 * 從 orchestrator.ts 提取的資料庫查詢和配置取得邏輯
 */
import { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandVoice,
  WorkflowSettings,
  AgentConfig,
  PreviousArticle,
  AIClientConfig,
} from "@/types/agents";
import type { AIModel } from "@/types/ai-models";

/** AgentConfig 擴展型別，包含 AI 模型詳細資訊 */
export type AgentConfigWithModels = AgentConfig & {
  complexModel?: AIModel;
  simpleModel?: AIModel;
  imageModelInfo?: AIModel;
  researchModelInfo?: AIModel;
};

/** 預設 BrandVoice */
function getDefaultBrandVoice(websiteId: string | null): BrandVoice {
  return {
    id: "",
    website_id: websiteId || "",
    tone_of_voice: "專業、友善、易懂",
    target_audience: "一般網路使用者",
    keywords: [],
    writing_style: {
      sentence_style: "mixed",
      interactivity_level: "medium",
      use_questions: true,
      examples_preference: "moderate",
    },
    brand_integration: {
      max_brand_mentions: 3,
      value_first: true,
    },
  };
}

/** 預設 AgentConfig */
function getDefaultAgentConfig(): AgentConfigWithModels {
  return {
    complex_processing_model: "deepseek-chat",
    simple_processing_model: "deepseek-chat",
    research_model: "deepseek-chat",
    strategy_model: "deepseek-chat",
    writing_model: "deepseek-chat",
    image_model: "fal-ai/qwen-image",
    research_temperature: 0.7,
    strategy_temperature: 0.7,
    writing_temperature: 0.7,
    research_max_tokens: 64000,
    strategy_max_tokens: 64000,
    writing_max_tokens: 64000,
    image_size: "1792x1024",
    image_count: 3,
    meta_enabled: true,
    meta_model: "deepseek-chat",
    meta_temperature: 0.7,
    meta_max_tokens: 64000,
  };
}

/** 預設 WorkflowSettings */
function getDefaultWorkflowSettings(
  websiteId: string | null,
): WorkflowSettings {
  return {
    id: "",
    website_id: websiteId || "",
    serp_analysis_enabled: true,
    competitor_count: 10,
    content_length_min: 1000,
    content_length_max: 3000,
    keyword_density_min: 0,
    keyword_density_max: 10,
    quality_threshold: 80,
    auto_publish: false,
    serp_model: "perplexity-research",
    content_model: "deepseek-chat",
    meta_model: "deepseek-chat",
  };
}

/**
 * 取得網站 Brand Voice 設定
 */
export async function getBrandVoice(
  supabase: SupabaseClient,
  websiteId: string | null,
): Promise<BrandVoice> {
  const defaultBrandVoice = getDefaultBrandVoice(websiteId);

  if (!websiteId || websiteId === "null") {
    console.warn("[Pipeline] 無 websiteId，使用預設 brand_voice");
    return defaultBrandVoice;
  }

  const { data: website, error } = await supabase
    .from("website_configs")
    .select("brand_voice")
    .eq("id", websiteId)
    .single();

  if (error || !website?.brand_voice) {
    console.warn("[Pipeline] 使用預設 brand_voice");
    return defaultBrandVoice;
  }

  const bv = website.brand_voice as {
    brand_name?: string;
    tone_of_voice?: string;
    target_audience?: string;
    writing_style?: string;
    sentence_style?: string;
    interactivity?: string;
    voice_examples?: {
      good_examples?: string[];
      bad_examples?: string[];
    };
  };
  console.log("[Pipeline] 使用 website brand_voice", bv);
  return {
    id: "",
    website_id: websiteId,
    tone_of_voice: bv.tone_of_voice || defaultBrandVoice.tone_of_voice,
    target_audience: bv.target_audience || defaultBrandVoice.target_audience,
    keywords: [],
    sentence_style: bv.sentence_style || bv.writing_style || "清晰簡潔",
    interactivity: bv.interactivity || "適度互動",
    brand_name: bv.brand_name,
    voice_examples: bv.voice_examples?.good_examples
      ? {
          good_examples: bv.voice_examples.good_examples,
          bad_examples: bv.voice_examples.bad_examples,
        }
      : undefined,
    writing_style: {
      sentence_style:
        (bv.sentence_style as BrandVoice["writing_style"])?.sentence_style ||
        "mixed",
      interactivity_level: "medium",
      use_questions: true,
      examples_preference: "moderate",
    },
    brand_integration: {
      max_brand_mentions: 3,
      value_first: true,
    },
  };
}

/**
 * 取得網站語言/產業/地區設定
 */
export async function getWebsiteSettings(
  supabase: SupabaseClient,
  websiteId: string | null,
): Promise<{ language: string; industry: string | null; region: string }> {
  const defaults = {
    language: "zh-TW",
    industry: null as string | null,
    region: "台灣",
  };

  if (!websiteId || websiteId === "null") {
    return defaults;
  }

  const { data, error } = await supabase
    .from("website_configs")
    .select("language, industry, region")
    .eq("id", websiteId)
    .single();

  if (error || !data) {
    console.warn("[Pipeline] 使用預設網站設定");
    return defaults;
  }

  return {
    language: data.language || defaults.language,
    industry: data.industry || defaults.industry,
    region: data.region || defaults.region,
  };
}

/**
 * 取得 Workflow Settings
 */
export async function getWorkflowSettings(
  supabase: SupabaseClient,
  websiteId: string | null,
): Promise<WorkflowSettings> {
  if (!websiteId || websiteId === "null") {
    console.warn("[Pipeline] website_id 為 null，使用預設 workflow_settings");
    return getDefaultWorkflowSettings(websiteId);
  }

  const { data: workflowSettings, error } = await supabase
    .from("workflow_settings")
    .select("*")
    .eq("website_id", websiteId);

  if (error) {
    console.error("[Pipeline] 查詢 workflow_settings 失敗:", error);
    return getDefaultWorkflowSettings(websiteId);
  }

  const workflowSetting = workflowSettings?.[0];
  if (!workflowSetting) {
    console.warn(
      "[Pipeline] website_id 沒有對應的 workflow_settings，使用預設值",
    );
    return getDefaultWorkflowSettings(websiteId);
  }

  return workflowSetting;
}

/**
 * 取得 Agent 配置（含 AI 模型詳細資訊）
 */
export async function getAgentConfig(
  supabase: SupabaseClient,
  websiteId: string | null,
): Promise<AgentConfigWithModels> {
  if (!websiteId || websiteId === "null") {
    console.warn("[Pipeline] website_id 為 null，使用預設 agent_configs");
    return getDefaultAgentConfig();
  }

  const { data: agentConfigs, error: configError } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("website_id", websiteId);

  const agentConfig = agentConfigs?.[0];

  if (configError) {
    console.error("[Pipeline] 查詢 agent_configs 失敗:", configError);
    return getDefaultAgentConfig();
  }

  if (!agentConfig) {
    console.warn(
      "[Pipeline] website_id 沒有對應的 agent_configs，使用預設配置",
    );
    return getDefaultAgentConfig();
  }

  const modelIds = [
    agentConfig.complex_processing_model,
    agentConfig.simple_processing_model,
    agentConfig.image_model,
    agentConfig.research_model,
  ].filter(Boolean);

  const { data: models, error: modelsError } = await supabase
    .from("ai_models")
    .select("*")
    .in("model_id", modelIds);

  if (modelsError) {
    console.error("[Pipeline] 查詢 ai_models 失敗:", modelsError);
  }

  const modelsMap = new Map<string, AIModel>(
    (models || []).map((model: AIModel) => [model.model_id, model]),
  );

  return {
    complex_processing_model: agentConfig.complex_processing_model,
    simple_processing_model: agentConfig.simple_processing_model,
    research_model:
      agentConfig.research_model ||
      agentConfig.complex_processing_model ||
      "deepseek-chat",
    strategy_model: agentConfig.complex_processing_model || "deepseek-chat",
    writing_model: agentConfig.simple_processing_model || "deepseek-chat",
    image_model: agentConfig.image_model || "fal-ai/qwen-image",
    research_temperature: agentConfig.research_temperature || 0.7,
    strategy_temperature: agentConfig.strategy_temperature || 0.7,
    writing_temperature: agentConfig.writing_temperature || 0.7,
    research_max_tokens: agentConfig.research_max_tokens || 64000,
    strategy_max_tokens: agentConfig.strategy_max_tokens || 64000,
    writing_max_tokens: agentConfig.writing_max_tokens || 64000,
    image_size: agentConfig.image_size || "1024x1024",
    image_count: agentConfig.image_count || 3,
    meta_enabled: agentConfig.meta_enabled !== false,
    meta_model:
      agentConfig.meta_model ||
      agentConfig.simple_processing_model ||
      "deepseek-chat",
    meta_temperature: agentConfig.meta_temperature || 0.7,
    meta_max_tokens: agentConfig.meta_max_tokens || 16000,
    complexModel: modelsMap.get(agentConfig.complex_processing_model),
    simpleModel: modelsMap.get(agentConfig.simple_processing_model),
    imageModelInfo: modelsMap.get(agentConfig.image_model),
    researchModelInfo: modelsMap.get(agentConfig.research_model),
  };
}

/**
 * 取得相關歷史文章（用於內部連結）
 */
export async function getPreviousArticles(
  supabase: SupabaseClient,
  websiteId: string | null,
  currentArticleTitle: string,
): Promise<PreviousArticle[]> {
  if (!websiteId || websiteId === "null") {
    console.warn("[Pipeline] website_id 為 null，返回空的歷史文章列表");
    return [];
  }

  const { data: websiteConfig } = await supabase
    .from("website_configs")
    .select("wordpress_url")
    .eq("id", websiteId)
    .single();

  const baseUrl = websiteConfig?.wordpress_url || "";

  const { data, error } = await supabase
    .from("generated_articles")
    .select("id, title, slug, keywords, excerpt, wordpress_post_url, status")
    .eq("website_id", websiteId)
    .or("status.eq.published,status.eq.reviewed")
    .textSearch("title", currentArticleTitle, {
      type: "websearch",
      config: "simple",
    })
    .limit(20);

  if (error) {
    console.error("[Pipeline] 查詢相關文章失敗:", error);
    return [];
  }

  console.log(`[Pipeline] 找到 ${data?.length || 0} 篇相關文章`, {
    websiteId,
    searchTitle: currentArticleTitle,
    baseUrl,
  });

  return (data || []).map((article) => {
    const url =
      article.status === "published" && baseUrl
        ? `${baseUrl}/${article.slug}`
        : `/dashboard/articles/${article.id}/preview`;

    return {
      id: article.id,
      title: article.title,
      slug: article.slug || "",
      url,
      keywords: article.keywords || [],
      excerpt: article.excerpt || "",
    };
  });
}

/**
 * 取得 WordPress 配置
 */
export async function getWordPressConfig(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<{
  enabled: boolean;
  url: string;
  username: string;
  applicationPassword: string;
  accessToken?: string;
  refreshToken?: string;
} | null> {
  if (
    !websiteId ||
    websiteId === "null" ||
    websiteId === "undefined" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      websiteId,
    )
  ) {
    return null;
  }

  const { data: configs, error } = await supabase
    .from("website_configs")
    .select(
      "wordpress_url, wp_username, wp_app_password, wp_enabled, wordpress_access_token, wordpress_refresh_token",
    )
    .eq("id", websiteId);

  if (error) {
    console.error("[Pipeline] 查詢 website_configs 失敗:", error);
    return null;
  }

  const data = configs?.[0];
  if (!data?.wp_enabled) {
    return null;
  }

  if (
    !data.wordpress_url ||
    (!data.wp_app_password && !data.wordpress_access_token)
  ) {
    return null;
  }

  return {
    enabled: true,
    url: data.wordpress_url,
    username: data.wp_username,
    applicationPassword: data.wp_app_password,
    accessToken: data.wordpress_access_token,
    refreshToken: data.wordpress_refresh_token,
  };
}

/**
 * 取得 AI 服務配置
 */
export function getAIConfig(): AIClientConfig {
  return {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  };
}
