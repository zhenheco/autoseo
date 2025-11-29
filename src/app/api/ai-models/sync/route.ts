import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
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
  return NextResponse.json({
    success: true,
    message: "模型同步已停用",
    description: "系統現在使用預設模型配置，不再從外部 API 同步模型列表",
  });
}
