import { BaseAgent } from "./base-agent";
import type {
  IntroductionInput,
  IntroductionOutput,
  ResearchSummary,
} from "@/types/agents";
import {
  buildLanguageInstructions,
  buildTopicAlignment,
  countWords,
} from "./prompt-utils";

export class IntroductionAgent extends BaseAgent<
  IntroductionInput,
  IntroductionOutput
> {
  get agentName(): string {
    return "IntroductionAgent";
  }

  private buildResearchSummarySection(
    researchSummary?: ResearchSummary,
  ): string {
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
    const langInstructions = buildLanguageInstructions(targetLang);
    const topicAlignment = buildTopicAlignment(contentContext);
    const researchSummarySection =
      this.buildResearchSummarySection(researchSummary);

    const prompt = `${topicAlignment ? `${topicAlignment}\n` : ""}${researchSummarySection}
Write an article introduction.

${langInstructions}

## Outline
- Hook: ${outline.introduction.hook}
- Context: ${outline.introduction.context}
- Thesis: ${outline.introduction.thesis}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice} | Audience: ${brandVoice.target_audience}
- Style: ${brandVoice.sentence_style || "Clear and concise"} | Interactivity: ${brandVoice.interactivity || "Moderate"}

## Requirements
1. 150-250 words, engaging opening, explain topic value
2. Markdown format, no title heading

Output the introduction in Markdown directly.`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 500,
    });

    const markdown = response.content.trim();
    const wordCount = countWords(markdown);

    return {
      markdown,
      wordCount,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }
}
