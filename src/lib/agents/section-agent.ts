import { BaseAgent } from "./base-agent";
import { jsonrepair } from "jsonrepair";
import type {
  SectionInput,
  SectionOutput,
  ContentContext,
  SpecialBlock,
  ResearchContext,
} from "@/types/agents";
import { LOCALE_FULL_NAMES } from "@/lib/i18n/locales";
import { getSpecialBlockLabel } from "@/lib/i18n/article-translations";

export class SectionAgent extends BaseAgent<SectionInput, SectionOutput> {
  private buildTopicAlignmentSection(contentContext?: ContentContext): string {
    if (!contentContext) {
      return "";
    }

    return `## ⚠️ CRITICAL: Topic Alignment Requirement

**Article Title**: ${contentContext.selectedTitle}
**PRIMARY KEYWORD**: ${contentContext.primaryKeyword}
**Search Intent**: ${contentContext.searchIntent}
**Target Audience**: ${contentContext.targetAudience}
**Topic Keywords**: ${contentContext.topicKeywords.slice(0, 5).join(", ")}
${contentContext.regionContext ? `**Region Context**: ${contentContext.regionContext}` : ""}
${contentContext.industryContext ? `**Industry Context**: ${contentContext.industryContext}` : ""}

**You MUST ensure ALL content is DIRECTLY relevant to the topic "${contentContext.primaryKeyword}".**
**Do NOT include any content that is unrelated to the main topic.**
**Every paragraph, example, and explanation must connect back to "${contentContext.primaryKeyword}".**

---`;
  }

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
    } = input;

    const targetLang = input.targetLanguage || "zh-TW";
    const languageName =
      LOCALE_FULL_NAMES[targetLang] || "Traditional Chinese (繁體中文)";

    const topicAlignmentSection =
      this.buildTopicAlignmentSection(contentContext);
    const specialBlockSection = this.buildSpecialBlockSection(
      specialBlock,
      contentContext?.brandName,
      targetLang,
    );
    const researchDataSection =
      this.buildResearchDataSection(researchContext);

    const prompt = `${topicAlignmentSection}
${researchDataSection}
Write an article section based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Section Information
- Heading: ${section.heading}
- Subheadings: ${section.subheadings.join(", ")}
- Key Points: ${section.keyPoints.join(", ")}
- Target Word Count: ${section.targetWordCount} words
- Related Keywords: ${section.keywords.join(", ")}

${previousSummary ? `## Previous Section Summary\n${previousSummary}\n\nEnsure smooth transition and coherence with the previous section.` : ""}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}
- Sentence Style: ${brandVoice.sentence_style || "Clear and concise"}
- Interactivity: ${brandVoice.interactivity || "Moderate"}

## Requirements
1. **STRICT WORD LIMIT: Each paragraph under H2 or H3 must NOT exceed 150 words/characters.** This is a hard limit. Keep every paragraph concise and focused.
2. Target total word count for this section: ${section.targetWordCount} words (but never exceed 150 words per paragraph)
3. Use Markdown format
4. Include section heading (## ${section.heading})
5. Use ### for subheadings if applicable
6. Cover all key points concisely - every sentence must add value
7. Provide a brief summary at the end (for connecting to next section)
8. **Keywords should appear naturally - do NOT force or repeat keywords. If a keyword has been mentioned once in a paragraph, do not repeat it in the same paragraph. Use synonyms or related terms instead.**
${specialBlockSection}

## AI SEO Writing Rules (CRITICAL)

1. **Answer-First Format**: Start each H2 section with a 40-80 word direct answer paragraph that concisely answers the heading's implied question. This is the most important paragraph - AI search engines extract this.

2. **Statistics with Attribution**: When citing data, ALWAYS use format:
   "According to [Source Name] ([Year]), [statistic]"
   Example: "According to Ahrefs (2025), 73% of B2B companies struggle with SEO ROI measurement"

3. **Preserve Specific Entities**: NEVER replace specific brand/tool/person names with generic terms.
   ❌ "a popular project management tool"
   ✅ "Asana, Monday.com, or ClickUp"

4. **Definitive Language**: Use declarative statements, not hedging language.
   ❌ "You might wonder what SEO involves..."
   ✅ "SEO is the practice of optimizing web content to rank higher in search results."

## Writing Style (Important!)
1. Present 2-3 different viewpoints or sources on key topics
2. Compare and contrast different perspectives where relevant
3. Provide your analysis and conclusions: use phrases like "In my analysis..." or "From a practical standpoint..." or "Based on experience..."
4. Give actionable recommendations to readers
5. **Be concise** - say what matters in fewer words, cut filler sentences

Example structure:
- "According to [Source A]... However, [Source B] suggests..."
- "My analysis: Based on the evidence, I believe... For [audience], I recommend..."

Avoid:
- Simply listing information without analysis
- Missing "I think", "I recommend", "In conclusion" type expressions
- Purely copying data without adding personal insights
- **Repeating the same keyword multiple times in one paragraph**
- **Writing more than 150 words per paragraph**
- **Replacing specific names with vague generic terms**

**CRITICAL: Write ALL content in ${languageName}**

## Output Format (JSON)
{
  "content": "Section content in Markdown (in ${languageName})",
  "summary": "Brief summary (max 50 words, in ${languageName})"
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

    const wordCount = this.countWords(markdown);

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
