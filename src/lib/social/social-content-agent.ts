/**
 * 社群文案生成 Agent
 *
 * 使用 DeepSeek 將 SEO 文章轉換成社群貼文
 * 支援三種風格：專業版、吸睛版、故事版
 */

import { AIClient } from "@/lib/ai/ai-client";
import type { AIClientConfig } from "@/types/agents";

// ============================================
// 型別定義
// ============================================

/** 目標平台 */
export type SocialPlatform = "instagram" | "facebook" | "threads";

/** 文案風格 */
export type ContentStyle = "professional" | "catchy" | "story";

/** 文章摘要（用於減少 token 消耗） */
export interface ArticleSummary {
  /** 文章標題 */
  title: string;
  /** 前 200 字摘要 */
  excerpt: string;
  /** H2 標題列表 */
  headings: string[];
  /** 關鍵字 */
  keywords: string[];
}

/** 單一風格的文案 */
export interface StyleContent {
  /** 文案內容 */
  content: string;
  /** Hashtag 列表 */
  hashtags: string[];
  /** 字數統計 */
  characterCount: number;
}

/** AI 生成結果 */
export interface GeneratedSocialContent {
  /** 專業版 */
  professional: StyleContent;
  /** 吸睛版 */
  catchy: StyleContent;
  /** 故事版 */
  story: StyleContent;
}

/** 生成選項 */
export interface GenerateOptions {
  /** 目標平台（影響字數限制） */
  platform: SocialPlatform;
  /** 語言（預設繁體中文） */
  language?: string;
}

// ============================================
// 常數定義
// ============================================

/** 各平台字數限制 */
const PLATFORM_LIMITS: Record<SocialPlatform, { min: number; max: number }> = {
  instagram: { min: 100, max: 200 },
  facebook: { min: 150, max: 300 },
  threads: { min: 80, max: 150 },
};

/** 系統提示詞 */
const SYSTEM_PROMPT = `你是一位專業的社群媒體文案專家，擅長將長篇 SEO 文章轉換成吸引人的社群貼文。

## 任務
將用戶提供的 SEO 文章摘要轉換成三種不同風格的社群貼文。

## 輸出格式
請以 JSON 格式輸出，包含三種風格：

{
  "professional": {
    "content": "專業版文案",
    "hashtags": ["標籤1", "標籤2", "標籤3", "標籤4", "標籤5"]
  },
  "catchy": {
    "content": "吸睛版文案",
    "hashtags": ["標籤1", "標籤2", "標籤3", "標籤4", "標籤5"]
  },
  "story": {
    "content": "故事版文案",
    "hashtags": ["標籤1", "標籤2", "標籤3", "標籤4", "標籤5"]
  }
}

## 文案要求

### 通用規則
- 適當使用 emoji 增加視覺吸引力（每段 2-3 個）
- 結尾加入 CTA（行動呼籲），例如「想知道更多嗎？點擊連結」
- Hashtag：5-8 個相關標籤，不要加 # 符號
- 使用換行分段，增加可讀性

### 專業版風格 (professional)
- 使用專業術語
- 數據導向，引用具體數字或統計
- 提供實用價值和專業見解
- 語氣：專業、權威、可信
- 適合：企業、B2B、專業人士

### 吸睛版風格 (catchy)
- 以問句或驚人事實開頭
- 製造好奇心和緊迫感
- 使用「你」直接對話
- 語氣：活潑、直接、有衝擊力
- 適合：一般大眾、病毒傳播

### 故事版風格 (story)
- 第一人稱敘述
- 分享個人經驗或案例
- 建立情感連結
- 語氣：親切、真誠、有溫度
- 適合：個人品牌、KOL

## 禁止事項
- 不要過度使用 emoji
- 不要使用誇大不實的描述
- 不要直接複製原文段落
- 不要在 hashtags 陣列中加入 # 符號
- 必須輸出有效的 JSON 格式`;

// ============================================
// 工具函數
// ============================================

/**
 * 從 HTML 內容提取摘要資訊
 */
export function extractArticleSummary(
  htmlContent: string,
  title: string,
  keywords: string[] = [],
): ArticleSummary {
  // 1. 移除 HTML 標籤，提取純文字
  const textContent = htmlContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // 移除 script
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // 移除 style
    .replace(/<[^>]+>/g, " ") // 移除其他標籤
    .replace(/\s+/g, " ") // 合併空白
    .trim();

  // 2. 取前 200 字作為摘要
  const excerpt = textContent.slice(0, 200);

  // 3. 提取所有 H2 標題
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const headings: string[] = [];
  let match;
  while ((match = h2Regex.exec(htmlContent)) !== null) {
    // 移除標題內的 HTML 標籤
    const headingText = match[1].replace(/<[^>]+>/g, "").trim();
    if (headingText) {
      headings.push(headingText);
    }
  }

  return {
    title,
    excerpt,
    headings,
    keywords,
  };
}

/**
 * 生成用戶提示詞
 */
function generateUserPrompt(
  summary: ArticleSummary,
  options: GenerateOptions,
): string {
  const limits = PLATFORM_LIMITS[options.platform];
  const language = options.language || "繁體中文";

  return `## 原始文章摘要

標題：${summary.title}

開頭段落（前 200 字）：
${summary.excerpt}

文章大綱（H2 標題）：
${summary.headings.length > 0 ? summary.headings.map((h, i) => `${i + 1}. ${h}`).join("\n") : "（無大綱）"}

關鍵字：${summary.keywords.length > 0 ? summary.keywords.join("、") : "（無指定關鍵字）"}

## 目標平台
${options.platform}

## 字數要求
- 建議字數：${limits.min}-${limits.max} 字
- 不含 hashtag

## 語言
請使用${language}撰寫

請根據上述文章摘要，生成三種風格的社群貼文。`;
}

/**
 * 解析 AI 回應
 */
function parseAIResponse(response: string): GeneratedSocialContent {
  // 嘗試提取 JSON
  let jsonStr = response;

  // 如果回應包含 markdown 代碼塊，提取其中的 JSON
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // 驗證並轉換格式
    const result: GeneratedSocialContent = {
      professional: {
        content: parsed.professional?.content || "",
        hashtags: Array.isArray(parsed.professional?.hashtags)
          ? parsed.professional.hashtags.map((h: string) => h.replace(/^#/, ""))
          : [],
        characterCount: (parsed.professional?.content || "").length,
      },
      catchy: {
        content: parsed.catchy?.content || "",
        hashtags: Array.isArray(parsed.catchy?.hashtags)
          ? parsed.catchy.hashtags.map((h: string) => h.replace(/^#/, ""))
          : [],
        characterCount: (parsed.catchy?.content || "").length,
      },
      story: {
        content: parsed.story?.content || "",
        hashtags: Array.isArray(parsed.story?.hashtags)
          ? parsed.story.hashtags.map((h: string) => h.replace(/^#/, ""))
          : [],
        characterCount: (parsed.story?.content || "").length,
      },
    };

    return result;
  } catch {
    throw new Error(`無法解析 AI 回應: ${response.slice(0, 200)}...`);
  }
}

// ============================================
// 主要類別
// ============================================

export class SocialContentAgent {
  private aiClient: AIClient;

  constructor(config?: AIClientConfig) {
    // 使用預設配置，如果沒有提供
    const defaultConfig: AIClientConfig = {
      enableFallback: true,
      maxRetries: 3,
    };
    this.aiClient = new AIClient(config || defaultConfig);
  }

  /**
   * 生成社群文案
   *
   * @param summary 文章摘要
   * @param options 生成選項
   * @returns 三種風格的文案
   */
  async generate(
    summary: ArticleSummary,
    options: GenerateOptions,
  ): Promise<GeneratedSocialContent> {
    const userPrompt = generateUserPrompt(summary, options);

    try {
      // 組合 system prompt 和 user prompt
      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: userPrompt },
      ];

      const response = await this.aiClient.complete(messages, {
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 2000,
        format: "json",
      });

      return parseAIResponse(response.content);
    } catch (error) {
      console.error("[SocialContentAgent] 生成失敗:", error);
      throw new Error(
        `社群文案生成失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
      );
    }
  }

  /**
   * 從完整文章生成社群文案
   *
   * @param article 完整文章資訊
   * @param options 生成選項
   * @returns 三種風格的文案
   */
  async generateFromArticle(
    article: {
      title: string;
      htmlContent: string;
      keywords?: string[];
    },
    options: GenerateOptions,
  ): Promise<GeneratedSocialContent> {
    // 提取摘要以減少 token 消耗
    const summary = extractArticleSummary(
      article.htmlContent,
      article.title,
      article.keywords,
    );

    return this.generate(summary, options);
  }

  /**
   * 重新生成單一風格
   *
   * @param summary 文章摘要
   * @param style 要重新生成的風格
   * @param options 生成選項
   * @returns 單一風格的文案
   */
  async regenerateStyle(
    summary: ArticleSummary,
    style: ContentStyle,
    options: GenerateOptions,
  ): Promise<StyleContent> {
    const limits = PLATFORM_LIMITS[options.platform];
    const language = options.language || "繁體中文";

    const styleDescriptions: Record<ContentStyle, string> = {
      professional: "專業版：使用專業術語、數據導向、提供實用價值",
      catchy: "吸睛版：問句開頭、製造好奇心、直接對話",
      story: "故事版：第一人稱、分享經驗、情感連結",
    };

    const userPrompt = `## 原始文章摘要

標題：${summary.title}

開頭段落：${summary.excerpt}

大綱：${summary.headings.join("、") || "無"}

關鍵字：${summary.keywords.join("、") || "無"}

## 任務
請只生成「${styleDescriptions[style]}」風格的社群貼文。

## 要求
- 字數：${limits.min}-${limits.max} 字
- 語言：${language}
- 包含 5-8 個相關 hashtag

## 輸出格式
{
  "content": "文案內容",
  "hashtags": ["標籤1", "標籤2", ...]
}`;

    try {
      // 組合 system prompt 和 user prompt
      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: userPrompt },
      ];

      const response = await this.aiClient.complete(messages, {
        model: "deepseek-chat",
        temperature: 0.8, // 重新生成時用較高的溫度增加變化
        maxTokens: 1000,
        format: "json",
      });

      // 解析單一風格回應
      let jsonStr = response.content;
      const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr.trim());

      return {
        content: parsed.content || "",
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags.map((h: string) => h.replace(/^#/, ""))
          : [],
        characterCount: (parsed.content || "").length,
      };
    } catch (error) {
      console.error("[SocialContentAgent] 重新生成失敗:", error);
      throw new Error(
        `重新生成失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
      );
    }
  }
}

// ============================================
// 工廠函數
// ============================================

/**
 * 建立社群文案生成 Agent
 */
export function createSocialContentAgent(): SocialContentAgent {
  return new SocialContentAgent();
}

// ============================================
// 便利函數
// ============================================

/**
 * 格式化文案（加上 hashtag）
 */
export function formatContentWithHashtags(
  content: string,
  hashtags: string[],
): string {
  const hashtagStr = hashtags.map((h) => `#${h}`).join(" ");
  return `${content}\n\n${hashtagStr}`;
}

/**
 * 取得平台字數限制
 */
export function getPlatformLimits(platform: SocialPlatform): {
  min: number;
  max: number;
} {
  return PLATFORM_LIMITS[platform];
}
