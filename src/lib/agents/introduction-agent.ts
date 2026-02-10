import { BaseAgent } from "./base-agent";
import type {
  IntroductionInput,
  IntroductionOutput,
  ContentContext,
  ResearchSummary,
} from "@/types/agents";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";

export class IntroductionAgent extends BaseAgent<
  IntroductionInput,
  IntroductionOutput
> {
  get agentName(): string {
    return "IntroductionAgent";
  }

  private buildTopicAlignmentSection(contentContext?: ContentContext): string {
    if (!contentContext) {
      return "";
    }

    return `## ⚠️ CRITICAL: Topic Alignment Requirement

**Article Title**: ${contentContext.selectedTitle}
**PRIMARY KEYWORD**: ${contentContext.primaryKeyword}
**Search Intent**: ${contentContext.searchIntent}
**Target Audience**: ${contentContext.targetAudience}

**You MUST ensure the introduction directly addresses "${contentContext.primaryKeyword}".**
**The opening hook and context must be relevant to the main topic.**
**Do NOT include any content that is unrelated to "${contentContext.primaryKeyword}".**

---`;
  }

  private buildResearchSummarySection(researchSummary?: ResearchSummary): string {
    if (!researchSummary || !researchSummary.keyFindings) {
      return "";
    }

    let section = `\n## Research Summary (Incorporate into introduction)\n`;
    section += `**Key Findings:** ${researchSummary.keyFindings}\n`;
    if (researchSummary.trendHighlight) {
      section += `**Current Trend:** ${researchSummary.trendHighlight}\n`;
    }
    if (researchSummary.topCitations.length > 0) {
      section += `**Top Sources:** ${researchSummary.topCitations.slice(0, 3).join(", ")}\n`;
    }
    section += `\n**Use a compelling statistic or trend from the research above to hook readers.**\n`;
    return section;
  }

  protected async process(
    input: IntroductionInput,
  ): Promise<IntroductionOutput> {
    const { outline, brandVoice, contentContext, researchSummary } = input;

    const targetLang = input.targetLanguage || "zh-TW";
    const languageName =
      LOCALE_FULL_NAMES[targetLang] || "Traditional Chinese (繁體中文)";

    const topicAlignmentSection =
      this.buildTopicAlignmentSection(contentContext);
    const researchSummarySection =
      this.buildResearchSummarySection(researchSummary);

    const prompt = `${topicAlignmentSection}
${researchSummarySection}
Write an article introduction based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Outline Information
- Hook: ${outline.introduction.hook}
- Context: ${outline.introduction.context}
- Thesis: ${outline.introduction.thesis}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}
- Sentence Style: ${brandVoice.sentence_style || "Clear and concise"}
- Interactivity: ${brandVoice.interactivity || "Moderate"}

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
      maxTokens: input.maxTokens || 500,
    });

    const markdown = response.content.trim();
    const wordCount = this.countWords(markdown);

    return {
      markdown,
      wordCount,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private countWords(text: string): number {
    const plainText = text
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/[#*`]/g, "")
      .trim();

    // 計算中文字符數
    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 計算英文單詞數（排除中文後按空格分詞）
    const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, "");
    const englishWords = nonChineseText.trim()
      ? nonChineseText.trim().split(/\s+/).length
      : 0;

    // 如果中文字符多，使用中文字符數；否則使用英文單詞數
    return chineseChars > englishWords
      ? chineseChars
      : Math.max(chineseChars + englishWords, 1);
  }
}
