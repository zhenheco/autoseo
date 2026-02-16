import { BaseAgent } from "./base-agent";
import type { ConclusionInput, ConclusionOutput } from "@/types/agents";
import {
  buildLanguageInstructions,
  buildTopicAlignment,
  countWords,
} from "./prompt-utils";
import { getConclusionStyle } from "./writing-presets";

export class ConclusionAgent extends BaseAgent<
  ConclusionInput,
  ConclusionOutput
> {
  get agentName(): string {
    return "ConclusionAgent";
  }

  protected async process(input: ConclusionInput): Promise<ConclusionOutput> {
    const { outline, brandVoice, contentContext, researchHighlights } = input;

    const targetLang = input.targetLanguage || "zh-TW";
    const langInstructions = buildLanguageInstructions(targetLang);
    const topicAlignment = buildTopicAlignment(contentContext);

    const mainPoints = outline.mainSections.map((s) => s.heading).join(", ");

    const researchHighlightsSection = researchHighlights
      ? `\n## Key Research Findings\n${researchHighlights}\n`
      : "";

    const conclusionStyleSection = getConclusionStyle(brandVoice.writing_style);

    const prompt = `${topicAlignment ? `${topicAlignment}\n` : ""}${researchHighlightsSection}
Write an article conclusion.

${langInstructions}

## Conclusion Info
- Summary: ${outline.conclusion.summary}
- Call to Action: ${outline.conclusion.callToAction}
- Article Sections: ${mainPoints}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice} | Audience: ${brandVoice.target_audience}

${conclusionStyleSection}

## Requirements
1. 100-200 words, summarize core points, clear call to action
2. Markdown format, include ## heading

Output the conclusion in Markdown directly.`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 400,
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
