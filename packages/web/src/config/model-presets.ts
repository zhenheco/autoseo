/**
 * 預設模型配置方案
 * 使用 DeepSeek + Gemini + OpenAI 的組合
 */

export interface ModelPreset {
  name: string;
  description: string;
  models: {
    complex_processing_model: string;
    simple_processing_model: string;
    research_model: string;
    featured_image_model: string;
    content_image_model: string;
  };
  imageSettings: {
    quality: "low" | "medium" | "high" | "auto";
    size: string;
  };
}

export const DEFAULT_MODEL_PRESET: ModelPreset = {
  name: "標準版",
  description:
    "使用 DeepSeek 進行文字處理，Gemini 生成精選圖片，GPT Image 生成內容圖片",
  models: {
    complex_processing_model: "deepseek-reasoner",
    simple_processing_model: "deepseek-chat",
    research_model: "perplexity/sonar",
    featured_image_model: "gemini-3-pro-image-preview",
    content_image_model: "gpt-image-1-mini",
  },
  imageSettings: {
    quality: "low",
    size: "1024x1024",
  },
};

export const modelPresets: Record<string, ModelPreset> = {
  standard: DEFAULT_MODEL_PRESET,

  noImages: {
    name: "純文字版",
    description: "只生成文字內容，不生成圖片",
    models: {
      complex_processing_model: "deepseek-reasoner",
      simple_processing_model: "deepseek-chat",
      research_model: "perplexity/sonar",
      featured_image_model: "none",
      content_image_model: "none",
    },
    imageSettings: {
      quality: "low",
      size: "1024x1024",
    },
  },
};

export function getModelPreset(presetName: string = "standard"): ModelPreset {
  return modelPresets[presetName] || DEFAULT_MODEL_PRESET;
}

export function getPresetNames(): string[] {
  return Object.keys(modelPresets);
}
