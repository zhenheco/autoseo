import { BaseAgent } from './base-agent';
import type { WritingInput, WritingOutput } from '@/types/agents';
import { marked } from 'marked';

export class WritingAgent extends BaseAgent<WritingInput, WritingOutput> {
  get agentName(): string {
    return 'WritingAgent';
  }

  protected async process(input: WritingInput): Promise<WritingOutput> {
    const markdown = await this.generateArticle(input);

    // 移除第一個 H1 標題（WordPress 會自動顯示文章標題）
    const markdownWithoutH1 = markdown.replace(/^#\s+.+?\n\n?/, '');

    const html = await marked(markdownWithoutH1);

    // 為表格添加樣式類別
    const styledHtml = this.addTableStyles(html);

    const statistics = this.calculateStatistics(markdown);

    const internalLinks = this.extractInternalLinks(styledHtml, input.previousArticles);

    const keywordUsage = this.analyzeKeywordUsage(
      markdown,
      input.strategy.outline
    );

    const readability = this.calculateReadability(markdown);

    return {
      markdown,
      html: styledHtml,
      statistics,
      internalLinks,
      keywordUsage,
      readability,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateArticle(input: WritingInput): Promise<string> {
    const { strategy, brandVoice, previousArticles } = input;

    const prompt = `你是一位專業的 SEO 內容作家，請根據以下策略撰寫完整的文章。直接輸出 Markdown 格式的文章內容，不要使用程式碼區塊包裹。

# 文章標題
${strategy.selectedTitle}

# 品牌聲音
- 語調: ${brandVoice.tone_of_voice}
- 目標受眾: ${brandVoice.target_audience}
- 句子風格: ${brandVoice.sentence_style || '清晰簡潔'}
- 互動性: ${brandVoice.interactivity || '中等'}

# 文章大綱
${this.formatOutline(strategy.outline)}

# 內容要求
1. 目標字數: ${strategy.targetWordCount} 字
2. 關鍵字密度: ${strategy.keywordDensityTarget}%
3. 主要關鍵字: ${strategy.outline.mainSections.flatMap((s) => s.keywords).join(', ')}
4. LSI 關鍵字: ${strategy.lsiKeywords.join(', ')}

# 內部連結機會
${previousArticles.length > 0 ? previousArticles
  .map(
    (a) => `
- [${a.title}](${a.url})
  關鍵字: ${a.keywords.join(', ')}
  摘要: ${a.excerpt}
`
  )
  .join('\n') : '（暫無內部文章可連結）'}

# 外部引用來源
${strategy.externalReferences && strategy.externalReferences.length > 0 ? strategy.externalReferences
  .map(
    (ref) => `
- 來源: ${ref.title || ref.domain}
  URL: ${ref.url}
  摘要: ${ref.snippet || '權威來源'}
`
  )
  .join('\n') : ''}

# 撰寫指南
1. 使用 Markdown 格式
2. 每個主要章節使用 H2 (##)
3. 每個子章節使用 H3 (###)
4. **重要**：必須在文章中自然地加入外部引用連結，格式如：[來源標題](完整URL)
5. 如果有內部文章，請融入至少 ${strategy.internalLinkingStrategy.minLinks} 個內部連結
6. 外部連結應該作為引用來源，增加文章可信度
7. 使用清單、表格等增加可讀性
8. 確保內容原創且有價值
9. 符合品牌聲音和風格
10. **連結範例**：
    - 內部連結：根據[先前文章標題](/article-url)的分析...
    - 外部連結：根據[UDN報導](https://blog.udn.com/...)的研究顯示...

請撰寫完整的文章（Markdown 格式），確保包含實際可點擊的內外部連結。
**重要**：直接輸出 Markdown 文字，不要使用程式碼區塊包裹（不要使用 \`\`\`markdown），直接從 ## 標題開始。`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    // 移除可能存在的程式碼區塊包裹
    let content = response.content.trim();
    if (content.startsWith('```markdown')) {
      content = content.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    return content;
  }

  private formatOutline(outline: WritingInput['strategy']['outline']): string {
    let result = '## 導言\n';
    result += `- 開場: ${outline.introduction.hook}\n`;
    result += `- 背景: ${outline.introduction.context}\n`;
    result += `- 主旨: ${outline.introduction.thesis}\n\n`;

    outline.mainSections.forEach((section) => {
      result += `## ${section.heading}\n`;
      section.subheadings.forEach((sub) => {
        result += `### ${sub}\n`;
      });
      result += `重點: ${section.keyPoints.join(', ')}\n`;
      result += `字數: ${section.targetWordCount}\n\n`;
    });

    result += '## 結論\n';
    result += `- 總結: ${outline.conclusion.summary}\n`;
    result += `- 行動呼籲: ${outline.conclusion.callToAction}\n\n`;

    if (outline.faq.length > 0) {
      result += '## 常見問題\n';
      outline.faq.forEach((faq) => {
        result += `### ${faq.question}\n`;
        result += `${faq.answerOutline}\n\n`;
      });
    }

    return result;
  }

  private calculateStatistics(markdown: string): WritingOutput['statistics'] {
    const text = markdown.replace(/[#*\[\]`]/g, '');
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const sentences = text.split(/[。！？.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.replace(/\s+/g, '');

    return {
      wordCount: words.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      readingTime: Math.ceil(words.length / 400),
      averageSentenceLength: words.length / sentences.length,
    };
  }

  private extractInternalLinks(
    html: string,
    previousArticles: WritingInput['previousArticles']
  ): WritingOutput['internalLinks'] {
    const links: WritingOutput['internalLinks'] = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const anchor = match[2];

      const article = previousArticles.find((a) => a.url === url);
      if (article) {
        links.push({
          anchor,
          url,
          section: '',
          articleId: article.id,
        });
      }
    }

    return links;
  }

  private analyzeKeywordUsage(
    markdown: string,
    outline: WritingInput['strategy']['outline']
  ): WritingOutput['keywordUsage'] {
    const text = markdown.toLowerCase();
    const keywords = outline.mainSections.flatMap((s) => s.keywords);

    let totalCount = 0;
    keywords.forEach((keyword) => {
      const count = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      totalCount += count;
    });

    const wordCount = markdown.replace(/\s+/g, '').length;
    const density = (totalCount / wordCount) * 100;

    return {
      count: totalCount,
      density,
      distribution: outline.mainSections.map((section) => ({
        section: section.heading,
        count: 0,
      })),
    };
  }

  private calculateReadability(markdown: string): WritingOutput['readability'] {
    const text = markdown.replace(/[#*\[\]`]/g, '');
    const sentences = text.split(/[。！？.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.replace(/\s+/g, '');
    const syllables = words.length * 1.5;

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const fleschKincaidGrade =
      0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    const fleschReadingEase =
      206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

    const gunningFogIndex = 0.4 * (avgSentenceLength + 100 * (syllables / words.length));

    return {
      fleschKincaidGrade: Math.max(0, fleschKincaidGrade),
      fleschReadingEase: Math.max(0, Math.min(100, fleschReadingEase)),
      gunningFogIndex: Math.max(0, gunningFogIndex),
    };
  }

  private addTableStyles(html: string): string {
    // 為表格添加 inline style，使其更美觀
    return html.replace(
      /<table>/g,
      '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">'
    ).replace(
      /<th>/g,
      '<th style="border: 1px solid #ddd; padding: 12px 15px; text-align: left; background-color: #f8f9fa; font-weight: 600;">'
    ).replace(
      /<td>/g,
      '<td style="border: 1px solid #ddd; padding: 12px 15px; text-align: left;">'
    ).replace(
      /<tr>/g,
      '<tr style="border-bottom: 1px solid #ddd;">'
    );
  }
}
