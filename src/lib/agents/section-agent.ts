import { BaseAgent } from "./base-agent";
import type { SectionInput, SectionOutput } from "@/types/agents";

export class SectionAgent extends BaseAgent<SectionInput, SectionOutput> {
  get agentName(): string {
    return "SectionAgent";
  }

  protected async process(input: SectionInput): Promise<SectionOutput> {
    const { section, previousSummary, sectionImage, brandVoice, index } = input;

    // Language mapping
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

    const targetLang = (input as any).targetLanguage || "zh-TW";
    const languageName = languageNames[targetLang] || languageNames["zh-TW"];

    const prompt = `Write an article section based on the following information:

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
${sectionImage ? `7. Insert image at appropriate position: ![${sectionImage.altText || section.heading}](${sectionImage.url})` : ""}
8. Provide a brief summary at the end (for connecting to next section)

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

    if (sectionImage && !markdown.includes("![")) {
      const lines = markdown.split("\n");
      const insertIndex = Math.floor(lines.length / 2);
      lines.splice(
        insertIndex,
        0,
        "",
        `![${sectionImage.altText || section.heading}](${sectionImage.url})`,
        "",
      );
      markdown = lines.join("\n");
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
