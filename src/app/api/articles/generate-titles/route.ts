import { NextRequest, NextResponse } from "next/server";
import { getAPIRouter } from "@/lib/ai/api-router";
import { getOpenRouterClient } from "@/lib/openrouter/client";
import { createClient } from "@/lib/supabase/server";
import { getTitlesFromCache, saveTitlesToCache } from "@/lib/cache/title-cache";
import { getTitlesFromTemplates } from "@/lib/cache/title-templates";
import {
  buildGeminiApiUrl,
  buildGeminiHeaders,
  isGatewayEnabled,
} from "@/lib/cloudflare/ai-gateway";

/**
 * 呼叫 Gemini Direct API（繞過 OpenRouter）
 */
async function callGeminiDirectAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelName = "gemini-2.0-flash";
  // Gateway 模式使用 Gateway URL，直連模式使用官方 URL（帶 key 參數）
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
        temperature: 0.9,
        maxOutputTokens: 1000,
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

export async function POST(request: NextRequest) {
  try {
    const { keyword, targetLanguage = "zh-TW" } = await request.json();

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { error: "Keyword is required" },
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

    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership || membershipError) {
      console.error("Membership error:", membershipError);
      return NextResponse.json(
        { error: "No active company membership" },
        { status: 403 },
      );
    }

    const websiteQuery = await supabase
      .from("website_configs")
      .select("id")
      .eq("company_id", membership.company_id)
      .limit(1);

    let websites = websiteQuery.data;
    const websiteError = websiteQuery.error;

    if ((!websites || websites.length === 0) && !websiteError) {
      console.log(
        "Creating default website config for company:",
        membership.company_id,
      );
      const { data: newWebsite, error: createError } = await supabase
        .from("website_configs")
        .insert({
          company_id: membership.company_id,
          website_name: "",
          wordpress_url: "",
        })
        .select("id")
        .single();

      if (createError || !newWebsite) {
        console.error("Failed to create website config:", createError);
        return NextResponse.json(
          { error: "Failed to create website configuration" },
          { status: 500 },
        );
      }

      const { error: agentConfigError } = await supabase
        .from("agent_configs")
        .insert({
          website_id: newWebsite.id,
          research_model: "deepseek-reasoner",
          complex_processing_model: "deepseek-reasoner",
          simple_processing_model: "google/gemini-2.0-flash-exp:free",
          image_model: "gemini-imagen",
          research_temperature: 0.7,
          research_max_tokens: 4000,
          image_size: "1024x1024",
          image_count: 3,
          meta_enabled: true,
        });

      if (agentConfigError) {
        console.error("Failed to create agent config:", agentConfigError);
        return NextResponse.json(
          {
            error: "Failed to create agent configuration",
            details: agentConfigError.message,
          },
          { status: 500 },
        );
      }

      websites = [newWebsite];
    }

    if (!websites || websites.length === 0) {
      console.error("Website error:", websiteError);
      return NextResponse.json(
        { error: "No website configured" },
        { status: 404 },
      );
    }

    const websiteId = websites[0].id;

    const { data: agentConfig } = await supabase
      .from("agent_configs")
      .select("simple_processing_model")
      .eq("website_id", websiteId)
      .single();

    const model =
      agentConfig?.simple_processing_model ||
      "google/gemini-2.0-flash-exp:free";

    const cachedTitles = await getTitlesFromCache(keyword, targetLanguage);
    if (cachedTitles && cachedTitles.length > 0) {
      return NextResponse.json({
        success: true,
        titles: cachedTitles.slice(0, 10),
        keyword,
        source: "cache",
      });
    }

    const router = getAPIRouter();

    const languageMap: Record<string, { name: string; example: string }> = {
      "zh-TW": {
        name: "Traditional Chinese (繁體中文)",
        example: "5個關於SEO的實用技巧",
      },
      "zh-CN": {
        name: "Simplified Chinese (简体中文)",
        example: "5个关于SEO的实用技巧",
      },
      en: { name: "English", example: "5 Proven SEO Strategies That Work" },
      ja: {
        name: "Japanese (日本語)",
        example: "SEOに関する5つの実用的なヒント",
      },
      ko: { name: "Korean (한국어)", example: "SEO에 대한 5가지 실용적인 팁" },
      es: {
        name: "Spanish (Español)",
        example: "5 Consejos Prácticos sobre SEO",
      },
      fr: {
        name: "French (Français)",
        example: "5 Conseils Pratiques sur le SEO",
      },
      de: { name: "German (Deutsch)", example: "5 Praktische SEO-Tipps" },
      pt: {
        name: "Portuguese (Português)",
        example: "5 Dicas Práticas sobre SEO",
      },
      it: { name: "Italian (Italiano)", example: "5 Consigli Pratici sul SEO" },
      ru: {
        name: "Russian (Русский)",
        example: "5 практических советов по SEO",
      },
      ar: {
        name: "Arabic (العربية)",
        example: "5 نصائح عملية حول تحسين محركات البحث",
      },
      th: { name: "Thai (ไทย)", example: "5 เคล็ดลับ SEO ที่ใช้งานได้จริง" },
      vi: { name: "Vietnamese (Tiếng Việt)", example: "5 Mẹo SEO Thực Tế" },
      id: {
        name: "Indonesian (Bahasa Indonesia)",
        example: "5 Tips SEO yang Praktis",
      },
    };

    const lang = languageMap[targetLanguage] || languageMap["zh-TW"];

    const prompt = `First, translate the keyword "${keyword}" to ${lang.name} if it's not already in that language.

Then, generate 10 engaging titles with numbers based on the translated keyword.

Requirements:
- Each title MUST include a number (e.g., 5, 10, 3)
- Titles should be click-worthy and engaging
- One title per line
- No numbering prefix, just list the titles directly
- ALL titles MUST be written in ${lang.name}

Example format for ${lang.name}:
${lang.example}

IMPORTANT: Generate ALL 10 titles in ${lang.name} language only.`;

    const openRouterClient = getOpenRouterClient();
    let responseContent: string | null = null;
    let source = "ai";

    // Layer 1: OpenRouter Grok free（透過 AI Gateway）
    try {
      const response = await openRouterClient.complete({
        model: "x-ai/grok-4.1-fast:free",
        prompt,
        temperature: 0.9,
        max_tokens: 1000,
      });
      responseContent = response.content;
      source = "ai-grok";
      console.log("[generate-titles] ✅ Grok 成功");
    } catch (grokError) {
      console.warn(
        "[generate-titles] ⚠️ Grok 失敗:",
        (grokError as Error).message,
      );

      // Layer 2: OpenRouter Gemini free（透過 AI Gateway）
      try {
        const response = await openRouterClient.complete({
          model: "google/gemini-2.0-flash-exp:free",
          prompt,
          temperature: 0.9,
          max_tokens: 1000,
        });
        responseContent = response.content;
        source = "ai-gemini-openrouter";
        console.log("[generate-titles] ✅ Gemini OpenRouter 成功");
      } catch (geminiOpenRouterError) {
        console.warn(
          "[generate-titles] ⚠️ Gemini OpenRouter 失敗:",
          (geminiOpenRouterError as Error).message,
        );

        // Layer 3: Gemini Direct API（繞過 OpenRouter 限制）
        try {
          responseContent = await callGeminiDirectAPI(prompt);
          source = "ai-gemini-direct";
          console.log("[generate-titles] ✅ Gemini Direct 成功");
        } catch (geminiDirectError) {
          console.warn(
            "[generate-titles] ⚠️ Gemini Direct 失敗:",
            (geminiDirectError as Error).message,
          );

          // Layer 4: OpenAI Fallback
          try {
            const response = await router.complete({
              model: "gpt-4o-mini",
              apiProvider: "openai",
              prompt,
              temperature: 0.9,
              maxTokens: 1000,
            });
            responseContent = response.content;
            source = "ai-openai";
            console.log("[generate-titles] ✅ OpenAI 成功");
          } catch (openaiError) {
            console.warn(
              "[generate-titles] ⚠️ OpenAI 失敗:",
              (openaiError as Error).message,
            );
          }
        }
      }
    }

    // 解析標題
    if (responseContent) {
      const titles = responseContent
        .split("\n")
        .map((line) => line.trim())
        // 先移除列表前綴（如 "1. ", "* ", "- " 等）
        .map((line) => line.replace(/^[\d\.\-\*]+[\.\)、\s]*/, "").trim())
        .filter((line) => line.length > 0 && line.length < 100)
        // 過濾掉看起來像是說明文字的行
        .filter((line) => !line.match(/^(標題|範例|格式|要求|例如|以下|根據)/))
        .slice(0, 10);

      if (titles.length > 0) {
        await saveTitlesToCache(keyword, targetLanguage, titles);

        return NextResponse.json({
          success: true,
          titles: titles.slice(0, 10),
          keyword,
          source,
        });
      }
    }

    const templateTitles = await getTitlesFromTemplates(
      {
        language: targetLanguage,
        keyword,
      },
      10,
    );

    if (templateTitles.length > 0) {
      return NextResponse.json({
        success: true,
        titles: templateTitles.slice(0, 10),
        keyword,
        source: "template",
      });
    }

    return NextResponse.json(
      { error: "Failed to generate titles" },
      { status: 500 },
    );
  } catch (error) {
    console.error("Generate titles error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
