import { BaseAgent, AgentExecutionContext } from "./base-agent";
import { marked } from "marked";
import type {
  BrandVoice,
  ContentContext,
  WritingOutput,
  SectionOutput,
  StrategyOutput,
  SpecialBlock,
  GeneratedImage,
  AIClientConfig,
  UnifiedWritingInput,
} from "@/types/agents";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";
import {
  getSpecialBlockLabel,
  getTranslation,
  FAQ_HEADERS,
} from "@/lib/i18n/article-translations";

export type { UnifiedWritingInput };

marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

interface SectionWriteInput {
  heading: string;
  subheadings: string[];
  keyPoints: string[];
  targetWordCount: number;
  keywords: string[];
  previousSummary?: string;
  sectionImage: GeneratedImage | null;
  specialBlock?: SpecialBlock;
  index: number;
}

export class UnifiedWritingAgent extends BaseAgent<
  UnifiedWritingInput,
  WritingOutput
> {
  constructor(config: AIClientConfig, context: AgentExecutionContext) {
    super(config, context);
  }

  get agentName(): string {
    return "UnifiedWritingAgent";
  }

  protected async process(input: UnifiedWritingInput): Promise<WritingOutput> {
    console.log("[UnifiedWritingAgent] Starting sequential writing flow...");

    const { strategy, contentPlan, brandVoice, imageOutput, primaryKeyword } =
      input;
    const targetLang = input.targetLanguage || "zh-TW";
    const languageName =
      LOCALE_FULL_NAMES[targetLang] || "Traditional Chinese (繁體中文)";

    const contentContext: ContentContext = {
      primaryKeyword,
      selectedTitle:
        contentPlan?.optimizedTitle?.primary || strategy.selectedTitle,
      searchIntent: "informational",
      targetAudience: brandVoice.target_audience,
      topicKeywords: strategy.keywords.slice(0, 10),
      regionContext: input.region,
      industryContext: input.industry,
      brandName: brandVoice.brand_name,
      toneGuidance: contentPlan?.contentStrategy?.toneGuidance,
    };

    console.log("[UnifiedWritingAgent] 步驟 1: 生成開頭");
    const introduction = await this.writeIntroduction(
      input,
      languageName,
      contentContext,
    );

    console.log("[UnifiedWritingAgent] 步驟 2: 順序生成各段落");
    const sections: SectionOutput[] = [];
    let previousSummary: string | undefined;

    const mainSections = strategy.outline.mainSections;
    const sectionSpecialBlocks =
      contentPlan?.detailedOutline?.mainSections?.map((s) => s.specialBlock) ||
      [];

    for (let i = 0; i < mainSections.length; i++) {
      const section = mainSections[i];
      const sectionImage = imageOutput?.contentImages?.[i] || null;
      const specialBlock = sectionSpecialBlocks[i];

      console.log(
        `[UnifiedWritingAgent] 段落 ${i + 1}/${mainSections.length}: ${section.heading}`,
      );

      const sectionOutput = await this.writeSection(
        {
          heading: section.heading,
          subheadings: section.subheadings,
          keyPoints: section.keyPoints,
          targetWordCount: section.targetWordCount,
          keywords: section.keywords,
          previousSummary,
          sectionImage,
          specialBlock,
          index: i,
        },
        input,
        languageName,
        contentContext,
      );

      sections.push(sectionOutput);
      previousSummary = sectionOutput.summary;
    }

    console.log("[UnifiedWritingAgent] 步驟 3: 生成結論");
    const conclusion = await this.writeConclusion(
      input,
      languageName,
      contentContext,
    );

    console.log("[UnifiedWritingAgent] 步驟 4: 生成 FAQ");
    const qa = await this.writeQA(input, languageName, contentContext);

    console.log("[UnifiedWritingAgent] 步驟 5: 組裝內容");
    const assembled = await this.assembleContent(
      strategy.selectedTitle,
      introduction,
      sections,
      conclusion,
      qa,
    );

    console.log("[UnifiedWritingAgent] 步驟 6: 計算統計資料");
    const output = this.buildWritingOutput(
      assembled,
      strategy,
      primaryKeyword,
      input.model,
    );

    console.log("[UnifiedWritingAgent] ✅ 寫作完成");
    return output;
  }

  private async writeIntroduction(
    input: UnifiedWritingInput,
    languageName: string,
    contentContext: ContentContext,
  ): Promise<{ markdown: string; wordCount: number }> {
    const { strategy, brandVoice } = input;
    const outline = strategy.outline;

    const prompt = `${this.buildTopicAlignmentSection(contentContext)}

Write an article introduction based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Outline Information
- Hook: ${outline.introduction.hook}
- Context: ${outline.introduction.context}
- Thesis: ${outline.introduction.thesis}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}

## Requirements
1. Word count: 150-250 words
2. Must include an engaging opening
3. Clearly explain the article topic and reader value
4. Tone matches brand style
5. Use Markdown format

**CRITICAL: Write ALL content in ${languageName}**

## Output Format
Output the introduction content in Markdown directly, without including a title.`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: 500,
    });

    const markdown = response.content.trim();

    return {
      markdown,
      wordCount: this.countWords(markdown),
    };
  }

  private async writeSection(
    sectionInput: SectionWriteInput,
    input: UnifiedWritingInput,
    languageName: string,
    contentContext: ContentContext,
  ): Promise<SectionOutput> {
    const { brandVoice } = input;
    const {
      heading,
      subheadings,
      keyPoints,
      targetWordCount,
      keywords,
      previousSummary,
      sectionImage,
      specialBlock,
    } = sectionInput;

    const specialBlockSection = this.buildSpecialBlockSection(
      specialBlock,
      contentContext.brandName,
      input.targetLanguage,
    );

    const prompt = `${this.buildTopicAlignmentSection(contentContext)}

Write an article section based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Section Information
- Heading: ${heading}
- Subheadings: ${subheadings.join(", ")}
- Key Points: ${keyPoints.join(", ")}
- Target Word Count: ${targetWordCount} words
- Related Keywords: ${keywords.join(", ")}

${previousSummary ? `## Previous Section Summary\n${previousSummary}\n\nEnsure smooth transition and coherence with the previous section.` : ""}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}

## Requirements
1. Word count: ${targetWordCount - 50} ~ ${targetWordCount + 50} words
2. Use Markdown format
3. Include section heading (## ${heading})
4. Use ### for subheadings if applicable
5. Cover all key points
6. Naturally integrate related keywords
${sectionImage ? `7. Insert image at appropriate position: ![${sectionImage.altText || heading}](${sectionImage.url})` : ""}
8. Provide a brief summary at the end (for connecting to next section)
${specialBlockSection}

## Writing Style (Important!)
1. Present 2-3 different viewpoints or sources on key topics
2. Compare and contrast different perspectives where relevant
3. Provide your analysis and conclusions
4. Give actionable recommendations to readers

**CRITICAL: Write ALL content in ${languageName}**

## Output Format (JSON)
{
  "content": "Section content in Markdown",
  "summary": "Brief summary (max 50 words)"
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: Math.max(targetWordCount * 2, 1000),
      format: "json",
    });

    let markdown = "";
    let summary = "";

    try {
      const parsed = JSON.parse(response.content);
      markdown = parsed.content || response.content;
      summary = parsed.summary || this.generateSummary(markdown);
    } catch {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          markdown = parsed.content || response.content;
          summary = parsed.summary || this.generateSummary(markdown);
        } catch {
          markdown = response.content;
          summary = this.generateSummary(markdown);
        }
      } else {
        markdown = response.content;
        summary = this.generateSummary(markdown);
      }
    }

    if (sectionImage && !markdown.includes("![")) {
      const lines = markdown.split("\n");
      const insertIndex = Math.floor(lines.length / 2);
      lines.splice(
        insertIndex,
        0,
        "",
        `![${sectionImage.altText || heading}](${sectionImage.url})`,
        "",
      );
      markdown = lines.join("\n");
    }

    return {
      markdown,
      summary,
      wordCount: this.countWords(markdown),
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async writeConclusion(
    input: UnifiedWritingInput,
    languageName: string,
    contentContext: ContentContext,
  ): Promise<{ markdown: string; wordCount: number }> {
    const { strategy, brandVoice } = input;
    const outline = strategy.outline;
    const mainPoints = outline.mainSections.map((s) => s.heading).join(", ");

    const prompt = `${this.buildTopicAlignmentSection(contentContext)}

Write an article conclusion based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Conclusion Information
- Summary: ${outline.conclusion.summary}
- Call to Action: ${outline.conclusion.callToAction}

## Main Article Sections
${mainPoints}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}

## Requirements
1. Word count: 100-200 words
2. Briefly summarize the article's core points
3. Provide a clear call to action or next steps
4. Tone should be positive and encouraging
5. Use Markdown format
6. Include conclusion heading (## 結論)

**CRITICAL: Write ALL content in ${languageName}**

## Output Format
Output the conclusion content in Markdown directly.`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: 400,
    });

    const markdown = response.content.trim();
    return {
      markdown,
      wordCount: this.countWords(markdown),
    };
  }

  private async writeQA(
    input: UnifiedWritingInput,
    languageName: string,
    contentContext: ContentContext,
  ): Promise<{
    faqs: Array<{ question: string; answer: string }>;
    markdown: string;
    schemaJson: string;
  }> {
    const { strategy, brandVoice, contentPlan } = input;
    const title = strategy.selectedTitle;
    const mainTopics = strategy.outline.mainSections
      .map((s) => s.heading)
      .join(", ");
    const count = contentPlan?.detailedOutline?.faq?.questions?.length || 5;

    const prompt = `${this.buildTopicAlignmentSection(contentContext)}

Generate frequently asked questions (FAQ) for the article "${title}".

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Article Topics
- Title: ${title}
- Main Sections: ${mainTopics}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}

## Requirements
1. Generate ${count} frequently asked questions
2. Each question should be something readers would actually ask
3. Answers should be detailed and practical (at least 50 words each)
4. Questions should cover different aspects (basic, advanced, application, etc.)
5. Tone should match brand style

**CRITICAL: Write ALL questions and answers in ${languageName}**

## Output Format (JSON)
{
  "faqs": [
    {
      "question": "Question 1?",
      "answer": "Detailed answer"
    }
  ]
}`;

    let faqs: Array<{ question: string; answer: string }> = [];

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.7,
        maxTokens: 1500,
        format: "json",
      });

      try {
        const parsed = JSON.parse(response.content);
        faqs = parsed.faqs || parsed;
      } catch {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            faqs = parsed.faqs || parsed;
          } catch {
            faqs = this.getFallbackFAQs(title, input.targetLanguage || "zh-TW");
          }
        } else {
          faqs = this.getFallbackFAQs(title, input.targetLanguage || "zh-TW");
        }
      }

      if (!Array.isArray(faqs) || faqs.length === 0) {
        faqs = this.getFallbackFAQs(title, input.targetLanguage || "zh-TW");
      }
    } catch {
      faqs = this.getFallbackFAQs(title, input.targetLanguage || "zh-TW");
    }

    const markdown = this.formatFAQsAsMarkdown(faqs, input.targetLanguage);
    const schemaJson = this.generateFAQSchema(faqs);

    return { faqs, markdown, schemaJson };
  }

  private async assembleContent(
    title: string,
    introduction: { markdown: string; wordCount: number },
    sections: SectionOutput[],
    conclusion: { markdown: string; wordCount: number },
    qa: {
      faqs: Array<{ question: string; answer: string }>;
      markdown: string;
      schemaJson: string;
    },
  ): Promise<{
    markdown: string;
    html: string;
    statistics: {
      totalWords: number;
      totalParagraphs: number;
      totalSections: number;
      totalFAQs: number;
    };
  }> {
    const markdownParts: string[] = [];

    markdownParts.push(`# ${title}`, "");
    markdownParts.push(introduction.markdown, "");

    sections.forEach((section) => {
      markdownParts.push(section.markdown, "");
    });

    markdownParts.push(conclusion.markdown, "");
    markdownParts.push(qa.markdown, "");

    let markdown = markdownParts.join("\n");
    markdown = this.cleanupMarkdown(markdown);

    let html = await this.convertToHTML(markdown);

    if (qa.schemaJson) {
      html += `\n<script type="application/ld+json">\n${qa.schemaJson}\n</script>`;
    }

    const totalWords =
      introduction.wordCount +
      sections.reduce((sum, s) => sum + s.wordCount, 0) +
      conclusion.wordCount;

    const paragraphs = markdown
      .split(/\n\n+/)
      .filter((p) => p.trim() && !p.startsWith("#"));

    return {
      markdown,
      html,
      statistics: {
        totalWords,
        totalParagraphs: paragraphs.length,
        totalSections: sections.length,
        totalFAQs: qa.faqs.length,
      },
    };
  }

  private buildWritingOutput(
    assembled: {
      markdown: string;
      html: string;
      statistics: {
        totalWords: number;
        totalParagraphs: number;
        totalSections: number;
        totalFAQs: number;
      };
    },
    strategy: StrategyOutput,
    primaryKeyword: string,
    model: string,
  ): WritingOutput {
    const plainText = assembled.html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const sentences = plainText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    const keywordCount = (
      assembled.markdown
        .toLowerCase()
        .match(new RegExp(primaryKeyword.toLowerCase(), "g")) || []
    ).length;
    const keywordDensity =
      assembled.statistics.totalWords > 0
        ? (keywordCount / assembled.statistics.totalWords) * 100
        : 0;

    return {
      markdown: assembled.markdown,
      html: assembled.html,
      statistics: {
        wordCount: assembled.statistics.totalWords,
        paragraphCount: assembled.statistics.totalParagraphs,
        sentenceCount: sentences.length,
        readingTime: Math.ceil(assembled.statistics.totalWords / 200),
        averageSentenceLength:
          sentences.length > 0
            ? assembled.statistics.totalWords / sentences.length
            : 0,
      },
      internalLinks:
        strategy.internalLinkingStrategy?.targetSections?.map((s) => ({
          anchor: s,
          url: "",
          section: "",
          articleId: "",
        })) || [],
      keywordUsage: {
        count: keywordCount,
        density: parseFloat(keywordDensity.toFixed(2)),
        distribution: [],
      },
      readability: {
        fleschKincaidGrade: 8,
        fleschReadingEase: 60,
        gunningFogIndex: 10,
      },
      executionInfo: {
        model,
        executionTime: 0,
        tokenUsage: { input: 0, output: 0 },
      },
    };
  }

  private buildTopicAlignmentSection(contentContext: ContentContext): string {
    return `## ⚠️ CRITICAL: Topic Alignment Requirement

**Article Title**: ${contentContext.selectedTitle}
**PRIMARY KEYWORD**: ${contentContext.primaryKeyword}
**Search Intent**: ${contentContext.searchIntent}
**Target Audience**: ${contentContext.targetAudience}
${contentContext.regionContext ? `**Region Context**: ${contentContext.regionContext}` : ""}
${contentContext.industryContext ? `**Industry Context**: ${contentContext.industryContext}` : ""}

**You MUST ensure ALL content is DIRECTLY relevant to the topic "${contentContext.primaryKeyword}".**
**Do NOT include any content that is unrelated to the main topic.**

---`;
  }

  private buildSpecialBlockSection(
    specialBlock?: SpecialBlock,
    brandName?: string,
    targetLanguage?: string,
  ): string {
    if (!specialBlock) return "";

    const brand = brandName || "";
    const locale = targetLanguage || "zh-TW";

    switch (specialBlock.type) {
      case "expert_tip":
      case "tip_block": {
        const tipLabel = getSpecialBlockLabel("tip", locale);
        return `
## Special Block Requirement
Include a "${tipLabel}" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 50-80 words

Example format:
> **${brand ? brand + " " : ""}${tipLabel}**
>
> [Your practical tip here, 50-80 words]`;
      }

      case "local_advantage": {
        const localAdvLabel = getSpecialBlockLabel("local_advantage", locale);
        return `
## Special Block Requirement
Include a "${localAdvLabel}" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 80-120 words

Example format:
> **${localAdvLabel}**
>
> [Your local advantage description here, 80-120 words]`;
      }

      case "expert_warning":
      case "warning_block": {
        const warningLabel = getSpecialBlockLabel("warning", locale);
        return `
## Special Block Requirement
Include a "${warningLabel}" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 50-80 words

Example format:
> **${warningLabel}**
>
> [Your warning or caution here, 50-80 words]`;
      }

      default:
        return "";
    }
  }

  private generateSummary(markdown: string): string {
    const plainText = markdown
      .replace(/[#*`]/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "");
    const sentences = plainText.split(/[。！？\n]/).filter((s) => s.trim());
    return sentences.slice(0, 2).join("。") + "。";
  }

  private countWords(text: string): number {
    const plainText = text
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/[#*`]/g, "")
      .trim();

    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, "");
    const englishWords = nonChineseText.trim()
      ? nonChineseText.trim().split(/\s+/).length
      : 0;

    return chineseChars > englishWords
      ? chineseChars
      : Math.max(chineseChars + englishWords, 1);
  }

  private cleanupMarkdown(markdown: string): string {
    let cleaned = markdown;
    cleaned = cleaned.replace(/#{1,6}\s+#\s+/g, (match) => {
      return match.replace(/\s+#\s+/, " ");
    });
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.trim();
    return cleaned;
  }

  private async convertToHTML(markdown: string): Promise<string> {
    try {
      const html = await marked.parse(markdown);
      return html;
    } catch {
      return this.fallbackConversion(markdown);
    }
  }

  private fallbackConversion(markdown: string): string {
    const blocks = markdown.split(/\n\n+/);
    const htmlBlocks: string[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("######")) {
        htmlBlocks.push(`<h6>${trimmed.slice(6).trim()}</h6>`);
      } else if (trimmed.startsWith("#####")) {
        htmlBlocks.push(`<h5>${trimmed.slice(5).trim()}</h5>`);
      } else if (trimmed.startsWith("####")) {
        htmlBlocks.push(`<h4>${trimmed.slice(4).trim()}</h4>`);
      } else if (trimmed.startsWith("###")) {
        htmlBlocks.push(`<h3>${trimmed.slice(3).trim()}</h3>`);
      } else if (trimmed.startsWith("##")) {
        htmlBlocks.push(`<h2>${trimmed.slice(2).trim()}</h2>`);
      } else if (trimmed.startsWith("#")) {
        htmlBlocks.push(`<h1>${trimmed.slice(1).trim()}</h1>`);
      } else if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed.split(/\n/).map((line) => {
          const content = line.replace(/^[-*]\s+/, "");
          return `<li>${this.inlineMarkdown(content)}</li>`;
        });
        htmlBlocks.push(`<ul>${items.join("")}</ul>`);
      } else if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split(/\n/).map((line) => {
          const content = line.replace(/^\d+\.\s+/, "");
          return `<li>${this.inlineMarkdown(content)}</li>`;
        });
        htmlBlocks.push(`<ol>${items.join("")}</ol>`);
      } else {
        const lines = trimmed
          .split(/\n/)
          .map((line) => this.inlineMarkdown(line));
        htmlBlocks.push(`<p>${lines.join("<br>")}</p>`);
      }
    }

    return htmlBlocks.join("\n");
  }

  private inlineMarkdown(text: string): string {
    let result = text;
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    result = result.replace(/`(.+?)`/g, "<code>$1</code>");
    return result;
  }

  private formatFAQsAsMarkdown(
    faqs: Array<{ question: string; answer: string }>,
    targetLanguage?: string,
  ): string {
    const faqHeader = getTranslation(FAQ_HEADERS, targetLanguage || "zh-TW");
    const lines = [`## ${faqHeader}`, ""];
    faqs.forEach((faq, index) => {
      lines.push(`### ${index + 1}. ${faq.question}`, "");
      lines.push(faq.answer, "");
    });
    return lines.join("\n");
  }

  private generateFAQSchema(
    faqs: Array<{ question: string; answer: string }>,
  ): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    };
    return JSON.stringify(schema, null, 2);
  }

  private getFallbackFAQs(
    title: string,
    targetLang: string,
  ): Array<{ question: string; answer: string }> {
    const fallbacksByLang: Record<
      string,
      Array<{ question: string; answer: string }>
    > = {
      "zh-TW": [
        {
          question: `什麼是${title}？`,
          answer: `${title}是一個重要的主題，涵蓋多個面向。本文將深入探討${title}的核心概念和實際應用。`,
        },
        {
          question: `${title}適合哪些人？`,
          answer: `${title}適合想要深入了解相關主題的讀者，無論是初學者還是有經驗的從業人員，都能從中獲益。`,
        },
        {
          question: `如何開始學習${title}？`,
          answer: `建議從基礎概念開始，循序漸進地學習。本文提供了完整的指南，幫助您系統性地掌握${title}。`,
        },
      ],
      "zh-CN": [
        {
          question: `什么是${title}？`,
          answer: `${title}是一个重要的主题，涵盖多个方面。本文将深入探讨${title}的核心概念和实际应用。`,
        },
        {
          question: `${title}适合哪些人？`,
          answer: `${title}适合想要深入了解相关主题的读者，无论是初学者还是有经验的从业人员，都能从中获益。`,
        },
        {
          question: `如何开始学习${title}？`,
          answer: `建议从基础概念开始，循序渐进地学习。本文提供了完整的指南，帮助您系统性地掌握${title}。`,
        },
      ],
      en: [
        {
          question: `What is ${title}?`,
          answer: `${title} is an important topic covering multiple aspects. This article explores the core concepts and practical applications of ${title}.`,
        },
        {
          question: `Who is ${title} suitable for?`,
          answer: `${title} is suitable for readers who want to understand the topic deeply, whether beginners or experienced professionals can benefit from it.`,
        },
        {
          question: `How to get started with ${title}?`,
          answer: `It's recommended to start with basic concepts and learn progressively. This article provides a complete guide to help you master ${title} systematically.`,
        },
      ],
    };

    return fallbacksByLang[targetLang] || fallbacksByLang["zh-TW"];
  }
}
