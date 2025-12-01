import { BaseAgent } from "./base-agent";
import type {
  WritingInput,
  WritingOutput,
  BrandVoice,
  CompetitorAnalysisOutput,
} from "@/types/agents";
import { marked } from "marked";

// 配置 marked 全局選項（使用推薦的 marked.use() 方式）
marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

export class WritingAgent extends BaseAgent<WritingInput, WritingOutput> {
  get agentName(): string {
    return "WritingAgent";
  }

  protected async process(input: WritingInput): Promise<WritingOutput> {
    const markdown = await this.generateArticle(input);

    // 移除開頭的重複標題（H1 或 H2）
    let cleanedMarkdown = markdown;
    // 移除開頭的 H1
    cleanedMarkdown = cleanedMarkdown.replace(/^#\s+.+?\n\n?/, "");
    // 移除開頭的 H2（如果標題與文章標題相同且標題存在）
    if (input.strategy.selectedTitle) {
      const titleRegex = new RegExp(
        `^##\\s+${input.strategy.selectedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n\\n?`,
        "m",
      );
      cleanedMarkdown = cleanedMarkdown.replace(titleRegex, "");
    }

    // 轉換 Markdown 為 HTML（使用 marked v16+ 與全局配置）
    console.log("[WritingAgent] 📝 Converting Markdown to HTML...");
    console.log("[WritingAgent] Markdown length:", cleanedMarkdown.length);
    console.log(
      "[WritingAgent] Markdown preview (first 300 chars):",
      cleanedMarkdown.substring(0, 300),
    );

    let html: string;
    try {
      // marked.use() 已設置 async: true，parse 返回 Promise<string>
      html = await marked.parse(cleanedMarkdown);

      console.log("[WritingAgent] ✅ Markdown parsed successfully");
      console.log("[WritingAgent] HTML length:", html.length);
      console.log(
        "[WritingAgent] HTML preview (first 300 chars):",
        html.substring(0, 300),
      );
      console.log(
        "[WritingAgent] Starts with HTML tag?:",
        html.trim().startsWith("<"),
      );

      // 驗證轉換是否成功
      if (!html || html.trim().length === 0) {
        throw new Error("Marked returned empty HTML");
      }

      // 檢查是否仍然包含 Markdown 語法（可能是轉換失敗的標記）
      const markdownPatterns = ["##", "**", "```", "* ", "- "];
      const containsMarkdown = markdownPatterns.some((pattern) =>
        html.includes(pattern),
      );
      if (containsMarkdown) {
        console.warn(
          "[WritingAgent] ⚠️  Warning: HTML still contains potential Markdown syntax",
        );
        console.warn("[WritingAgent] Sample:", html.substring(0, 500));
      }
    } catch (error) {
      console.error("[WritingAgent] ❌ Failed to convert Markdown to HTML");
      console.error(
        "[WritingAgent] Error:",
        error instanceof Error ? error.message : String(error),
      );
      console.error(
        "[WritingAgent] Markdown sample that failed:",
        cleanedMarkdown.substring(0, 500),
      );
      throw new Error(
        `Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 為表格添加樣式類別
    const styledHtml = this.addTableStyles(html);

    console.log("[WritingAgent] Styled HTML length:", styledHtml.length);
    console.log(
      "[WritingAgent] Styled HTML preview (first 300 chars):",
      styledHtml.substring(0, 300),
    );

    const statistics = this.calculateStatistics(markdown);

    const internalLinks = this.extractInternalLinks(
      styledHtml,
      input.previousArticles,
    );

    const keywordUsage = this.analyzeKeywordUsage(
      markdown,
      input.strategy.outline,
    );

    const readability = this.calculateReadability(markdown);

    return {
      markdown,
      html: styledHtml,
      statistics,
      internalLinks,
      keywordUsage,
      readability,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateArticle(input: WritingInput): Promise<string> {
    const { strategy, brandVoice, previousArticles, competitorAnalysis } =
      input;

    const personaSection = this.buildPersonaFromVoice(brandVoice);
    const competitorSection = this.buildCompetitorContext(competitorAnalysis);
    const voiceExamplesSection = this.buildVoiceExamples(brandVoice);

    const prompt = `${personaSection}

# 你的任務
為「${strategy.selectedTitle}」撰寫一篇完整的文章。

${competitorSection}

${voiceExamplesSection}

# 文章大綱
${this.formatOutline(strategy.outline)}

# 目標規格
- 目標字數: ${strategy.targetWordCount} 字
- 主要關鍵字: ${strategy.outline.mainSections.flatMap((s) => s.keywords).join(", ")}
- LSI 關鍵字: ${strategy.lsiKeywords.join(", ")}

# 內部連結資源
${
  previousArticles.length > 0
    ? previousArticles
        .map(
          (a) => `- [${a.title}](${a.url}) - ${a.excerpt.substring(0, 80)}...`,
        )
        .join("\n")
    : "（暫無內部文章可連結）"
}

# 外部引用來源
${
  strategy.externalReferences && strategy.externalReferences.length > 0
    ? strategy.externalReferences
        .map((ref) => `- [${ref.title || ref.domain}](${ref.url})`)
        .join("\n")
    : "（請根據內容需求自行引用權威來源）"
}

# 格式要求
- Markdown 格式，直接從 ## 導言 開始（不重複標題）
- H2 (##) 為主要章節，H3 (###) 為子章節
- 適當使用清單、表格增加可讀性
- 禁止使用程式碼區塊（\`\`\`）
- 禁止生成 FAQ 段落（FAQ 由專門的 Agent 處理）

# 連結要求
- 內部連結: 至少 ${strategy.internalLinkingStrategy.minLinks} 個，自然融入相關段落
- 外部連結: 至少 3 個權威來源，在引用數據或觀點時加入

請撰寫完整的文章，直接輸出 Markdown 文字。`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    let content = response.content.trim();
    if (content.startsWith("```markdown")) {
      content = content.replace(/^```markdown\n/, "").replace(/\n```$/, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    return content;
  }

  private buildPersonaFromVoice(brandVoice: BrandVoice): string {
    const brandName = brandVoice.brand_name || "專業品牌";
    const writingStyle = brandVoice.writing_style;
    const brandIntegration = brandVoice.brand_integration;

    let styleDescription = "";
    if (writingStyle) {
      const styleMap: Record<string, string> = {
        short_punchy: "短句有力，節奏明快，像在和朋友聊天但帶著專業感",
        conversational: "對話式語調，親切自然，像在咖啡廳和讀者交流",
        academic: "嚴謹專業，邏輯清晰，適合需要深度分析的主題",
        storytelling: "敘事風格，用故事和案例帶動讀者，增加代入感",
        mixed: "靈活切換，根據內容需求調整節奏和語調",
      };
      styleDescription = styleMap[writingStyle.sentence_style] || "";
    }

    let interactionGuide = "";
    if (writingStyle?.use_questions) {
      interactionGuide = "適時拋出問題引導讀者思考，但不要過度使用";
    }

    return `# 你的寫作人格

你現在扮演「${brandName}」的資深內容編輯。

## 你的聲音特質
- 語調: ${brandVoice.tone_of_voice}
- 目標讀者: ${brandVoice.target_audience}
${styleDescription ? `- 寫作風格: ${styleDescription}` : ""}
${interactionGuide ? `- 互動方式: ${interactionGuide}` : ""}

## 品牌整合原則
${brandIntegration?.value_first ? "- 永遠先提供價值，再自然帶入品牌" : ""}
${brandIntegration?.max_brand_mentions ? `- 品牌提及控制在 ${brandIntegration.max_brand_mentions} 次以內` : ""}

## 你的寫作哲學
- 每個句子都要有存在的理由
- 用具體案例和數據說話，避免空泛陳述
- 讀者的時間很寶貴，直接給他們需要的資訊`;
  }

  private buildCompetitorContext(
    competitorAnalysis?: CompetitorAnalysisOutput,
  ): string {
    if (!competitorAnalysis) {
      return "";
    }

    const {
      differentiationStrategy,
      contentRecommendations,
      seoOpportunities,
    } = competitorAnalysis;

    return `# 競爭對手分析（你剛做完的研究）

## 我們的差異化策略
- 獨特角度: ${differentiationStrategy.contentAngle}
- 價值增強: ${differentiationStrategy.valueEnhancement}
- 用戶體驗: ${differentiationStrategy.userExperience}

## 內容建議
**必須涵蓋的要點**:
${contentRecommendations.mustInclude.map((item) => `- ${item}`).join("\n")}

**可深入發展的領域**:
${contentRecommendations.focusAreas.map((item) => `- ${item}`).join("\n")}

**競爭對手已覆蓋（可簡化）**:
${contentRecommendations.canSkip.map((item) => `- ${item}`).join("\n")}

## SEO 機會
- 可補充的關鍵字: ${seoOpportunities.keywordGaps.join(", ")}
- 結構優化建議: ${seoOpportunities.structureOptimization}`;
  }

  private buildVoiceExamples(brandVoice: BrandVoice): string {
    const examples = brandVoice.voice_examples;
    if (!examples || examples.good_examples.length === 0) {
      return "";
    }

    let section = `# 品牌聲音範例

## ✅ 我們的聲音（學習這種風格）
${examples.good_examples.map((ex) => `> ${ex}`).join("\n\n")}`;

    if (examples.bad_examples && examples.bad_examples.length > 0) {
      section += `

## ❌ 避免這種聲音
${examples.bad_examples.map((ex) => `> ${ex}`).join("\n\n")}`;
    }

    return section;
  }

  private formatOutline(outline: WritingInput["strategy"]["outline"]): string {
    let result = "## 導言\n";
    result += `- 開場: ${outline.introduction.hook}\n`;
    result += `- 背景: ${outline.introduction.context}\n`;
    result += `- 主旨: ${outline.introduction.thesis}\n\n`;

    outline.mainSections.forEach((section) => {
      result += `## ${section.heading}\n`;
      section.subheadings.forEach((sub) => {
        result += `### ${sub}\n`;
      });
      result += `重點: ${section.keyPoints.join(", ")}\n`;
      result += `字數: ${section.targetWordCount}\n\n`;
    });

    if (outline.conclusion) {
      result += "## 結論\n";
      result += `- 總結: ${outline.conclusion.summary}\n`;
      result += `- 行動呼籲: ${outline.conclusion.callToAction}\n\n`;
    }

    return result;
  }

  private calculateStatistics(markdown: string): WritingOutput["statistics"] {
    const text = markdown.replace(/[#*\[\]`]/g, "");
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const sentences = text
      .split(/[。！？.!?]+/)
      .filter((s) => s.trim().length > 0);
    const words = text.replace(/\s+/g, "");

    return {
      wordCount: words.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      readingTime: Math.ceil(words.length / 400),
      averageSentenceLength: words.length / sentences.length,
    };
  }

  private extractInternalLinks(
    html: string,
    previousArticles: WritingInput["previousArticles"],
  ): WritingOutput["internalLinks"] {
    const links: WritingOutput["internalLinks"] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const anchor = match[2];

      const article = previousArticles.find((a) => a.url === url);
      if (article) {
        links.push({
          anchor,
          url,
          section: "",
          articleId: article.id,
        });
      }
    }

    return links;
  }

  private analyzeKeywordUsage(
    markdown: string,
    outline: WritingInput["strategy"]["outline"],
  ): WritingOutput["keywordUsage"] {
    const text = markdown.toLowerCase();
    const keywords = outline.mainSections.flatMap((s) => s.keywords);

    let totalCount = 0;
    keywords.forEach((keyword) => {
      const count = (text.match(new RegExp(keyword.toLowerCase(), "g")) || [])
        .length;
      totalCount += count;
    });

    const wordCount = markdown.replace(/\s+/g, "").length;
    const density = (totalCount / wordCount) * 100;

    return {
      count: totalCount,
      density,
      distribution: outline.mainSections.map((section) => ({
        section: section.heading,
        count: 0,
      })),
    };
  }

  private calculateReadability(markdown: string): WritingOutput["readability"] {
    const text = markdown.replace(/[#*\[\]`]/g, "");
    const sentences = text
      .split(/[。！？.!?]+/)
      .filter((s) => s.trim().length > 0);
    const words = text.replace(/\s+/g, "");
    const syllables = words.length * 1.5;

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const fleschKincaidGrade =
      0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    const fleschReadingEase =
      206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

    const gunningFogIndex =
      0.4 * (avgSentenceLength + 100 * (syllables / words.length));

    return {
      fleschKincaidGrade: Math.max(0, fleschKincaidGrade),
      fleschReadingEase: Math.max(0, Math.min(100, fleschReadingEase)),
      gunningFogIndex: Math.max(0, gunningFogIndex),
    };
  }

  private addTableStyles(html: string): string {
    let result = html;

    // 為表格添加 inline style，使其更美觀
    result = result
      .replace(
        /<table>/g,
        '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">',
      )
      .replace(
        /<th>/g,
        '<th style="border: 1px solid #ddd; padding: 12px 15px; text-align: left; background-color: #f8f9fa; font-weight: 600;">',
      )
      .replace(
        /<td>/g,
        '<td style="border: 1px solid #ddd; padding: 12px 15px; text-align: left;">',
      )
      .replace(/<tr>/g, '<tr style="border-bottom: 1px solid #ddd;">');

    // 移除程式碼區塊，轉換為引言區塊
    result = this.convertCodeBlocksToBlockquotes(result);

    return result;
  }

  private convertCodeBlocksToBlockquotes(html: string): string {
    // 處理 <pre><code> 程式碼區塊
    // 將程式碼區塊轉換為格式化的引言區塊或純文字
    return html.replace(
      /<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g,
      (_match, code) => {
        // 解碼 HTML 實體
        const decodedCode = code
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&");

        // 將程式碼轉換為格式化的引言區塊
        const lines = decodedCode
          .split("\n")
          .filter((line: string) => line.trim());
        const formattedLines = lines
          .map(
            (line: string) =>
              `<p style="margin: 0; padding-left: 20px; font-family: monospace; background: #f5f5f5;">${line}</p>`,
          )
          .join("");

        return `<blockquote style="border-left: 4px solid #ddd; margin: 20px 0; padding: 10px 20px; background: #f9f9f9;">${formattedLines}</blockquote>`;
      },
    );
  }
}
