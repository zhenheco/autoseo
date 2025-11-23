import { marked } from 'marked';
import type { ContentAssemblerInput, ContentAssemblerOutput } from '@/types/agents';

// 配置 marked 全局選項（與 WritingAgent 保持一致）
marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

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
    console.log('[ContentAssembler] 📝 Converting Markdown to HTML...');
    console.log('[ContentAssembler] Markdown length:', markdown.length);
    console.log('[ContentAssembler] Markdown preview (first 300 chars):', markdown.substring(0, 300));

    try {
      const html = await marked.parse(markdown);

      console.log('[ContentAssembler] ✅ Markdown parsed successfully');
      console.log('[ContentAssembler] HTML length:', html.length);
      console.log('[ContentAssembler] HTML preview (first 300 chars):', html.substring(0, 300));

      if (!this.isValidHTML(html, markdown)) {
        throw new Error('HTML validation failed after conversion');
      }

      console.log('[ContentAssembler] ✅ HTML validation passed', {
        markdownLength: markdown.length,
        htmlLength: html.length,
        ratio: (html.length / markdown.length).toFixed(2),
      });

      return html;
    } catch (error) {
      console.error('[ContentAssembler] ❌ Primary conversion failed:', {
        error: error instanceof Error ? error.message : String(error),
        markdownSample: markdown.substring(0, 500),
      });

      console.warn('[ContentAssembler] 🔄 Attempting fallback conversion...');

      try {
        const fallbackHtml = await this.fallbackConversion(markdown);

        if (!this.isValidHTML(fallbackHtml, markdown)) {
          throw new Error('Fallback HTML validation failed');
        }

        console.warn('[ContentAssembler] ⚠️  Fallback conversion succeeded', {
          method: 'basicMarkdownToHTML',
          htmlLength: fallbackHtml.length,
        });

        return fallbackHtml;
      } catch (fallbackError) {
        console.error('[ContentAssembler] ❌ All conversion methods failed', {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          markdownLength: markdown.length,
        });

        throw new Error(`Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private isValidHTML(html: string, markdown: string): boolean {
    if (!html || html.trim().length === 0) {
      console.warn('[Validator] Empty HTML content');
      return false;
    }

    if (!html.includes('<') || !html.includes('>')) {
      console.warn('[Validator] No HTML tags found');
      return false;
    }

    const markdownPatterns = ['##', '**', '```', '* ', '- ', '1. '];
    const hasMarkdown = markdownPatterns.some(p => html.includes(p));
    if (hasMarkdown) {
      console.warn('[Validator] Markdown syntax detected in HTML', {
        htmlSample: html.substring(0, 200),
      });
      return false;
    }

    const ratio = html.length / markdown.length;
    if (ratio < 1.05) {
      console.warn('[Validator] HTML not significantly longer than markdown', {
        ratio: ratio.toFixed(2),
        markdownLength: markdown.length,
        htmlLength: html.length,
      });
      return false;
    }

    const structuralTags = ['<p>', '<h1>', '<h2>', '<h3>', '<ul>', '<ol>'];
    const hasStructure = structuralTags.some(tag => html.includes(tag));
    if (!hasStructure) {
      console.warn('[Validator] No structural HTML tags found');
      return false;
    }

    return true;
  }

  private async fallbackConversion(markdown: string): Promise<string> {
    console.log('[ContentAssembler] Attempting basic Markdown to HTML conversion...');

    let html = markdown;

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*<\/li>)/gim, '<ul>$1</ul>');

    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    html = html.replace(/<p><h/g, '<h');
    html = html.replace(/<\/h([1-6])><\/p>/g, '</h$1>');
    html = html.replace(/<p><ul>/g, '<ul>');
    html = html.replace(/<\/ul><\/p>/g, '</ul>');

    return html;
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
