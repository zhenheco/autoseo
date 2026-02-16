import { BaseAgent } from "./base-agent";
import { jsonrepair } from "jsonrepair";
import type {
  SectionInput,
  SectionOutput,
  SpecialBlock,
  ResearchContext,
} from "@/types/agents";
import { getSpecialBlockLabel } from "@/lib/i18n/article-translations";
import {
  buildLanguageInstructions,
  buildTopicAlignment,
  countWords,
} from "./prompt-utils";
import {
  getWritingRules,
  getStyleConsistencyCheck,
  buildMaterialsInjection,
} from "./writing-presets";

export class SectionAgent extends BaseAgent<SectionInput, SectionOutput> {
  private buildSpecialBlockSection(
    specialBlock?: SpecialBlock,
    brandName?: string,
    targetLanguage?: string,
  ): string {
    if (!specialBlock) {
      return "";
    }

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
- Place it after explaining a key concept or technique

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
- Highlight regional/local advantages

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
- Highlight important warnings or common mistakes

Example format:
> **${warningLabel}**
>
> [Your warning or caution here, 50-80 words]`;
      }

      default:
        return "";
    }
  }

  get agentName(): string {
    return "SectionAgent";
  }

  private buildResearchDataSection(researchContext?: ResearchContext): string {
    if (!researchContext || !researchContext.relevantData) {
      return "";
    }

    let section = `\n## Research Data for This Section (USE THIS DATA)\n`;
    section += `${researchContext.relevantData}\n`;

    if (researchContext.statistics.length > 0) {
      section += `\n**Available Statistics:**\n`;
      researchContext.statistics.forEach((stat) => {
        section += `- ${stat}\n`;
      });
    }

    if (researchContext.citations.length > 0) {
      section += `\n**Citation Sources:**\n`;
      researchContext.citations.slice(0, 5).forEach((url) => {
        section += `- ${url}\n`;
      });
    }

    section += `\n**IMPORTANT: Incorporate the above research data naturally into your writing. Cite statistics with attribution.**\n`;
    return section;
  }

  protected async process(input: SectionInput): Promise<SectionOutput> {
    const {
      section,
      previousSummary,
      brandVoice,
      contentContext,
      specialBlock,
      researchContext,
      sectionMaterials,
    } = input;

    const targetLang = input.targetLanguage || "zh-TW";

    const topicAlignmentSection = buildTopicAlignment(contentContext);
    const specialBlockSection = this.buildSpecialBlockSection(
      specialBlock,
      contentContext?.brandName,
      targetLang,
    );
    const researchDataSection = this.buildResearchDataSection(researchContext);
    const writingRules = getWritingRules(brandVoice.writing_style);
    const styleConsistency = getStyleConsistencyCheck(brandVoice.writing_style);
    const materialsSection = buildMaterialsInjection(
      section.heading,
      sectionMaterials,
    );

    const langInstructions = buildLanguageInstructions(targetLang);

    const prompt = `${topicAlignmentSection ? `${topicAlignmentSection}\n` : ""}${researchDataSection}
Write an article section.

${langInstructions}

## Section Information
- Heading: ${section.heading}
- Subheadings: ${section.subheadings.join(", ")}
- Key Points: ${section.keyPoints.join(", ")}
- Target Word Count: ${section.targetWordCount} words
- Keywords: ${section.keywords.join(", ")}

${previousSummary ? `## Previous Section Summary\n${previousSummary}\n` : ""}
## Brand Voice
- Tone: ${brandVoice.tone_of_voice} | Audience: ${brandVoice.target_audience}
- Style: ${brandVoice.sentence_style || "Clear and concise"} | Interactivity: ${brandVoice.interactivity || "Moderate"}
${specialBlockSection}

${materialsSection}

${writingRules}

${styleConsistency}

## Output Format
- Markdown format, ## for heading, ### for subheadings, brief summary at the end

## Output Format (JSON)
{
  "content": "Section content in Markdown",
  "summary": "Brief summary (max 50 words)"
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || Math.max(section.targetWordCount * 2, 1000),
      format: "json",
    });

    let markdown = "";
    let summary = "";
    const content = response.content;

    try {
      // 使用 jsonrepair 修復可能截斷或格式錯誤的 JSON
      const repaired = jsonrepair(content);
      const parsed = JSON.parse(repaired);
      markdown = parsed.content || content;
      summary = parsed.summary || this.generateSummary(markdown);
    } catch (repairError) {
      console.warn(
        "[SectionAgent] ⚠️ JSON 修復失敗，使用 fallback 提取",
        repairError,
      );

      // Fallback：嘗試提取 content 欄位的內容
      const contentMatch = content.match(
        /"content"\s*:\s*"([\s\S]*?)(?=",\s*"|"\s*}|$)/,
      );
      if (contentMatch) {
        markdown = contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
        summary = this.generateSummary(markdown);
      } else {
        // 最終 fallback：清理 JSON 結構後使用原始內容
        console.warn("[SectionAgent] 使用原始內容作為 markdown");
        markdown = content
          .replace(/^\s*\{\s*"content"\s*:\s*"?/g, "")
          .replace(/"?\s*,?\s*"summary"\s*:[\s\S]*$/g, "")
          .replace(/\\n/g, "\n");
        summary = this.generateSummary(markdown);
      }
    }

    const wordCount = countWords(markdown);

    return {
      markdown,
      summary,
      wordCount,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private generateSummary(markdown: string): string {
    const plainText = markdown
      .replace(/[#*`]/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "");
    const sentences = plainText.split(/[。！？\n]/).filter((s) => s.trim());
    return sentences.slice(0, 2).join("。") + "。";
  }
}
