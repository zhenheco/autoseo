import { BaseAgent } from './base-agent';
import type { ConclusionInput, ConclusionOutput } from '@/types/agents';

export class ConclusionAgent extends BaseAgent<ConclusionInput, ConclusionOutput> {
  get agentName(): string {
    return 'ConclusionAgent';
  }

  protected async process(input: ConclusionInput): Promise<ConclusionOutput> {
    const { outline, brandVoice } = input;

    // Language mapping
    const languageNames: Record<string, string> = {
      'zh-TW': 'Traditional Chinese (繁體中文)',
      'zh-CN': 'Simplified Chinese (简体中文)',
      'en': 'English',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'pt': 'Portuguese (Português)',
      'it': 'Italian (Italiano)',
      'ru': 'Russian (Русский)',
      'ar': 'Arabic (العربية)',
      'th': 'Thai (ไทย)',
      'vi': 'Vietnamese (Tiếng Việt)',
      'id': 'Indonesian (Bahasa Indonesia)',
    };

    const targetLang = (input as any).targetLanguage || 'zh-TW';
    const languageName = languageNames[targetLang] || languageNames['zh-TW'];

    const mainPoints = outline.mainSections.map(s => s.heading).join(', ');

    const prompt = `Write an article conclusion based on the following information:

**Target Language: ${languageName}** (ALL content MUST be written in this language)

## Conclusion Information
- Summary: ${outline.conclusion.summary}
- Call to Action: ${outline.conclusion.callToAction}

## Main Article Sections
${mainPoints}

## Brand Voice
- Tone: ${brandVoice.tone_of_voice}
- Target Audience: ${brandVoice.target_audience}
- Sentence Style: ${brandVoice.sentence_style || 'Clear and concise'}

## Requirements
1. Word count: 100-200 words
2. Briefly summarize the article's core points
3. Provide a clear call to action or next steps
4. Tone should be positive and encouraging
5. Use Markdown format
6. Include conclusion heading (## Conclusion)

**CRITICAL: Write ALL content in ${languageName}**

## Output Format
Output the conclusion content in Markdown directly.`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 400,
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
    const plainText = text.replace(/[#*`]/g, '').trim();

    // 計算中文字符數
    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 計算英文單詞數（排除中文後按空格分詞）
    const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, '');
    const englishWords = nonChineseText.trim() ? nonChineseText.trim().split(/\s+/).length : 0;

    // 如果中文字符多，使用中文字符數；否則使用英文單詞數
    return chineseChars > englishWords ? chineseChars : Math.max(chineseChars + englishWords, 1);
  }
}
