import { BaseAgent } from './base-agent';
import type { ConclusionInput, ConclusionOutput } from '@/types/agents';

export class ConclusionAgent extends BaseAgent<ConclusionInput, ConclusionOutput> {
  get agentName(): string {
    return 'ConclusionAgent';
  }

  protected async process(input: ConclusionInput): Promise<ConclusionOutput> {
    const { outline, brandVoice } = input;

    const mainPoints = outline.mainSections.map(s => s.heading).join('、');

    const prompt = `撰寫文章結論，根據以下資訊：

## 結論資訊
- 重點總結：${outline.conclusion.summary}
- 行動呼籲：${outline.conclusion.callToAction}

## 文章主要段落
${mainPoints}

## 品牌語調
- 語調：${brandVoice.tone_of_voice}
- 目標受眾：${brandVoice.target_audience}
- 句子風格：${brandVoice.sentence_style || '清晰簡潔'}

## 要求
1. 字數：100-200 字
2. 簡要總結文章核心要點
3. 提供明確的行動呼籲或下一步建議
4. 語調積極、鼓勵讀者
5. 使用 Markdown 格式
6. 包含結論標題（## 結論）

## 輸出格式
直接輸出結論內容的 Markdown。`;

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
    const plainText = text.replace(/[#*`]/g, '');
    return plainText.trim().split(/\s+/).length;
  }
}
