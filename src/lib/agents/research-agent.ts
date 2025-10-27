import { BaseAgent } from './base-agent';
import type { ResearchInput, ResearchOutput, SERPResult } from '@/types/agents';

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  get agentName(): string {
    return 'ResearchAgent';
  }

  protected async process(input: ResearchInput): Promise<ResearchOutput> {
    const serpResults = await this.fetchSERP(input.keyword, input.region);

    const analysis = await this.analyzeSERP(serpResults, input);

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

    return JSON.parse(response.content);
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
}
