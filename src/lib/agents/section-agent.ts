import { BaseAgent } from './base-agent';
import type { SectionInput, SectionOutput } from '@/types/agents';

export class SectionAgent extends BaseAgent<SectionInput, SectionOutput> {
  get agentName(): string {
    return 'SectionAgent';
  }

  protected async process(input: SectionInput): Promise<SectionOutput> {
    const { section, previousSummary, sectionImage, brandVoice, index } = input;

    const prompt = `撰寫文章段落，根據以下資訊：

## 段落資訊
- 標題：${section.heading}
- 子標題：${section.subheadings.join('、')}
- 關鍵重點：${section.keyPoints.join('、')}
- 目標字數：${section.targetWordCount} 字
- 相關關鍵字：${section.keywords.join('、')}

${previousSummary ? `## 前一段落摘要\n${previousSummary}\n\n請確保與前一段落內容連貫，適當使用過渡句。` : ''}

## 品牌語調
- 語調：${brandVoice.tone_of_voice}
- 目標受眾：${brandVoice.target_audience}
- 句子風格：${brandVoice.sentence_style || '清晰簡潔'}

## 要求
1. 字數：${section.targetWordCount - 50} ~ ${section.targetWordCount + 50} 字
2. 使用 Markdown 格式
3. 包含段落標題（## ${section.heading}）
4. 如果有子標題，使用 ### 三級標題
5. 必須涵蓋所有關鍵重點
6. 自然融入相關關鍵字
${sectionImage ? `7. 在適當位置插入圖片：![${sectionImage.alt || section.heading}](${sectionImage.url})` : ''}
8. 段落結尾提供一個簡短摘要（用於連接下一段落）

## 輸出格式（JSON）
{
  "content": "段落內容的 Markdown",
  "summary": "本段落的簡短摘要（50字以內）"
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.7,
      maxTokens: input.maxTokens || Math.max(section.targetWordCount * 2, 1000),
      format: 'json',
    });

    let markdown = '';
    let summary = '';

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

    if (sectionImage && !markdown.includes('![')) {
      const lines = markdown.split('\n');
      const insertIndex = Math.floor(lines.length / 2);
      lines.splice(insertIndex, 0, '', `![${sectionImage.alt || section.heading}](${sectionImage.url})`, '');
      markdown = lines.join('\n');
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
    const plainText = markdown.replace(/[#*`]/g, '').replace(/!\[.*?\]\(.*?\)/g, '');
    const sentences = plainText.split(/[。！？\n]/).filter(s => s.trim());
    return sentences.slice(0, 2).join('。') + '。';
  }

  private countWords(text: string): number {
    const plainText = text.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`]/g, '');
    return plainText.trim().split(/\s+/).length;
  }
}
