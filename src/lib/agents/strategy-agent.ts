import { BaseAgent } from './base-agent';
import type { StrategyInput, StrategyOutput } from '@/types/agents';

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return 'StrategyAgent';
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const titleOptions = await this.generateTitleOptions(input);

    const outline = await this.generateOutline(input, titleOptions[0]);

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
      keywords: input.researchData.relatedKeywords || [],
      relatedKeywords: input.researchData.relatedKeywords,
      lsiKeywords: input.researchData.relatedKeywords.slice(0, 5),
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
      externalReferences: input.researchData.externalReferences,
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

    let titleOptions;
    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        titleOptions = JSON.parse(jsonMatch[0]);
      } else {
        titleOptions = JSON.parse(response.content);
      }
    } catch (error) {
      console.error('[StrategyAgent] Title options JSON parse error:', error);
      console.error('[StrategyAgent] Response content:', response.content);
      throw new Error(`Failed to parse title options: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return titleOptions;
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

請以 JSON 格式生成大綱。**極度重要**：
1. keyPoints 每個**最多 30 字**，只寫核心重點
2. keywords 每個 section **最多 3 個**關鍵字
3. faq **最多 2 個**問題，answerOutline 每個**最多 30 字**
4. 所有文字務必精簡，避免冗長說明

JSON 格式範例:
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
      "keyPoints": ["簡短重點1", "簡短重點2"],
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
      "answerOutline": "簡短答案大綱"
    }
  ]
}`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      format: 'json',
    });

    let outline;
    try {
      let content = response.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      let jsonStr = content;

      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      if (!jsonStr.endsWith('}')) {
        const lastValidBrace = jsonStr.lastIndexOf('}');
        const lastValidBracket = jsonStr.lastIndexOf(']');
        const lastValid = Math.max(lastValidBrace, lastValidBracket);

        if (lastValid > 0) {
          jsonStr = jsonStr.substring(0, lastValid + 1);
        }
      }

      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;

      if (openBrackets > closeBrackets) {
        jsonStr += ']'.repeat(openBrackets - closeBrackets);
      }
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }

      outline = JSON.parse(jsonStr);
    } catch (error) {
      console.error('[StrategyAgent] Outline JSON parse error:', error);
      console.error('[StrategyAgent] Response content (first 1000):', response.content.substring(0, 1000));
      console.error('[StrategyAgent] Response content (last 500):', response.content.substring(Math.max(0, response.content.length - 500)));
      throw new Error(`Failed to parse outline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return outline;
  }

  private async generateLSIKeywords(input: StrategyInput): Promise<string[]> {
    const fallbackKeywords = input.researchData.relatedKeywords.slice(0, 5);

    if (fallbackKeywords.length >= 5) {
      console.log('[StrategyAgent] Using related keywords as LSI keywords (fallback)');
      return fallbackKeywords;
    }

    try {
      const prompt = `為關鍵字 "${input.researchData.keyword}" 生成 5 個 LSI 關鍵字。

輸出格式（必須是純 JSON 陣列）:
["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"]`;

      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.1,
        maxTokens: 100,
        format: 'json',
      });

      const parsed = JSON.parse(response.content);
      const lsiKeywords = parsed.keywords || parsed;

      if (!Array.isArray(lsiKeywords) || lsiKeywords.length < 5) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid LSI keywords format');
      }

      return lsiKeywords;
    } catch (error) {
      console.warn('[StrategyAgent] LSI keywords generation failed, using fallback:', error);
      return fallbackKeywords;
    }
  }

  private calculateWordDistribution(
    targetWordCount: number,
    outline: StrategyOutput['outline']
  ): StrategyOutput['sectionWordDistribution'] {
    const mainSectionsTotal = outline.mainSections.reduce(
      (sum, section) => sum + section.targetWordCount,
      0
    );

    const introWordCount = outline.introduction?.wordCount || 200;
    const conclusionWordCount = outline.conclusion?.wordCount || 150;
    const faqWordCount = Math.max(0, targetWordCount - introWordCount - mainSectionsTotal - conclusionWordCount);

    return {
      introduction: introWordCount,
      mainSections: mainSectionsTotal,
      conclusion: conclusionWordCount,
      faq: faqWordCount,
    };
  }
}
