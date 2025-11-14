import { marked } from 'marked';
import type { ContentAssemblerInput, ContentAssemblerOutput } from '@/types/agents';

export class ContentAssemblerAgent {
  async execute(input: ContentAssemblerInput): Promise<ContentAssemblerOutput> {
    const startTime = Date.now();

    this.validateInput(input);

    const { title, introduction, sections, conclusion, qa } = input;

    const markdownParts: string[] = [];

    markdownParts.push(`# ${title}`, '');

    markdownParts.push(introduction.markdown, '');

    sections.forEach((section) => {
      markdownParts.push(section.markdown, '');
    });

    markdownParts.push(conclusion.markdown, '');

    markdownParts.push(qa.markdown, '');

    let markdown = markdownParts.join('\n');

    markdown = this.cleanupMarkdown(markdown);

    const html = await this.convertToHTML(markdown);

    const statistics = this.calculateStatistics(markdown, sections, qa);

    const executionTime = Date.now() - startTime;

    return {
      markdown,
      html,
      statistics,
      executionInfo: {
        executionTime,
      },
    };
  }

  private validateInput(input: ContentAssemblerInput): void {
    if (!input.title || input.title.trim() === '') {
      throw new Error('Title is required');
    }

    if (!input.introduction || !input.introduction.markdown) {
      throw new Error('Introduction is required');
    }

    if (!input.sections || input.sections.length === 0) {
      throw new Error('At least one section is required');
    }

    const totalWords =
      input.introduction.wordCount +
      input.sections.reduce((sum, s) => sum + s.wordCount, 0) +
      (input.conclusion?.wordCount || 0);

    if (totalWords < 800) {
      throw new Error(`Total word count (${totalWords}) is below minimum (800)`);
    }
  }

  private cleanupMarkdown(markdown: string): string {
    let cleaned = markdown;

    cleaned = cleaned.replace(/#{1,6}\s+#\s+/g, (match) => {
      return match.replace(/\s+#\s+/, ' ');
    });

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    cleaned = cleaned.trim();

    return cleaned;
  }

  private async convertToHTML(markdown: string): Promise<string> {
    try {
      const html = await marked(markdown);
      return html;
    } catch (error) {
      console.error('[ContentAssembler] Markdown to HTML conversion failed:', error);
      return markdown.replace(/\n/g, '<br>');
    }
  }

  private calculateStatistics(
    markdown: string,
    sections: ContentAssemblerInput['sections'],
    qa: ContentAssemblerInput['qa']
  ): ContentAssemblerOutput['statistics'] {
    const plainText = markdown.replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*`]/g, '').trim();

    // 計算中文字符數
    const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 計算英文單詞數（排除中文後按空格分詞）
    const nonChineseText = plainText.replace(/[\u4e00-\u9fa5]/g, '');
    const englishWords = nonChineseText.trim() ? nonChineseText.trim().split(/\s+/).length : 0;

    // 如果中文字符多，使用中文字符數；否則使用英文單詞數
    const totalWords = chineseChars > englishWords ? chineseChars : Math.max(chineseChars + englishWords, 1);

    const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim() && !p.startsWith('#'));
    const totalParagraphs = paragraphs.length;

    const totalSections = sections.length;
    const totalFAQs = qa.faqs.length;

    return {
      totalWords,
      totalParagraphs,
      totalSections,
      totalFAQs,
    };
  }
}
