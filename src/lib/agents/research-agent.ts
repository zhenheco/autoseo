import { BaseAgent } from './base-agent';
import type { ResearchInput, ResearchOutput, SERPResult, ExternalReference } from '@/types/agents';
import { getPerplexityClient } from '@/lib/perplexity/client';

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  get agentName(): string {
    return 'ResearchAgent';
  }

  protected async process(input: ResearchInput): Promise<ResearchOutput> {
    const serpResults = await this.fetchSERP(input.keyword, input.region);

    const analysis = await this.analyzeSERP(serpResults, input);

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

  private async fetchSERP(keyword: string, region?: string): Promise<SERPResult[]> {
    const serpApiKey = process.env.SERP_API_KEY;
    if (!serpApiKey) {
      console.warn('[ResearchAgent] SERP_API_KEY not configured, using mock data');
      return this.getMockSERPResults(keyword);
    }

    const params = new URLSearchParams({
      api_key: serpApiKey,
      q: keyword,
      location: region || 'Taiwan',
      hl: 'zh-tw',
      gl: 'tw',
      num: '10',
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      throw new Error(`SERP API error: ${response.statusText}`);
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    return organicResults.map((result: any, index: number) => ({
      position: index + 1,
      title: result.title || '',
      url: result.link || '',
      snippet: result.snippet || '',
      domain: new URL(result.link || 'https://example.com').hostname,
    }));
  }

  private async analyzeSERP(
    serpResults: SERPResult[],
    input: ResearchInput
  ): Promise<Omit<ResearchOutput, 'keyword' | 'region' | 'executionInfo'>> {
    const prompt = `你是一位 SEO 專家，請分析以下 SERP 結果並提供深入的競爭對手分析。

關鍵字: ${input.keyword}
地區: ${input.region || 'Taiwan'}

SERP 結果:
${serpResults
  .map(
    (r, i) => `
${i + 1}. ${r.title}
   URL: ${r.url}
   Domain: ${r.domain}
   Snippet: ${r.snippet}
`
  )
  .join('\n')}

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
      "url": "競爭對手 URL",
      "title": "標題",
      "position": 排名位置,
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
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
    });

    try {
      let content = response.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      return JSON.parse(content);
    } catch (parseError) {
      this.log('error', 'JSON parsing failed', {
        error: parseError,
        content: response.content.substring(0, 500),
      });
      throw new Error(`Failed to parse SERP analysis: ${parseError}`);
    }
  }

  private getMockSERPResults(keyword: string): SERPResult[] {
    return [
      {
        position: 1,
        title: `${keyword} - 官方文檔`,
        url: 'https://example.com/docs',
        domain: 'example.com',
        snippet: `${keyword}的完整文檔和指南`,
      },
      {
        position: 2,
        title: `了解${keyword}的核心概念`,
        url: 'https://blog.example.com/guide',
        domain: 'blog.example.com',
        snippet: `深入探討${keyword}的特性和應用`,
      },
      {
        position: 3,
        title: `${keyword}最佳實踐指南`,
        url: 'https://dev.example.com/best-practices',
        domain: 'dev.example.com',
        snippet: `學習如何正確使用${keyword}`,
      },
    ];
  }

  private async fetchExternalReferences(keyword: string): Promise<ExternalReference[]> {
    try {
      const perplexity = getPerplexityClient();

      const query = `找出關於「${keyword}」的 5 個權威來源，包括:
1. Wikipedia 或百科全書
2. 官方文檔或官網
3. 學術研究或報告
4. 知名科技新聞網站
5. 權威部落格

對於每個來源，提供: URL、標題、類型、簡短描述`;

      const result = await perplexity.search(query, {
        return_citations: true,
        max_tokens: 2000,
      });

      const references: ExternalReference[] = [];

      if (result.citations && result.citations.length > 0) {
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
