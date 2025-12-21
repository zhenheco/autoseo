/**
 * AI 模型同步 API（已停用）
 */

import { successResponse } from "@/lib/api/response-helpers";

export async function POST() {
  return successResponse({
    message:
      "模型同步已停用。系統現在使用預設模型配置（DeepSeek、OpenAI GPT Image、Gemini、Perplexity）。",
    models: {
      complex: "deepseek-reasoner",
      simple: "deepseek-chat",
      featuredImage: "gemini-3-pro-image-preview",
      otherImages: "gpt-image-1-mini",
      research: "perplexity/sonar",
    },
  });
}

export async function GET() {
  return successResponse({
    message: "模型同步已停用",
    description: "系統現在使用預設模型配置，不再從外部 API 同步模型列表",
  });
}
