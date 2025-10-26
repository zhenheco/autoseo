import { BaseAgent } from './base-agent';
import type { WritingInput, WritingOutput } from '@/types/agents';
import { marked } from 'marked';

export class WritingAgent extends BaseAgent<WritingInput, WritingOutput> {
  get agentName(): string {
    return 'WritingAgent';
  }

  protected async process(input: WritingInput): Promise<WritingOutput> {
    const markdown = await this.generateArticle(input);

    const html = await marked(markdown);

    const statistics = this.calculateStatistics(markdown);

    const internalLinks = this.extractInternalLinks(html, input.previousArticles);

    const keywordUsage = this.analyzeKeywordUsage(
      markdown,
      input.strategy.outline
    );

    const readability = this.calculateReadability(markdown);

    return {
      markdown,
      html,
      statistics,
      internalLinks,
      keywordUsage,
      readability,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateArticle(input: WritingInput): Promise<string> {
    const { strategy, brandVoice, previousArticles } = input;

    const prompt = `你是一位專業的 SEO 內容作家，請根據以下策略撰寫完整的文章。

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
${previousArticles
  .map(
    (a) => `
- [${a.title}](${a.url})
  關鍵字: ${a.keywords.join(', ')}
  摘要: ${a.excerpt}
`
  )
  .join('\n')}

# 撰寫指南
1. 使用 Markdown 格式
2. 每個主要章節使用 H2 (##)
3. 每個子章節使用 H3 (###)
4. 自然地融入內部連結（至少 ${strategy.internalLinkingStrategy.minLinks} 個）
5. 使用清單、表格等增加可讀性
6. 確保內容原創且有價值
7. 符合品牌聲音和風格

請撰寫完整的文章（Markdown 格式）:`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    return response.content;
  }

  private formatOutline(outline: WritingInput['strategy']['outline']): string {
    let result = '## 導言\n';
    result += `- 開場: ${outline.introduction.hook}\n`;
    result += `- 背景: ${outline.introduction.context}\n`;
    result += `- 主旨: ${outline.introduction.thesis}\n\n`;

    outline.mainSections.forEach((section, i) => {
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
}
