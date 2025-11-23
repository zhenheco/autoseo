import { marked } from 'marked';
import type {
  WritingAgentOutput,
  ContentAssemblerOutput,
  StrategyOutput,
  ArticleStatistics,
  ReadabilityMetrics,
  KeywordUsage,
  InternalLink,
  Outline
} from '@/types/agents';

interface AdapterStrategyInput {
  selectedTitle: string;
  outline: Outline;
  keywords?: string[];
  targetSections?: string[];
  competitorAnalysis?: unknown[];
  contentGaps?: string[];
}

/**
 * Multi-Agent Output Adapter
 * 將 ContentAssemblerAgent 的輸出轉換為 WritingAgent 期望的格式
 */
export class MultiAgentOutputAdapter {
  /**
   * 轉換 ContentAssembler 輸出為 WritingAgent 格式
   */
  adapt(input: {
    assemblerOutput: ContentAssemblerOutput;
    strategyOutput: AdapterStrategyInput;
    focusKeyword: string;
  }): WritingAgentOutput {
    const { assemblerOutput, strategyOutput, focusKeyword } = input;

    let html = assemblerOutput.html;
    const markdown = assemblerOutput.markdown;

    if (!this.validateHTML(html)) {
      console.warn('[OutputAdapter] ⚠️  HTML validation failed, attempting re-conversion...');

      try {
        html = marked.parse(markdown) as string;

        if (!this.validateHTML(html)) {
          console.error('[OutputAdapter] ❌ Re-conversion failed validation, using original HTML anyway');
          html = assemblerOutput.html;
        } else {
          console.log('[OutputAdapter] ✅ Re-conversion successful');
        }
      } catch (error) {
        console.error('[OutputAdapter] ❌ Re-conversion error:', error);
        html = assemblerOutput.html;
      }
    } else {
      console.log('[OutputAdapter] ✅ HTML validation passed');
    }

    return {
      markdown,
      html,
      statistics: assemblerOutput.statistics,

      // 計算可讀性指標
      readability: this.calculateReadability(markdown),

      // 計算關鍵字使用情況
      keywordUsage: this.analyzeKeywordUsage(markdown, focusKeyword),

      // 擷取內部連結
      internalLinks: this.extractInternalLinks(html),
    };
  }

  /**
   * 驗證 HTML 有效性
   */
  private validateHTML(html: string): boolean {
    if (!html || html.trim().length === 0) {
      console.warn('[OutputAdapter] Validation failed: Empty HTML');
      return false;
    }

    if (!html.includes('<') || !html.includes('>')) {
      console.warn('[OutputAdapter] Validation failed: No HTML tags found');
      return false;
    }

    const markdownPatterns = ['##', '**', '```'];
    if (markdownPatterns.some(p => html.includes(p))) {
      console.warn('[OutputAdapter] Validation failed: Markdown syntax detected', {
        sample: html.substring(0, 200)
      });
      return false;
    }

    return true;
  }

  /**
   * 計算可讀性指標
   */
  private calculateReadability(markdown: string): ReadabilityMetrics {
    const text = markdown
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => {
      return count + this.countSyllables(word);
    }, 0);

    const sentenceCount = Math.max(sentences.length, 1);
    const wordCount = Math.max(words.length, 1);
    const syllableCount = Math.max(syllables, 1);

    // Flesch Reading Ease Score
    const fleschScore = Math.max(
      0,
      Math.min(
        100,
        206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount)
      )
    );

    // Flesch-Kincaid Grade Level
    const fleschKincaidGrade = Math.max(
      0,
      0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59
    );

    // Gunning Fog Index
    const complexWords = words.filter(word => this.countSyllables(word) >= 3).length;
    const gunningFog = 0.4 * ((wordCount / sentenceCount) + 100 * (complexWords / wordCount));

    return {
      fleschReadingEase: Math.round(fleschScore),
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      gunningFog: Math.round(gunningFog * 10) / 10,
      averageSentenceLength: Math.round(wordCount / sentenceCount),
      averageWordLength: Math.round((text.length - words.length + 1) / wordCount * 10) / 10,
    };
  }

  /**
   * 計算音節數
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    let count = 0;
    const vowels = 'aeiouy';
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // 調整規則
    if (word.endsWith('e')) {
      count--;
    }
    if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) {
      count++;
    }
    if (count === 0) {
      count = 1;
    }

    return count;
  }

  /**
   * 分析關鍵字使用情況
   */
  private analyzeKeywordUsage(markdown: string, focusKeyword: string): KeywordUsage {
    const text = markdown.toLowerCase();
    const keyword = focusKeyword.toLowerCase();

    // 計算關鍵字出現次數
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex) || [];
    const count = matches.length;

    // 計算總字數
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;

    // 計算密度
    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

    // 分析位置分佈
    const positions: string[] = [];

    // 檢查標題
    const titleRegex = new RegExp(`^#\\s+.*${keyword}.*$`, 'mi');
    if (titleRegex.test(markdown)) {
      positions.push('title');
    }

    // 檢查副標題
    const headingRegex = new RegExp(`^##\\s+.*${keyword}.*$`, 'gmi');
    if (headingRegex.test(markdown)) {
      positions.push('headings');
    }

    // 檢查第一段
    const paragraphs = markdown.split('\n\n').filter(p => p.trim() && !p.startsWith('#'));
    if (paragraphs.length > 0 && paragraphs[0].toLowerCase().includes(keyword)) {
      positions.push('firstParagraph');
    }

    // 檢查最後一段
    if (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].toLowerCase().includes(keyword)) {
      positions.push('lastParagraph');
    }

    return {
      keyword: focusKeyword,
      count,
      density: Math.round(density * 100) / 100,
      positions,
      inTitle: positions.includes('title'),
      inHeadings: positions.includes('headings'),
      inFirstParagraph: positions.includes('firstParagraph'),
      inLastParagraph: positions.includes('lastParagraph'),
    };
  }

  /**
   * 從 HTML 擷取內部連結
   */
  private extractInternalLinks(html: string): InternalLink[] {
    const links: InternalLink[] = [];

    // 使用正則表達式匹配所有 <a> 標籤
    const linkRegex = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>([^<]+)<\/a>/gi;

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const anchor = match[2];

      // Extract title attribute separately
      const fullTag = html.substring(html.lastIndexOf('<a', linkRegex.lastIndex - 1), linkRegex.lastIndex);
      const titleMatch = fullTag.match(/title=["']([^"']+)["']/);
      const title = titleMatch ? titleMatch[1] : '';

      // 判斷是否為內部連結（以 / 或 # 開頭，或不包含 http(s)://）
      const isInternal = url.startsWith('/') ||
                        url.startsWith('#') ||
                        (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//'));

      if (isInternal) {
        links.push({
          url,
          anchor,
          title: title || anchor,
          isInternal: true,
        });
      }
    }

    return links;
  }
}