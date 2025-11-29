import { NextRequest, NextResponse } from "next/server";
import { getAPIRouter } from "@/lib/ai/api-router";
import { createClient } from "@/lib/supabase/server";

const INDUSTRY_LABELS: Record<string, string> = {
  tech: "科技",
  finance: "金融",
  healthcare: "醫療",
  education: "教育",
  realestate: "房地產",
  travel: "旅遊",
  food: "餐飲",
  ecommerce: "電商",
  legal: "法律",
  manufacturing: "製造業",
};

const REGION_LABELS: Record<string, string> = {
  taiwan: "台灣",
  japan: "日本",
  usa: "美國",
  singapore: "新加坡",
  hongkong: "香港",
  china: "中國",
  korea: "韓國",
  global: "全球",
};

const LANGUAGE_CONFIG: Record<string, { name: string; instruction: string }> = {
  "zh-TW": { name: "繁體中文", instruction: "請使用繁體中文撰寫" },
  "zh-CN": { name: "简体中文", instruction: "请使用简体中文撰写" },
  "en-US": { name: "English", instruction: "Please write in English" },
  "ja-JP": { name: "日本語", instruction: "日本語で書いてください" },
  "ko-KR": { name: "한국어", instruction: "한국어로 작성해주세요" },
};

export async function POST(request: NextRequest) {
  try {
    const {
      industry,
      region,
      language,
      competitors = [],
    } = await request.json();

    if (!industry || !region || !language) {
      return NextResponse.json(
        { error: "缺少必要參數：產業、地區、語言" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const industryLabel = INDUSTRY_LABELS[industry] || industry;
    const regionLabel = REGION_LABELS[region] || region;
    const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG["zh-TW"];

    const competitorContext =
      competitors.length > 0 ? `\n競爭對手網站: ${competitors.join(", ")}` : "";

    const prompt = `你是一位專業的 SEO 內容策略師。

根據以下資訊，生成 5 個具有高點擊率潛力的文章標題：

產業：${industryLabel}
目標地區：${regionLabel}
語言：${langConfig.name}${competitorContext}

${langConfig.instruction}

要求：
1. 標題必須與該產業在該地區的市場相關
2. 標題需要吸引目標受眾
3. 標題應包含數字或問句以提高點擊率
4. 標題長度控制在 30-60 字元
5. 考慮 SEO 最佳實踐

請直接輸出 5 個標題，每行一個，不要編號：`;

    const router = getAPIRouter();
    const model = "google/gemini-2.5-flash-preview-05-20";

    const response = await router.complete({
      model,
      apiProvider: "openrouter",
      prompt,
      temperature: 0.8,
      maxTokens: 500,
    });

    const titles = response.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length < 100)
      .filter((line) => !line.match(/^[\d\.\-\*][\.\)、\s]/))
      .map((line) => line.replace(/^[\d\.\-\*]+[\.\)、\s]*/, ""))
      .slice(0, 5);

    if (titles.length === 0) {
      console.error("No valid titles generated:", response.content);
      return NextResponse.json(
        { error: "標題生成失敗，請稍後再試" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      titles,
      metadata: {
        industry: industryLabel,
        region: regionLabel,
        language: langConfig.name,
      },
    });
  } catch (error) {
    console.error("Preview titles error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
