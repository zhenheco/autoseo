import { BaseAgent } from "./base-agent";
import type {
  WritingInput,
  WritingOutput,
  BrandVoice,
  CompetitorAnalysisOutput,
} from "@/types/agents";
import { marked } from "marked";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";

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

    // 移除所有 H1 標題（文章內容不應包含 H1，H1 由頁面標題處理）
    html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "");

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
    const {
      strategy,
      brandVoice,
      previousArticles,
      competitorAnalysis,
      targetLanguage,
      targetRegion,
    } = input;

    // Get the language name for the prompt
    const languageName =
      LOCALE_FULL_NAMES[targetLanguage || "zh-TW"] ||
      "Traditional Chinese (繁體中文)";
    const regionName = targetRegion || "Taiwan";

    const personaSection = this.buildPersonaFromVoice(brandVoice, languageName);
    const competitorSection = this.buildCompetitorContext(competitorAnalysis);
    const voiceExamplesSection = this.buildVoiceExamples(brandVoice);

    const prompt = `${personaSection}

# Your Task
Write a complete article for "${strategy.selectedTitle}".

**CRITICAL: Output Language Requirement**
- ALL content MUST be written in ${languageName}
- Target region/audience: ${regionName}
- Use culturally appropriate expressions and references for the target region
- Do NOT mix languages unless quoting specific terms

${competitorSection}

${voiceExamplesSection}

# Article Outline
${this.formatOutline(strategy.outline)}

# Target Specifications
- Target word count: ${strategy.targetWordCount} words/characters
- Primary keywords: ${strategy.outline.mainSections.flatMap((s) => s.keywords).join(", ")}
- LSI keywords: ${strategy.lsiKeywords.join(", ")}

# Format Requirements
- Markdown format, start directly with ## Introduction (do not repeat title)
- H2 (##) for main sections, H3 (###) for subsections
- Use lists and tables appropriately for readability
- Do NOT use code blocks (\`\`\`)
- Do NOT generate FAQ sections (FAQ is handled by a dedicated Agent)

# Perspective Integration & Analysis Requirements (IMPORTANT!)

## Writing Structure (for each H2 section)
1. **Present multiple perspectives**: Cite 2-3 different sources or angles
   - Use phrases like: "According to [source]'s research...", "Expert [name] believes...", "Industry consensus suggests..."
2. **Compare viewpoints**: Point out differences or controversies between perspectives
   - Use phrases like: "In contrast...", "On the other hand...", "However, some argue..."
3. **Author's analysis**: Synthesize perspectives and provide your conclusion
   - Use phrases like: "Based on my analysis...", "From a practical standpoint...", "In my experience..."
4. **Actionable advice**: Give readers concrete action items

## Prohibited Writing Patterns
- ❌ Listing information without analysis
- ❌ All paragraphs following the same structure
- ❌ Lacking opinion expressions like "I believe", "recommend", "analysis suggests"
- ❌ Pure data repetition without personal insights

## 🚫 Banned Phrases (NEVER use these)
**AI-sounding phrases** (avoid in ALL languages):
- "Crucial/vital/essential" overuse
- "In conclusion/To summarize" at every section end
- "It's worth noting/mentioning"
- "Needless to say/Obviously"
- "In today's world/society"
- "As we all know"

**Use natural conversational alternatives instead**

## Example Writing Pattern
"Regarding X, the industry has different views. Group A believes we should..., while Group B advocates...

**My analysis**: Based on practical experience and research data, I believe [conclusion]. For [specific reader type], I recommend [specific advice]."

# Citation Requirements
- When citing data or opinions, use expressions like "Research shows...", "Experts point out..."
- Links will be automatically inserted in post-processing; focus on content quality

Write the complete article now. Output ONLY the Markdown content in ${languageName}.`;

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

  private buildPersonaFromVoice(
    brandVoice: BrandVoice,
    languageName: string,
  ): string {
    const brandName = brandVoice.brand_name || "Professional Brand";
    const writingStyle = brandVoice.writing_style;
    const brandIntegration = brandVoice.brand_integration;

    let styleDescription = "";
    if (writingStyle) {
      const styleMap: Record<string, string> = {
        short_punchy:
          "Short, punchy sentences with a fast pace - conversational yet professional",
        conversational:
          "Conversational tone, warm and natural, like chatting with a friend at a café",
        academic:
          "Rigorous and professional, logically clear, suitable for in-depth analysis",
        storytelling:
          "Narrative style, using stories and cases to engage readers",
        mixed:
          "Flexible switching, adjusting pace and tone based on content needs",
      };
      styleDescription = styleMap[writingStyle.sentence_style] || "";
    }

    let interactionGuide = "";
    if (writingStyle?.use_questions) {
      interactionGuide =
        "Occasionally pose questions to engage readers, but don't overuse";
    }

    return `# Your Writing Persona

You are now acting as a senior content editor for "${brandName}".
**IMPORTANT: All output must be in ${languageName}**

## Your Voice Characteristics
- Tone: ${brandVoice.tone_of_voice}
- Target audience: ${brandVoice.target_audience}
${styleDescription ? `- Writing style: ${styleDescription}` : ""}
${interactionGuide ? `- Reader interaction: ${interactionGuide}` : ""}

## Brand Integration Principles
${brandIntegration?.value_first ? "- Always provide value first, then naturally incorporate the brand" : ""}
${brandIntegration?.max_brand_mentions ? `- Limit brand mentions to ${brandIntegration.max_brand_mentions} times maximum` : ""}

## Your Writing Philosophy
- Every sentence must have a reason to exist
- Use concrete examples and data, avoid vague statements
- Readers' time is precious - give them what they need directly`;
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

    return `# Competitor Analysis (your recent research)

## Our Differentiation Strategy
- Unique angle: ${differentiationStrategy.contentAngle}
- Value enhancement: ${differentiationStrategy.valueEnhancement}
- User experience: ${differentiationStrategy.userExperience}

## Content Recommendations
**Must include**:
${contentRecommendations.mustInclude.map((item) => `- ${item}`).join("\n")}

**Areas to develop in depth**:
${contentRecommendations.focusAreas.map((item) => `- ${item}`).join("\n")}

**Already covered by competitors (can simplify)**:
${contentRecommendations.canSkip.map((item) => `- ${item}`).join("\n")}

## SEO Opportunities
- Keyword gaps to fill: ${seoOpportunities.keywordGaps.join(", ")}
- Structure optimization suggestions: ${seoOpportunities.structureOptimization}`;
  }

  private buildVoiceExamples(brandVoice: BrandVoice): string {
    const examples = brandVoice.voice_examples;
    if (!examples || examples.good_examples.length === 0) {
      return "";
    }

    let section = `# Brand Voice Examples

## ✅ Our Voice (learn this style)
${examples.good_examples.map((ex) => `> ${ex}`).join("\n\n")}`;

    if (examples.bad_examples && examples.bad_examples.length > 0) {
      section += `

## ❌ Avoid This Voice
${examples.bad_examples.map((ex) => `> ${ex}`).join("\n\n")}`;
    }

    return section;
  }

  private formatOutline(outline: WritingInput["strategy"]["outline"]): string {
    let result = "## Introduction\n";
    result += `- Hook: ${outline.introduction.hook}\n`;
    result += `- Context: ${outline.introduction.context}\n`;
    result += `- Thesis: ${outline.introduction.thesis}\n\n`;

    outline.mainSections.forEach((section) => {
      result += `## ${section.heading}\n`;
      section.subheadings.forEach((sub) => {
        result += `### ${sub}\n`;
      });
      result += `Key points: ${section.keyPoints.join(", ")}\n`;
      result += `Target word count: ${section.targetWordCount}\n\n`;
    });

    if (outline.conclusion) {
      result += "## Conclusion\n";
      result += `- Summary: ${outline.conclusion.summary}\n`;
      result += `- Call to action: ${outline.conclusion.callToAction}\n\n`;
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
