import { BaseAgent } from "./base-agent";
import type {
  SectionInput,
  SectionOutput,
  ContentContext,
  SpecialBlock,
} from "@/types/agents";

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
  ): string {
    if (!specialBlock) {
      return "";
    }

    const brand = brandName || "";

    switch (specialBlock.type) {
      case "expert_tip":
      case "tip_block":
        return `
## Special Block Requirement
Include a "小提醒" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 50-80 words
- Place it after explaining a key concept or technique

Example format:
> **${brand ? brand + " " : ""}小提醒**
>
> [Your practical tip here, 50-80 words]`;

      case "local_advantage":
        return `
## Special Block Requirement
Include a "本地優勢" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 80-120 words
- Highlight regional/local advantages

Example format:
> **本地優勢**
>
> [Your local advantage description here, 80-120 words]`;

      case "expert_warning":
      case "warning_block":
        return `
## Special Block Requirement
Include a "注意事項" block in this section.
- Content hint: ${specialBlock.content}
- Format: Use a blockquote
- Length: 50-80 words
- Highlight important warnings or common mistakes

Example format:
> **注意事項**
>
> [Your warning or caution here, 50-80 words]`;

      default:
        return "";
    }
  }

  get agentName(): string {
    return "SectionAgent";
  }

  protected async process(input: SectionInput): Promise<SectionOutput> {
    const {
      section,
      previousSummary,
      sectionImage,
      brandVoice,
      index,
      contentContext,
      specialBlock,
    } = input;

    const languageNames: Record<string, string> = {
      "zh-TW": "Traditional Chinese (繁體中文)",
      "zh-CN": "Simplified Chinese (简体中文)",
      en: "English",
      ja: "Japanese (日本語)",
      ko: "Korean (한국어)",
      es: "Spanish (Español)",
      fr: "French (Français)",
      de: "German (Deutsch)",
      pt: "Portuguese (Português)",
      it: "Italian (Italiano)",
      ru: "Russian (Русский)",
      ar: "Arabic (العربية)",
      th: "Thai (ไทย)",
      vi: "Vietnamese (Tiếng Việt)",
      id: "Indonesian (Bahasa Indonesia)",
    };

    const targetLang = input.targetLanguage || "zh-TW";
    const languageName = languageNames[targetLang] || languageNames["zh-TW"];

    const topicAlignmentSection =
      this.buildTopicAlignmentSection(contentContext);
    const specialBlockSection = this.buildSpecialBlockSection(
      specialBlock,
      contentContext?.brandName,
    );

    const prompt = `${topicAlignmentSection}

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
1. Word count: ${section.targetWordCount - 50} ~ ${section.targetWordCount + 50} words
2. Use Markdown format
3. Include section heading (## ${section.heading})
4. Use ### for subheadings if applicable
5. Cover all key points
6. Naturally integrate related keywords
7. Provide a brief summary at the end (for connecting to next section)
${specialBlockSection}

## Writing Style (Important!)
1. Present 2-3 different viewpoints or sources on key topics
2. Compare and contrast different perspectives where relevant
3. Provide your analysis and conclusions: use phrases like "In my analysis..." or "From a practical standpoint..." or "Based on experience..."
4. Give actionable recommendations to readers

Example structure:
- "According to [Source A]... However, [Source B] suggests..."
- "My analysis: Based on the evidence, I believe... For [audience], I recommend..."

Avoid:
- Simply listing information without analysis
- Missing "I think", "I recommend", "In conclusion" type expressions
- Purely copying data without adding personal insights

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
