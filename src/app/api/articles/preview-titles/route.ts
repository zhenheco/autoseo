/**
 * 預覽標題生成 API
 * 根據產業、地區、語言生成 SEO 標題預覽
 *
 * AI 層級順序（與 generate-titles 一致）：
 * 1. OpenRouter Gemini (google/gemini-2.0-flash-exp:free) - 透過 AI Gateway
 * 2. Gemini Direct API (gemini-2.0-flash) - 備用
 * 3. 模板回退 - 最後手段
 */

import { NextRequest } from "next/server";
import { getOpenRouterClient } from "@/lib/openrouter/client";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import {
  buildGeminiApiUrl,
  buildGeminiHeaders,
  isGatewayEnabled,
} from "@/lib/cloudflare/ai-gateway";
import { getTitlesFromTemplates } from "@/lib/cache/title-templates";

/**
 * 呼叫 Gemini Direct API
 */
async function callGeminiDirectAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelName = "gemini-2.0-flash";
  const geminiUrl = isGatewayEnabled()
    ? buildGeminiApiUrl(modelName, "generateContent")
    : `${buildGeminiApiUrl(modelName, "generateContent")}?key=${apiKey}`;
  const headers = buildGeminiHeaders(apiKey);

  const response = await fetch(geminiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Invalid Gemini response structure");
  }
  return content;
}

/**
 * 標準格式解析
 * 處理：每行一個標題，可能有編號前綴
 */
function parseStandardFormat(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[\d\.\-\*]+[\.\)、\s]*/, "").trim())
    .filter((line) => line.length > 0 && line.length < 100)
    .filter(
      (line) =>
        !line.match(
          /^(標題|範例|格式|要求|例如|以下|根據|希望|請|您|這些|生成)/,
        ),
    )
    .slice(0, 5);
}

/**
 * 寬鬆格式解析
 * 當標準解析失敗時使用，條件更寬鬆
 */
function parseLenientFormat(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 10 && line.length < 200)
    .filter(
      (line) =>
        !line.match(/^(以下|希望|請|您|這些|生成|標題：|範例：|格式：)/),
    )
    .slice(0, 5);
}

// 產業標籤
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

// 地區標籤
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

// 語言配置
const LANGUAGE_CONFIG: Record<string, { name: string; instruction: string }> = {
  "zh-TW": { name: "繁體中文", instruction: "請使用繁體中文撰寫" },
  "zh-CN": { name: "简体中文", instruction: "请使用简体中文撰写" },
  "en-US": { name: "English", instruction: "Please write in English" },
  "ja-JP": { name: "日本語", instruction: "日本語で書いてください" },
  "ko-KR": { name: "한국어", instruction: "한국어로 작성해주세요" },
};

export const POST = withAuth(async (request: NextRequest) => {
  const { industry, region, language, competitors = [] } = await request.json();

  if (!industry || !region || !language) {
    return validationError("缺少必要參數：產業、地區、語言");
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

  let responseContent: string = "";

  // Layer 1: OpenRouter Gemini（透過 AI Gateway，優先使用免費模型）
  try {
    const openRouterClient = getOpenRouterClient();
    const response = await openRouterClient.complete({
      model: "google/gemini-2.0-flash-exp:free",
      prompt,
      temperature: 0.8,
      max_tokens: 500,
    });
    responseContent = response.content;
    console.log("[preview-titles] ✅ OpenRouter Gemini 成功");
  } catch (openRouterError) {
    console.warn(
      "[preview-titles] ⚠️ OpenRouter Gemini 失敗:",
      (openRouterError as Error).message,
    );

    // Layer 2: Gemini Direct API（備用，繞過 OpenRouter 限制）
    try {
      responseContent = await callGeminiDirectAPI(prompt);
      console.log("[preview-titles] ✅ Gemini Direct 成功");
    } catch (geminiDirectError) {
      console.warn(
        "[preview-titles] ⚠️ Gemini Direct 失敗:",
        (geminiDirectError as Error).message,
      );
      // responseContent 保持為空，將觸發模板回退
    }
  }

  // Layer 3: 模板回退（所有 Gemini 都失敗時）
  if (!responseContent || responseContent.trim() === "") {
    console.log("[preview-titles] ⚠️ 所有 Gemini 層失敗，使用模板回退");
    try {
      const templateTitles = await getTitlesFromTemplates(
        { language, keyword: industry },
        5,
      );
      if (templateTitles.length > 0) {
        return successResponse({
          titles: templateTitles,
          metadata: {
            industry: industryLabel,
            region: regionLabel,
            language: langConfig.name,
            source: "template",
          },
        });
      }
    } catch (templateError) {
      console.error(
        "[preview-titles] ⚠️ 模板回退也失敗:",
        (templateError as Error).message,
      );
    }
    // 如果連模板都失敗，返回錯誤
    return internalError("標題生成失敗，請稍後再試");
  }

  // 解析標題：先用標準格式，失敗則用寬鬆格式
  let titles = parseStandardFormat(responseContent);

  if (titles.length === 0) {
    console.log("[preview-titles] 標準解析無結果，嘗試寬鬆解析");
    titles = parseLenientFormat(responseContent);
  }

  // 如果兩種解析都失敗，嘗試模板回退
  if (titles.length === 0) {
    console.warn(
      "[preview-titles] 解析失敗，原始內容:",
      responseContent.substring(0, 200),
    );
    try {
      const templateTitles = await getTitlesFromTemplates(
        { language, keyword: industry },
        5,
      );
      if (templateTitles.length > 0) {
        return successResponse({
          titles: templateTitles,
          metadata: {
            industry: industryLabel,
            region: regionLabel,
            language: langConfig.name,
            source: "template",
          },
        });
      }
    } catch (templateError) {
      console.error(
        "[preview-titles] 模板回退失敗:",
        (templateError as Error).message,
      );
    }
    return internalError("標題生成失敗，請稍後再試");
  }

  return successResponse({
    titles,
    metadata: {
      industry: industryLabel,
      region: regionLabel,
      language: langConfig.name,
    },
  });
});
