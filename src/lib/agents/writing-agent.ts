import { BaseAgent } from './base-agent';
import type { WritingInput, WritingOutput } from '@/types/agents';
import { marked } from 'marked';

// 配置 marked 全局選項（使用推薦的 marked.use() 方式）
marked.use({
  async: true,
  gfm: true,
  breaks: false,
  pedantic: false,
});

export class WritingAgent extends BaseAgent<WritingInput, WritingOutput> {
  get agentName(): string {
    return 'WritingAgent';
  }

  protected async process(input: WritingInput): Promise<WritingOutput> {
    const markdown = await this.generateArticle(input);

    // 移除開頭的重複標題（H1 或 H2）
    let cleanedMarkdown = markdown;
    // 移除開頭的 H1
    cleanedMarkdown = cleanedMarkdown.replace(/^#\s+.+?\n\n?/, '');
    // 移除開頭的 H2（如果標題與文章標題相同且標題存在）
    if (input.strategy.selectedTitle) {
      const titleRegex = new RegExp(`^##\\s+${input.strategy.selectedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n\\n?`, 'm');
      cleanedMarkdown = cleanedMarkdown.replace(titleRegex, '');
    }

    // 轉換 Markdown 為 HTML（使用 marked v16+ 與全局配置）
    console.log('[WritingAgent] 📝 Converting Markdown to HTML...');
    console.log('[WritingAgent] Markdown length:', cleanedMarkdown.length);
    console.log('[WritingAgent] Markdown preview (first 300 chars):', cleanedMarkdown.substring(0, 300));

    let html: string;
    try {
      // marked.use() 已設置 async: true，parse 返回 Promise<string>
      html = await marked.parse(cleanedMarkdown);

      console.log('[WritingAgent] ✅ Markdown parsed successfully');
      console.log('[WritingAgent] HTML length:', html.length);
      console.log('[WritingAgent] HTML preview (first 300 chars):', html.substring(0, 300));
      console.log('[WritingAgent] Starts with HTML tag?:', html.trim().startsWith('<'));

      // 驗證轉換是否成功
      if (!html || html.trim().length === 0) {
        throw new Error('Marked returned empty HTML');
      }

      // 檢查是否仍然包含 Markdown 語法（可能是轉換失敗的標記）
      const markdownPatterns = ['##', '**', '```', '* ', '- '];
      const containsMarkdown = markdownPatterns.some(pattern => html.includes(pattern));
      if (containsMarkdown) {
        console.warn('[WritingAgent] ⚠️  Warning: HTML still contains potential Markdown syntax');
        console.warn('[WritingAgent] Sample:', html.substring(0, 500));
      }
    } catch (error) {
      console.error('[WritingAgent] ❌ Failed to convert Markdown to HTML');
      console.error('[WritingAgent] Error:', error instanceof Error ? error.message : String(error));
      console.error('[WritingAgent] Markdown sample that failed:', cleanedMarkdown.substring(0, 500));
      throw new Error(`Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 為表格添加樣式類別
    const styledHtml = this.addTableStyles(html);

    console.log('[WritingAgent] Styled HTML length:', styledHtml.length);
    console.log('[WritingAgent] Styled HTML preview (first 300 chars):', styledHtml.substring(0, 300));

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

# 品牌聲音配置
**請在整篇文章中貫徹以下品牌聲音設定**：
- 語調: ${brandVoice.tone_of_voice}（請在用詞、語氣、表達方式上體現此語調）
- 目標受眾: ${brandVoice.target_audience}（內容深度和表達方式要符合此受眾）
- 句子風格: ${brandVoice.sentence_style || '清晰簡潔'}（控制句子長度和複雜度）
- 互動性: ${brandVoice.interactivity || '中等'}（適當使用問句、呼籲行動等互動元素）

# 文章大綱
${this.formatOutline(strategy.outline)}

# SEO 關鍵字要求
**關鍵字密度控制**：
1. 目標字數: ${strategy.targetWordCount} 字
2. **關鍵字密度目標: ${strategy.keywordDensityTarget}% (1.8-2.2% 之間)**
3. **主要關鍵字總出現次數: 8-12 次**
4. 主要關鍵字: ${strategy.outline.mainSections.flatMap((s) => s.keywords).join(', ')}
5. LSI 關鍵字（語義相關詞）: ${strategy.lsiKeywords.join(', ')}

**關鍵字使用原則**：
- 自然融入文章，避免生硬堆砌
- 在標題、小標題、開頭段落、結尾段落中適當出現
- 使用 LSI 關鍵字增加語義豐富度
- 變化關鍵字形式（同義詞、相關詞）

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

**內部連結要求**：
- 至少融入 ${strategy.internalLinkingStrategy.minLinks} 個內部連結
- 使用自然的錨文本（避免「點擊這裡」等通用文字）
- 在內容相關的段落中加入連結
- 範例：根據[先前文章標題](/article-url)的分析，我們可以看出...

# 外部引用來源（權威性來源）
${strategy.externalReferences && strategy.externalReferences.length > 0 ? strategy.externalReferences
  .map(
    (ref) => `
- 來源: ${ref.title || ref.domain}
  URL: ${ref.url}
  摘要: ${ref.snippet || '權威來源'}
`
  )
  .join('\n') : ''}

**🔴 外部連結要求（重要）**：
- **每篇文章必須包含至少 3-5 個外部引用連結**
- 外部連結必須來自權威來源（官方網站、知名媒體、研究機構等）
- 使用自然的引用方式融入文章
- 在引用數據、統計、研究結果、專家觀點時加入外部連結
- 範例：
  * 根據[Forbes 報導](https://forbes.com/...)，市場趨勢顯示...
  * [麻省理工學院的研究](https://mit.edu/...)指出...
  * 根據[官方文件](https://docs.example.com/)說明...
- **確保每個外部連結都有明確的來源標示和上下文**

# 章節結構要求
**每個主要章節應包含**：
1. **章節引言**（50-100 字）：簡要說明本章節要討論什麼
2. **主體內容**：
   - 使用 H3 子標題組織內容
   - 適當使用清單、表格、引言區塊
   - 每個段落 3-5 句話
   - 融入關鍵字和相關概念
3. **實例或案例**：提供具體例子幫助理解
4. **小結或過渡**：總結要點並引導到下一章節

# 撰寫指南
1. **格式規範**：
   - 使用 Markdown 格式
   - **不要在文章開頭重複標題**：文章標題已經在 WordPress 自動顯示，直接從第一個章節（## 導言）開始
   - 每個主要章節使用 H2 (##)
   - 每個子章節使用 H3 (###)

2. **內容品質**：
   - 確保內容原創、有價值、有深度
   - 提供實用的資訊和建議
   - 使用具體例子和數據支持觀點
   - 避免空泛的陳述

3. **可讀性優化**：
   - 使用編號清單、項目符號增加可讀性
   - 適當使用表格整理資訊
   - 段落之間保持適當間隔
   - 使用過渡句連接段落

4. **SEO 優化**：
   - 在適當位置自然融入關鍵字
   - 使用語義相關的 LSI 關鍵字
   - 內外部連結分佈均勻
   - 標題結構清晰（H2 → H3）

5. **絕對禁止使用程式碼區塊**：
   - ❌ 不要使用 \`\`\`markdown、\`\`\`json、\`\`\`javascript 等程式碼區塊
   - ❌ 不要使用單個反引號 \` 包裹的行內程式碼
   - ✅ 如需展示範例，使用引言區塊 (>) 或格式化文字
   - ✅ 如需展示步驟，使用編號清單或項目符號

6. **FAQ 格式要求**：
   - 必須在文章結尾加入「## 常見問題」章節
   - 包含 3-5 個常見問題
   - 每個問題使用 H3 (### Q: 問題內容)
   - 每個答案以「A:」開頭，並提供詳細解答（100-150 字）

# 最終檢查清單
請確保文章包含：
✅ 品牌聲音貫徹全文
✅ 關鍵字密度在 1.8-2.2% 之間
✅ 主要關鍵字出現 8-12 次
✅ 至少 ${strategy.internalLinkingStrategy.minLinks} 個內部連結（如有可用文章）
✅ 至少 3-5 個外部引用連結
✅ 每個章節結構完整（引言、主體、小結）
✅ FAQ 章節（3-5 個問題）
✅ 無程式碼區塊
✅ Markdown 格式正確

請撰寫完整的文章（Markdown 格式），確保包含實際可點擊的內外部連結。
**重要**：
1. 直接輸出 Markdown 文字，不要使用程式碼區塊包裹（不要使用 \`\`\`markdown）
2. 直接從 ## 導言 開始，不要重複標題
3. **務必包含至少 3-5 個外部引用連結**`;

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

    if (outline.conclusion) {
      result += '## 結論\n';
      result += `- 總結: ${outline.conclusion.summary}\n`;
      result += `- 行動呼籲: ${outline.conclusion.callToAction}\n\n`;
    }

    if (outline.faq && outline.faq.length > 0) {
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
    let result = html;

    // 為表格添加 inline style，使其更美觀
    result = result.replace(
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

    // 移除程式碼區塊，轉換為引言區塊
    result = this.convertCodeBlocksToBlockquotes(result);

    return result;
  }

  private convertCodeBlocksToBlockquotes(html: string): string {
    // 處理 <pre><code> 程式碼區塊
    // 將程式碼區塊轉換為格式化的引言區塊或純文字
    return html.replace(
      /<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/g,
      (_match, code) => {
        // 解碼 HTML 實體
        const decodedCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');

        // 將程式碼轉換為格式化的引言區塊
        const lines = decodedCode.split('\n').filter((line: string) => line.trim());
        const formattedLines = lines.map((line: string) =>
          `<p style="margin: 0; padding-left: 20px; font-family: monospace; background: #f5f5f5;">${line}</p>`
        ).join('');

        return `<blockquote style="border-left: 4px solid #ddd; margin: 20px 0; padding: 10px 20px; background: #f9f9f9;">${formattedLines}</blockquote>`;
      }
    );
  }
}
