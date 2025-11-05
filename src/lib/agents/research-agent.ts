import { BaseAgent } from './base-agent';
import type { ResearchInput, ResearchOutput, SERPResult, ExternalReference } from '@/types/agents';
import { getPerplexityClient } from '@/lib/perplexity/client';

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  get agentName(): string {
    return 'ResearchAgent';
  }

  protected async process(input: ResearchInput): Promise<ResearchOutput> {
    const analysis = await this.analyzeKeyword(input);

    const externalReferences = await this.fetchExternalReferences(input.keyword);

    return {
      keyword: input.keyword,
      region: input.region,
      searchIntent: analysis.searchIntent,
      intentConfidence: analysis.intentConfidence,
      topRankingFeatures: analysis.topRankingFeatures,
      contentGaps: analysis.contentGaps,
      competitorAnalysis: analysis.competitorAnalysis,
      recommendedStrategy: analysis.recommendedStrategy,
      relatedKeywords: analysis.relatedKeywords,
      externalReferences,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async analyzeKeyword(
    input: ResearchInput
  ): Promise<Omit<ResearchOutput, 'keyword' | 'region' | 'externalReferences' | 'executionInfo'>> {
    const prompt = `你是一位 SEO 專家，請針對關鍵字「${input.keyword}」進行深入分析。

關鍵字: ${input.keyword}
地區: ${input.region || 'Taiwan'}

請提供以下分析（以 JSON 格式回答）:

{
  "searchIntent": "informational | commercial | transactional | navigational",
  "intentConfidence": 0-1 之間的數字,
  "topRankingFeatures": {
    "contentLength": {
      "min": 估計最短字數,
      "max": 估計最長字數,
      "avg": 估計平均字數
    },
    "titlePatterns": ["標題模式 1", "標題模式 2"],
    "structurePatterns": ["結構模式 1", "結構模式 2"],
    "commonTopics": ["常見主題 1", "常見主題 2"],
    "commonFormats": ["格式類型 1", "格式類型 2"]
  },
  "contentGaps": ["內容缺口 1", "內容缺口 2"],
  "competitorAnalysis": [
    {
      "url": "相關權威網站 URL",
      "title": "標題",
      "position": 1,
      "domain": "網域",
      "estimatedWordCount": 估計字數,
      "strengths": ["優勢 1", "優勢 2"],
      "weaknesses": ["弱點 1", "弱點 2"],
      "uniqueAngles": ["獨特角度 1", "獨特角度 2"]
    }
  ],
  "recommendedStrategy": "推薦的內容策略描述",
  "relatedKeywords": ["相關關鍵字 1", "相關關鍵字 2"]
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.3,
      maxTokens: input.maxTokens || 16000,
    });

    try {
      if (!response.content || response.content.trim() === '') {
        console.warn('[ResearchAgent] Empty response, using fallback analysis');
        return this.getFallbackAnalysis(input.keyword);
      }

      let content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      const parsed = JSON.parse(content);

      if (!parsed.searchIntent || !parsed.topRankingFeatures) {
        console.warn('[ResearchAgent] Incomplete analysis, using fallback');
        return this.getFallbackAnalysis(input.keyword);
      }

      return parsed;

    } catch (parseError) {
      this.log('error', 'JSON parsing failed', {
        error: parseError,
        content: response.content.substring(0, 500),
      });
      console.warn('[ResearchAgent] Parse error, using fallback analysis');
      return this.getFallbackAnalysis(input.keyword);
    }
  }

  private getFallbackAnalysis(keyword: string): Omit<ResearchOutput, 'keyword' | 'region' | 'externalReferences' | 'executionInfo'> {
    return {
      searchIntent: 'informational',
      intentConfidence: 0.7,
      topRankingFeatures: {
        contentLength: { min: 1000, max: 3000, avg: 1500 },
        titlePatterns: [`${keyword}完整指南`, `${keyword}教學`, `如何使用${keyword}`],
        structurePatterns: ['介紹', '步驟說明', '常見問題', '總結'],
        commonTopics: ['基礎概念', '實用技巧', '進階應用'],
        commonFormats: ['教學文章', '指南', '列表文章'],
      },
      contentGaps: ['缺少實際案例', '缺少詳細步驟', '缺少常見問題解答'],
      competitorAnalysis: [
        {
          url: `https://example.com/${keyword}`,
          title: `${keyword}相關內容`,
          position: 1,
          domain: 'example.com',
          estimatedWordCount: 1500,
          strengths: ['內容詳細', '結構清晰'],
          weaknesses: ['缺少視覺元素', '更新不及時'],
          uniqueAngles: ['實用技巧', '案例分析'],
        },
      ],
      recommendedStrategy: `創建全面且實用的${keyword}指南，包含基礎概念、實用技巧和案例分析`,
      relatedKeywords: [`${keyword}教學`, `${keyword}技巧`, `${keyword}入門`, `如何${keyword}`],
    };
  }

  private async fetchExternalReferences(keyword: string): Promise<ExternalReference[]> {
    try {
      const perplexity = getPerplexityClient();

      const query = `找出關於「${keyword}」最權威和最新的 5 個外部來源，要求必須包含實際可訪問的 URL。

請按以下優先順序尋找：
1. Wikipedia 或百科全書
2. 官方文檔或官網
3. 學術研究或報告
4. 知名新聞網站或媒體
5. 權威部落格或產業網站

對於每個來源，請明確列出完整的 URL 連結。`;

      console.log('[ResearchAgent] 開始 Perplexity 搜尋:', keyword);

      const result = await perplexity.search(query, {
        return_citations: true,
        max_tokens: 3000,
      });

      console.log('[ResearchAgent] Perplexity 回應:', {
        contentLength: result.content?.length || 0,
        citationsCount: result.citations?.length || 0,
        citations: result.citations,
      });

      const references: ExternalReference[] = [];

      if (result.citations && result.citations.length > 0) {
        console.log('[ResearchAgent] 處理 Perplexity citations:', result.citations);

        for (let i = 0; i < Math.min(result.citations.length, 5); i++) {
          const url = result.citations[i];
          const type = this.categorizeUrl(url);

          references.push({
            url,
            title: this.extractTitleFromUrl(url),
            type,
            description: `關於 ${keyword} 的權威來源`,
          });
        }
      }

      if (references.length === 0) {
        console.warn('[ResearchAgent] 無法從 Perplexity 獲取引用，使用預設來源');
        return this.getDefaultExternalReferences(keyword);
      }

      console.log('[ResearchAgent] 成功獲取', references.length, '個外部引用');
      return references;

    } catch (error) {
      console.error('[ResearchAgent] 獲取外部引用錯誤:', error);
      return this.getDefaultExternalReferences(keyword);
    }
  }

  private categorizeUrl(url: string): ExternalReference['type'] {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('wikipedia.org')) return 'wikipedia';
    if (lowerUrl.includes('github.com') || lowerUrl.includes('docs.') || lowerUrl.includes('/docs/')) return 'official_docs';
    if (lowerUrl.includes('arxiv.org') || lowerUrl.includes('scholar.google') || lowerUrl.includes('.edu')) return 'research';
    if (lowerUrl.includes('techcrunch.com') || lowerUrl.includes('wired.com') || lowerUrl.includes('news')) return 'news';

    return 'blog';
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);

      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        return lastPart
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\.[^.]+$/, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  private getDefaultExternalReferences(keyword: string): ExternalReference[] {
    return [
      {
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(keyword.replace(/ /g, '_'))}`,
        title: `${keyword} - Wikipedia`,
        type: 'wikipedia',
        description: `關於 ${keyword} 的百科全書資訊`,
      },
    ];
  }
}
