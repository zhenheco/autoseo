import { BaseAgent } from './base-agent';
import type { StrategyInput, StrategyOutput } from '@/types/agents';

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return 'StrategyAgent';
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const titleOptions = await this.generateTitleOptions(input);

    const outline = await this.generateOutline(input, titleOptions[0]);

    const lsiKeywords = await this.generateLSIKeywords(input);

    const sectionDistribution = this.calculateWordDistribution(
      input.targetWordCount,
      outline
    );

    return {
      titleOptions,
      selectedTitle: titleOptions[0],
      outline,
      targetWordCount: input.targetWordCount,
      sectionWordDistribution: sectionDistribution,
      keywordDensityTarget: 1.5,
      relatedKeywords: input.researchData.relatedKeywords,
      lsiKeywords,
      internalLinkingStrategy: {
        targetSections: outline.mainSections.map((s) => s.heading),
        suggestedTopics: input.researchData.contentGaps.slice(0, 3),
        minLinks: 3,
      },
      differentiationStrategy: {
        uniqueAngles: input.researchData.contentGaps,
        valueProposition: input.researchData.recommendedStrategy,
        competitiveAdvantages: [
          '深入分析',
          '實用建議',
          '最新資訊',
        ],
      },
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateTitleOptions(input: StrategyInput): Promise<string[]> {
    const prompt = `你是一位 SEO 內容策略專家，請為以下關鍵字生成 3 個高效的標題選項。

關鍵字: ${input.researchData.keyword}
搜尋意圖: ${input.researchData.searchIntent}
品牌聲音: ${input.brandVoice.tone_of_voice}
目標受眾: ${input.brandVoice.target_audience}

競爭對手標題模式:
${input.researchData.topRankingFeatures.titlePatterns.join('\n')}

要求:
1. 標題需包含主關鍵字
2. 符合品牌聲音和目標受眾
3. 比競爭對手更吸引人
4. 長度控制在 50-60 字元
5. 使用數字或問句增加點擊率

請以 JSON 陣列格式回答:
["標題選項 1", "標題選項 2", "標題選項 3"]`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
    });

    return JSON.parse(response.content);
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string
  ): Promise<StrategyOutput['outline']> {
    const prompt = `你是一位 SEO 內容策略專家，請為以下文章生成詳細的大綱。

標題: ${selectedTitle}
關鍵字: ${input.researchData.keyword}
目標字數: ${input.targetWordCount}
品牌聲音: ${input.brandVoice.tone_of_voice}

競爭對手分析:
${input.researchData.competitorAnalysis
  .map(
    (c) => `
- ${c.title} (排名 ${c.position})
  優勢: ${c.strengths.join(', ')}
  弱點: ${c.weaknesses.join(', ')}
`
  )
  .join('\n')}

內容缺口:
${input.researchData.contentGaps.join('\n')}

請以 JSON 格式生成大綱:
{
  "introduction": {
    "hook": "吸引讀者的開場",
    "context": "背景資訊",
    "thesis": "主要論點",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "主要章節標題",
      "subheadings": ["子標題 1", "子標題 2"],
      "keyPoints": ["重點 1", "重點 2"],
      "targetWordCount": 500,
      "keywords": ["相關關鍵字"]
    }
  ],
  "conclusion": {
    "summary": "總結要點",
    "callToAction": "行動呼籲",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "常見問題",
      "answerOutline": "答案大綱"
    }
  ]
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
    });

    return JSON.parse(response.content);
  }

  private async generateLSIKeywords(input: StrategyInput): Promise<string[]> {
    const prompt = `請為關鍵字 "${input.researchData.keyword}" 生成 10 個 LSI（潛在語義索引）關鍵字。

這些關鍵字應該:
1. 與主關鍵字語義相關
2. 自然融入內容
3. 提升 SEO 效果

請以 JSON 陣列格式回答:
["LSI 關鍵字 1", "LSI 關鍵字 2", ...]`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: 500,
      format: 'json',
    });

    return JSON.parse(response.content);
  }

  private calculateWordDistribution(
    targetWordCount: number,
    outline: StrategyOutput['outline']
  ): StrategyOutput['sectionWordDistribution'] {
    const mainSectionsTotal = outline.mainSections.reduce(
      (sum, section) => sum + section.targetWordCount,
      0
    );

    return {
      introduction: outline.introduction.wordCount,
      mainSections: mainSectionsTotal,
      conclusion: outline.conclusion.wordCount,
      faq: Math.max(0, targetWordCount - outline.introduction.wordCount - mainSectionsTotal - outline.conclusion.wordCount),
    };
  }
}
