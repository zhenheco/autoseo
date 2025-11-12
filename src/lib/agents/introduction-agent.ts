import { BaseAgent } from './base-agent';
import type { IntroductionInput, IntroductionOutput } from '@/types/agents';

export class IntroductionAgent extends BaseAgent<IntroductionInput, IntroductionOutput> {
  get agentName(): string {
    return 'IntroductionAgent';
  }

  protected async process(input: IntroductionInput): Promise<IntroductionOutput> {
    const { outline, featuredImage, brandVoice } = input;

    const prompt = `撰寫文章前言，根據以下資訊：

## 大綱資訊
- 開場鉤子：${outline.introduction.hook}
- 背景說明：${outline.introduction.context}
- 核心論點：${outline.introduction.thesis}

## 品牌語調
- 語調：${brandVoice.tone_of_voice}
- 目標受眾：${brandVoice.target_audience}
- 句子風格：${brandVoice.sentence_style || '清晰簡潔'}
- 互動性：${brandVoice.interactivity || '適中'}

## 要求
1. 字數：150-250 字
2. 必須包含吸引讀者的開場
3. 清楚說明文章主題和讀者能獲得的價值
4. 語調符合品牌風格
5. 使用 Markdown 格式
${featuredImage ? `6. 在前言開頭插入主圖：![${featuredImage.alt || '文章主圖'}](${featuredImage.url})` : ''}

## 輸出格式
直接輸出前言內容的 Markdown，不要包含標題。`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || 500,
    });

    let markdown = response.content.trim();

    if (featuredImage && !markdown.includes('![')) {
      markdown = `![${featuredImage.alt || '文章主圖'}](${featuredImage.url})\n\n${markdown}`;
    }

    const wordCount = this.countWords(markdown);

    return {
      markdown,
      wordCount,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private countWords(text: string): number {
    const plainText = text.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`]/g, '');
    return plainText.trim().split(/\s+/).length;
  }
}
