/**
 * CategoryAgent - 自動分析文章內容並推薦分類和標籤
 * 使用 DeepSeek API 來降低成本（通過 Cloudflare AI Gateway）
 */

import { z } from "zod";
import {
  getDeepSeekBaseUrl,
  buildDeepSeekHeaders,
  isGatewayEnabled,
} from "@/lib/cloudflare/ai-gateway";

// 分類和標籤輸出 Schema
const CategoryOutputSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe("分類名稱"),
        slug: z.string().describe("分類 URL slug"),
        confidence: z.number().min(0).max(1).describe("推薦信心度 0-1"),
        reason: z.string().describe("推薦理由"),
      }),
    )
    .length(1)
    .describe("只有 1 個主要分類"),

  tags: z
    .array(
      z.object({
        name: z.string().describe("標籤名稱"),
        slug: z.string().describe("標籤 URL slug"),
        relevance: z.number().min(0).max(1).describe("相關性分數 0-1"),
      }),
    )
    .min(5)
    .max(10)
    .describe("推薦的標籤（5-10個）"),

  primaryCategory: z.string().describe("主要分類名稱"),
  focusKeywords: z.array(z.string()).describe("文章焦點關鍵字"),
});

export type CategoryOutput = z.infer<typeof CategoryOutputSchema>;

export interface CategoryInput {
  title: string;
  content: string;
  keywords: string[];
  outline?: { mainSections?: Array<{ heading: string }> };
  existingCategories?: Array<{ name: string; slug: string; count?: number }>;
  existingTags?: Array<{ name: string; slug: string; count?: number }>;
  language?: string;
}

export class CategoryAgent {
  private model: string;

  constructor(model?: string) {
    this.model = model || "deepseek-chat";
  }

  private async callDeepSeekAPI(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  }) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not set");
    }

    const response = await fetch(
      `${getDeepSeekBaseUrl()}/v1/chat/completions`,
      {
        method: "POST",
        headers: buildDeepSeekHeaders(apiKey),
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.max_tokens,
          response_format: params.response_format,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DeepSeek API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async generateCategories(input: CategoryInput): Promise<CategoryOutput> {
    console.log("[CategoryAgent] 開始分析文章分類和標籤...");
    console.log("[CategoryAgent] 使用模型:", this.model);

    try {
      const systemPrompt = this.buildSystemPrompt(input);
      const userPrompt = this.buildUserPrompt(input);

      const response = await this.callDeepSeekAPI({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        response_format: {
          type: "json_object",
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from model");
      }

      const parsed = JSON.parse(content);

      // 檢查並修正 AI 回傳的格式（如果是字串陣列，轉換為物件陣列）
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        if (typeof parsed.categories[0] === "string") {
          // 只保留第一個分類（WordPress 只能有 1 個主要分類）
          const categoryName = parsed.categories[0];
          parsed.categories = [
            {
              name: categoryName,
              slug: this.slugify(categoryName),
              confidence: 0.9,
              reason: "主要分類",
            },
          ];
        } else if (parsed.categories.length > 1) {
          // 如果 AI 回傳多個分類物件，只保留第一個
          parsed.categories = [parsed.categories[0]];
        }
      }

      if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
        if (typeof parsed.tags[0] === "string") {
          parsed.tags = parsed.tags
            .slice(0, 10)
            .map((name: string, index: number) => ({
              name,
              slug: this.slugify(name),
              relevance: 1 - index * 0.05,
            }));
        }
      }

      const validated = CategoryOutputSchema.parse(parsed);

      console.log("[CategoryAgent] 成功生成分類和標籤");
      console.log(`  - 主要分類: ${validated.primaryCategory}`);
      console.log(`  - 分類數量: ${validated.categories.length}`);
      console.log(`  - 標籤數量: ${validated.tags.length}`);

      return validated;
    } catch (error) {
      console.error("[CategoryAgent] 錯誤:", error);
      // 返回預設值
      return this.getDefaultOutput(input);
    }
  }

  private buildSystemPrompt(input: CategoryInput): string {
    const lang = input.language === "zh-TW" ? "繁體中文" : "English";
    const existingCategoryCount = input.existingCategories?.length || 0;
    const maxCategories = 10;
    const canCreateNew = existingCategoryCount < maxCategories;

    let categoryInstruction = "";
    if (canCreateNew) {
      categoryInstruction = `
5a. 優先使用現有分類
5b. 如果現有分類不完全適合，可以建議 1 個新分類（因為目前有 ${existingCategoryCount} 個分類，少於 ${maxCategories} 個上限）`;
    } else {
      categoryInstruction = `
5. **重要：目前已有 ${existingCategoryCount} 個分類（達到上限），請只從現有分類中選擇，不要建議新分類**`;
    }

    return `你是一個專業的內容分類專家。請根據文章內容推薦最適合的分類和標籤。

要求：
1. 分析文章主題、內容深度和目標受眾
2. **只推薦 1 個最相關的主要分類**（WordPress 文章只能有 1 個主要分類）
3. 推薦 5-10 個相關標籤（按相關性排序）
4. 分類應該較廣泛，標籤應該較具體${categoryInstruction}
6. 標籤可以建議新標籤，但也優先使用現有標籤
7. 使用 ${lang} 命名
8. slug 使用小寫英文和連字符（如: digital-marketing）

**極度重要的輸出格式要求**：
- categories 必須**只包含 1 個物件**，包含 name, slug, confidence, reason
- tags 必須是物件陣列（5-10個），每個物件包含 name, slug, relevance
- **絕對不要**輸出純字串陣列
- 嚴格遵守以下 JSON 格式：

\`\`\`json
{
  "categories": [
    {
      "name": "主要分類名稱",
      "slug": "category-slug",
      "confidence": 0.95,
      "reason": "這是最相關的主要分類"
    }
  ],
  "tags": [
    {
      "name": "標籤名稱",
      "slug": "tag-slug",
      "relevance": 0.9
    },
    {
      "name": "標籤名稱2",
      "slug": "tag-slug-2",
      "relevance": 0.85
    }
  ],
  "primaryCategory": "主要分類名稱",
  "focusKeywords": ["關鍵字1", "關鍵字2"]
}
\`\`\``;
  }

  private buildUserPrompt(input: CategoryInput): string {
    let prompt = `請為以下文章推薦分類和標籤：

標題：${input.title}

關鍵字：${input.keywords.join(", ")}

內容摘要：
${input.content.substring(0, 2000)}...`;

    // 添加現有分類和標籤資訊
    if (input.existingCategories && input.existingCategories.length > 0) {
      prompt += `\n\n現有分類（優先考慮使用）：\n`;
      input.existingCategories.forEach((cat) => {
        prompt += `- ${cat.name} (${cat.slug})${cat.count ? ` [已有 ${cat.count} 篇文章]` : ""}\n`;
      });
    }

    if (input.existingTags && input.existingTags.length > 0) {
      prompt += `\n現有標籤（可參考）：\n`;
      const topTags = input.existingTags.slice(0, 20);
      topTags.forEach((tag) => {
        prompt += `- ${tag.name} (${tag.slug})${tag.count ? ` [使用 ${tag.count} 次]` : ""}\n`;
      });
    }

    prompt += `\n請分析並推薦最適合的分類和標籤。`;

    return prompt;
  }

  private getDefaultOutput(input: CategoryInput): CategoryOutput {
    // 基於關鍵字生成預設分類和標籤
    const primaryKeyword = input.keywords[0] || "general";

    return {
      categories: [
        {
          name: this.titleCase(primaryKeyword),
          slug: this.slugify(primaryKeyword),
          confidence: 0.5,
          reason: "基於主要關鍵字",
        },
      ],
      tags: input.keywords.slice(0, 5).map((kw, index) => ({
        name: kw,
        slug: this.slugify(kw),
        relevance: 1 - index * 0.1,
      })),
      primaryCategory: this.titleCase(primaryKeyword),
      focusKeywords: input.keywords.slice(0, 3),
    };
  }

  private titleCase(str: string): string {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * 根據文章內容和現有分類智能匹配最佳分類
   */
  async matchExistingCategories(
    content: string,
    existingCategories: Array<{
      id: string;
      name: string;
      description?: string;
    }>,
  ): Promise<string[]> {
    if (existingCategories.length === 0) {
      return [];
    }

    const prompt = `從以下分類中選擇最適合這篇文章的1-2個分類：

文章內容摘要：
${content.substring(0, 1000)}

可選分類：
${existingCategories.map((cat) => `- ${cat.name}${cat.description ? `: ${cat.description}` : ""}`).join("\n")}

只返回選中的分類ID，用逗號分隔。`;

    try {
      const response = await this.callDeepSeekAPI({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
      });

      const result = response.choices[0]?.message?.content || "";
      const categoryNames = result
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      return existingCategories
        .filter((cat) =>
          categoryNames.some(
            (name: string) =>
              cat.name.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(cat.name.toLowerCase()),
          ),
        )
        .map((cat) => cat.id)
        .slice(0, 2);
    } catch (error) {
      console.error("[CategoryAgent] 匹配分類錯誤:", error);
      return [];
    }
  }
}

export default CategoryAgent;
