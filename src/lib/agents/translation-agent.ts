/**
 * TranslationAgent - 文章翻譯 Agent
 *
 * 負責將中文文章翻譯成目標語言，保持 HTML 結構和 SEO 優化
 */

import { BaseAgent, AgentExecutionContext } from "./base-agent";
import type { AIClientConfig } from "@/types/agents";
import type {
  TranslationInput,
  TranslationOutput,
  TranslationLocale,
  TranslationExecutionInfo,
} from "@/types/translations";
import { TRANSLATION_LANGUAGES } from "@/types/translations";
import slugify from "slugify";

/**
 * 語言完整名稱對照表
 */
const LOCALE_FULL_NAMES: Record<string, string> = {
  "zh-TW": "Traditional Chinese (繁體中文)",
  "en-US": "English (US)",
  "de-DE": "German (Deutsch)",
  "fr-FR": "French (Français)",
  "es-ES": "Spanish (Español)",
};

/**
 * TranslationAgent
 *
 * 分段翻譯 HTML 內容，保持標籤結構不變
 */
export class TranslationAgent extends BaseAgent<
  TranslationInput,
  TranslationOutput
> {
  private model: string = "deepseek-chat";
  private executionStartTime: number = 0;

  constructor(aiConfig: AIClientConfig, context: AgentExecutionContext) {
    super(aiConfig, context);
  }

  get agentName(): string {
    return "TranslationAgent";
  }

  /**
   * 主要處理流程
   */
  protected async process(input: TranslationInput): Promise<TranslationOutput> {
    this.executionStartTime = Date.now();
    this.model = input.model || "deepseek-chat";

    const targetLangName =
      LOCALE_FULL_NAMES[input.targetLanguage] || input.targetLanguage;
    this.log("info", `開始翻譯文章到 ${targetLangName}`, {
      sourceTitle: input.sourceArticle.title,
      targetLanguage: input.targetLanguage,
    });

    // 1. 翻譯 metadata（標題、SEO 等）
    const translatedMeta = await this.translateMetadata(input);

    // 2. 翻譯 HTML 內容（分段處理）
    const translatedContent = await this.translateContent(input);

    // 3. 翻譯 Markdown 內容
    const translatedMarkdown = await this.translateMarkdown(input);

    // 4. 生成 slug
    const slug = this.generateSlug(translatedMeta.title, input.targetLanguage);

    // 5. 計算統計
    const stats = this.calculateStats(translatedContent.html_content);

    // 6. 組裝結果
    const executionInfo = this.buildExecutionInfo();

    return {
      title: translatedMeta.title,
      slug,
      markdown_content: translatedMarkdown,
      html_content: translatedContent.html_content,
      excerpt: translatedMeta.excerpt,
      seo_title: translatedMeta.seo_title,
      seo_description: translatedMeta.seo_description,
      focus_keyword: translatedMeta.focus_keyword,
      keywords: translatedMeta.keywords,
      categories: translatedMeta.categories,
      tags: translatedMeta.tags,
      og_title: translatedMeta.og_title,
      og_description: translatedMeta.og_description,
      ...stats,
      executionInfo,
    };
  }

  /**
   * 翻譯 metadata（標題、SEO、分類等）
   */
  private async translateMetadata(input: TranslationInput): Promise<{
    title: string;
    excerpt: string | null;
    seo_title: string | null;
    seo_description: string | null;
    focus_keyword: string | null;
    keywords: string[];
    categories: string[];
    tags: string[];
    og_title: string | null;
    og_description: string | null;
  }> {
    const targetLangName =
      LOCALE_FULL_NAMES[input.targetLanguage] || input.targetLanguage;

    const systemPrompt = `You are a professional SEO translator specializing in ${targetLangName}.

TASK: Translate the following article metadata from ${LOCALE_FULL_NAMES[input.sourceLanguage] || input.sourceLanguage} to ${targetLangName}.

CRITICAL RULES:
1. Translate naturally for the target audience's cultural context
2. Optimize for SEO in the target language
3. Keep brand names and proper nouns as appropriate
4. seo_title: Must be under 60 characters
5. seo_description: Must be under 160 characters
6. focus_keyword: Translate to the most relevant keyword in target language
7. Return ONLY valid JSON, no additional text

OUTPUT FORMAT (JSON):
{
  "title": "translated title",
  "excerpt": "translated excerpt or null",
  "seo_title": "translated SEO title (max 60 chars)",
  "seo_description": "translated meta description (max 160 chars)",
  "focus_keyword": "translated focus keyword",
  "keywords": ["keyword1", "keyword2"],
  "categories": ["category1", "category2"],
  "tags": ["tag1", "tag2"],
  "og_title": "translated OG title",
  "og_description": "translated OG description"
}`;

    const userPrompt = JSON.stringify({
      title: input.sourceArticle.title,
      excerpt: input.sourceArticle.excerpt,
      seo_title: input.sourceArticle.seo_title,
      seo_description: input.sourceArticle.seo_description,
      focus_keyword: input.sourceArticle.focus_keyword,
      keywords: input.sourceArticle.keywords,
      categories: input.sourceArticle.categories,
      tags: input.sourceArticle.tags,
      og_title: input.sourceArticle.og_title,
      og_description: input.sourceArticle.og_description,
    });

    const response = await this.complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        model: this.model,
        temperature: input.temperature ?? 0.3,
        maxTokens: input.maxTokens ?? 2000,
      },
    );

    try {
      // 嘗試解析 JSON 響應
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        title: parsed.title || input.sourceArticle.title,
        excerpt: parsed.excerpt || null,
        seo_title: parsed.seo_title || null,
        seo_description: parsed.seo_description || null,
        focus_keyword: parsed.focus_keyword || null,
        keywords: parsed.keywords || [],
        categories: parsed.categories || [],
        tags: parsed.tags || [],
        og_title: parsed.og_title || null,
        og_description: parsed.og_description || null,
      };
    } catch (error) {
      this.log("error", "解析 metadata 翻譯失敗，使用原始值", { error });
      return {
        title: input.sourceArticle.title,
        excerpt: input.sourceArticle.excerpt,
        seo_title: input.sourceArticle.seo_title,
        seo_description: input.sourceArticle.seo_description,
        focus_keyword: input.sourceArticle.focus_keyword,
        keywords: input.sourceArticle.keywords,
        categories: input.sourceArticle.categories,
        tags: input.sourceArticle.tags,
        og_title: input.sourceArticle.og_title,
        og_description: input.sourceArticle.og_description,
      };
    }
  }

  /**
   * 分段翻譯 HTML 內容
   *
   * 按 H2 標題切分，逐段翻譯後組裝
   */
  private async translateContent(
    input: TranslationInput,
  ): Promise<{ html_content: string }> {
    const html = input.sourceArticle.html_content;
    const targetLangName =
      LOCALE_FULL_NAMES[input.targetLanguage] || input.targetLanguage;

    // 切分 HTML 為多個段落（以 <h2> 為分隔）
    const sections = this.splitHtmlBySections(html);

    this.log("info", `分段翻譯 HTML 內容`, {
      sectionCount: sections.length,
    });

    // 逐段翻譯
    const translatedSections: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // 如果段落太短（可能只是空白或標點），直接保留
      if (section.trim().length < 10) {
        translatedSections.push(section);
        continue;
      }

      const translatedSection = await this.translateHtmlSection(
        section,
        input.sourceLanguage,
        input.targetLanguage,
        targetLangName,
        input.temperature,
        input.maxTokens,
      );

      translatedSections.push(translatedSection);

      this.log("info", `翻譯段落 ${i + 1}/${sections.length} 完成`);
    }

    // 組裝翻譯後的 HTML
    const translatedHtml = translatedSections.join("\n");

    return { html_content: translatedHtml };
  }

  /**
   * 翻譯單個 HTML 段落
   */
  private async translateHtmlSection(
    section: string,
    sourceLanguage: string,
    targetLanguage: TranslationLocale,
    targetLangName: string,
    temperature?: number,
    maxTokens?: number,
  ): Promise<string> {
    const systemPrompt = `You are a professional translator specializing in ${targetLangName}.

TASK: Translate the following HTML content from ${LOCALE_FULL_NAMES[sourceLanguage] || sourceLanguage} to ${targetLangName}.

CRITICAL RULES:
1. PRESERVE ALL HTML STRUCTURE EXACTLY - all tags, attributes, classes, IDs must remain unchanged
2. PRESERVE ALL URLs - href, src attributes must NOT be modified
3. ONLY translate the text content between tags
4. Translate naturally for the target audience
5. Keep brand names and proper nouns as appropriate
6. Return ONLY the translated HTML, nothing else

EXAMPLE:
Input: <p class="intro">這是一個範例</p>
Output: <p class="intro">This is an example</p>`;

    const response = await this.complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: section },
      ],
      {
        model: this.model,
        temperature: temperature ?? 0.3,
        maxTokens: maxTokens ?? 4000,
      },
    );

    return response.content.trim();
  }

  /**
   * 翻譯 Markdown 內容
   */
  private async translateMarkdown(input: TranslationInput): Promise<string> {
    const markdown = input.sourceArticle.markdown_content;
    const targetLangName =
      LOCALE_FULL_NAMES[input.targetLanguage] || input.targetLanguage;

    // 如果 Markdown 很長，分段處理
    const sections = this.splitMarkdownBySections(markdown);

    const translatedSections: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      if (section.trim().length < 10) {
        translatedSections.push(section);
        continue;
      }

      const systemPrompt = `You are a professional translator specializing in ${targetLangName}.

TASK: Translate the following Markdown content from ${LOCALE_FULL_NAMES[input.sourceLanguage] || input.sourceLanguage} to ${targetLangName}.

CRITICAL RULES:
1. PRESERVE ALL Markdown syntax - headers, links, images, lists, code blocks
2. PRESERVE ALL URLs in links and images
3. ONLY translate the text content
4. Translate naturally for the target audience
5. Return ONLY the translated Markdown, nothing else`;

      const response = await this.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: section },
        ],
        {
          model: this.model,
          temperature: input.temperature ?? 0.3,
          maxTokens: input.maxTokens ?? 4000,
        },
      );

      translatedSections.push(response.content.trim());
    }

    return translatedSections.join("\n\n");
  }

  /**
   * 按 H2 標題切分 HTML
   */
  private splitHtmlBySections(html: string): string[] {
    // 使用 <h2> 作為分隔符，但保留標籤
    const parts = html.split(/(?=<h2[^>]*>)/i);

    // 如果沒有 h2，嘗試用 h3 分割
    if (parts.length === 1) {
      const h3Parts = html.split(/(?=<h3[^>]*>)/i);
      if (h3Parts.length > 1) {
        return h3Parts;
      }
    }

    // 如果段落太大（超過 3000 字符），進一步切分
    const maxLength = 3000;
    const result: string[] = [];

    for (const part of parts) {
      if (part.length <= maxLength) {
        result.push(part);
      } else {
        // 按段落 <p> 切分
        const subParts = part.split(/(?=<p[^>]*>)/i);
        let current = "";

        for (const subPart of subParts) {
          if ((current + subPart).length <= maxLength) {
            current += subPart;
          } else {
            if (current) {
              result.push(current);
            }
            current = subPart;
          }
        }

        if (current) {
          result.push(current);
        }
      }
    }

    return result;
  }

  /**
   * 按標題切分 Markdown
   */
  private splitMarkdownBySections(markdown: string): string[] {
    // 使用 ## 作為分隔符
    const parts = markdown.split(/(?=^## )/m);

    const maxLength = 3000;
    const result: string[] = [];

    for (const part of parts) {
      if (part.length <= maxLength) {
        result.push(part);
      } else {
        // 按段落切分（空行）
        const paragraphs = part.split(/\n\n+/);
        let current = "";

        for (const para of paragraphs) {
          if ((current + para).length <= maxLength) {
            current += (current ? "\n\n" : "") + para;
          } else {
            if (current) {
              result.push(current);
            }
            current = para;
          }
        }

        if (current) {
          result.push(current);
        }
      }
    }

    return result;
  }

  /**
   * 生成 URL slug
   */
  private generateSlug(
    title: string,
    targetLanguage: TranslationLocale,
  ): string {
    // 使用 slugify 處理，支援多語言
    const slug = slugify(title, {
      lower: true,
      strict: true,
      locale: targetLanguage.split("-")[0], // 'en', 'de', 'fr', 'es'
    });

    // 確保 slug 不為空
    if (!slug) {
      return `article-${Date.now()}`;
    }

    return slug;
  }

  /**
   * 計算文章統計
   */
  private calculateStats(htmlContent: string): {
    word_count: number;
    reading_time: number;
    paragraph_count: number;
    sentence_count: number;
  } {
    // 移除 HTML 標籤取得純文字
    const text = htmlContent.replace(/<[^>]*>/g, " ").trim();

    // 計算字數（適用於西方語言）
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const word_count = words.length;

    // 閱讀時間（假設每分鐘 200 字）
    const reading_time = Math.ceil(word_count / 200);

    // 段落數
    const paragraphs = htmlContent.match(/<p[^>]*>/gi) || [];
    const paragraph_count = paragraphs.length;

    // 句子數（簡單計算：以句號、問號、驚嘆號結尾）
    const sentences = text
      .split(/[.!?。！？]+/)
      .filter((s) => s.trim().length > 0);
    const sentence_count = sentences.length;

    return {
      word_count,
      reading_time,
      paragraph_count,
      sentence_count,
    };
  }

  /**
   * 建立執行資訊
   */
  private buildExecutionInfo(): TranslationExecutionInfo {
    const executionTime = Date.now() - this.executionStartTime;

    // 計算成本（DeepSeek 約 $0.14/1M input tokens, $0.28/1M output tokens）
    const inputCost = (this.totalTokensUsed.input / 1000000) * 0.14;
    const outputCost = (this.totalTokensUsed.output / 1000000) * 0.28;
    const cost = inputCost + outputCost;

    return {
      model: this.model,
      executionTime,
      tokenUsage: {
        input: this.totalTokensUsed.input,
        output: this.totalTokensUsed.output,
      },
      cost,
    };
  }
}
