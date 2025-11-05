import { BaseAgent } from './base-agent';
import type { StrategyInput, StrategyOutput } from '@/types/agents';

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return 'StrategyAgent';
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const selectedTitle = input.title || input.researchData.keyword;

    const outline = await this.generateOutline(input, selectedTitle);

    const sectionDistribution = this.calculateWordDistribution(
      input.targetWordCount,
      outline
    );

    return {
      titleOptions: [selectedTitle],
      selectedTitle,
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
    const prompt = `你是 SEO 專家。為關鍵字「${input.researchData.keyword}」生成 3 個標題。

## 推理步驟
1. 分析關鍵字意圖和目標受眾
2. 考慮 SEO 最佳實踐（包含關鍵字、適當長度）
3. 評估標題吸引力和點擊率潛力

## 要求
- 包含關鍵字「${input.researchData.keyword}」
- 50-60 字元
- 使用數字或問句提升吸引力

## 輸出格式
請在推理後，輸出以下 JSON 格式：
{
  "reasoning_summary": "簡要說明選擇這些標題的原因",
  "titles": ["標題1", "標題2", "標題3"]
}`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.3,
        maxTokens: Math.min(input.maxTokens || 64000, 1000),
        format: 'json',
      });

      console.log('[StrategyAgent] Raw title response:', {
        contentLength: response.content?.length || 0,
        preview: response.content?.substring(0, 200)
      });

      if (!response.content || response.content.trim() === '') {
        console.warn('[StrategyAgent] Empty response, using fallback titles');
        return this.getFallbackTitles(input.researchData.keyword);
      }

      const content = response.content.trim();

      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            console.log('[StrategyAgent] Successfully parsed titles from array match');
            return parsed.slice(0, 3);
          }
        } catch (e) {
          console.warn('[StrategyAgent] Failed to parse array match:', e);
        }
      }

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          console.log('[StrategyAgent] Successfully parsed titles from full content');
          return parsed.slice(0, 3);
        }
        if (parsed.titles && Array.isArray(parsed.titles) && parsed.titles.length >= 3) {
          console.log('[StrategyAgent] Successfully parsed titles from .titles property', {
            reasoning: parsed.reasoning_summary?.substring(0, 100),
            titlesCount: parsed.titles.length
          });
          return parsed.titles.slice(0, 3);
        }
      } catch (e) {
        console.warn('[StrategyAgent] Failed to parse full content as JSON:', e);
      }

      console.warn('[StrategyAgent] Invalid title format, using fallback');
      return this.getFallbackTitles(input.researchData.keyword);

    } catch (error) {
      console.error('[StrategyAgent] Title generation failed:', error);
      return this.getFallbackTitles(input.researchData.keyword);
    }
  }

  private getFallbackTitles(keyword: string): string[] {
    return [
      `${keyword}完整指南：從入門到精通`,
      `2025 最新${keyword}教學：實用技巧大公開`,
      `${keyword}全攻略：專家推薦的 10 個關鍵重點`,
    ];
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string
  ): Promise<StrategyOutput['outline']> {
    const topCompetitors = input.researchData.competitorAnalysis.slice(0, 3);
    const topGaps = input.researchData.contentGaps.slice(0, 3);

    const prompt = `為「${input.researchData.keyword}」生成文章大綱。

## 背景資訊
- 標題：${selectedTitle}
- 目標字數：${input.targetWordCount}

## 競爭對手優勢
${topCompetitors.map(c => `- ${c.strengths.slice(0, 2).join('、')}`).join('\n')}

## 內容缺口（需要補足）
${topGaps.join('\n')}

## 推理步驟
1. 分析目標關鍵字和讀者需求
2. 評估競爭對手的優勢，思考如何超越
3. 識別內容缺口，規劃獨特價值
4. 設計結構化大綱，確保邏輯流暢
5. 分配字數比例，平衡深度與廣度

## 重要規則
1. mainSections 最多 4 個
2. 每個 section 的 keyPoints 最多 3 個，每個最多 20 字
3. faq 最多 2 個
4. 字數分配要合理，總和應接近目標字數

## 輸出格式
請用結構化的方式回答，按以下格式組織：

### 前言 (Introduction)
- 開場鉤子：[吸引讀者的開場方式]
- 背景說明：[提供相關背景資訊]
- 核心論點：[文章主要觀點]
- 字數：約 200 字

### 主要段落 (Main Sections)
針對每個主要段落（最多4個），請說明：
- 段落標題：[段落主題]
- 子標題：[列出子標題]
- 關鍵重點：[列出3個重點]
- 目標字數：[建議字數]
- 相關關鍵字：[列出相關關鍵字]

### 結論 (Conclusion)
- 重點總結：[回顧核心要點]
- 行動呼籲：[鼓勵讀者採取行動]
- 字數：約 150 字

### 常見問題 (FAQ)
列出 1-2 個相關問題和答案大綱。

請以清晰分段的方式回答，每個項目用明確的標記區分。`;

    let apiResponse;
    try {
      apiResponse = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.5,
        maxTokens: Math.floor((input.maxTokens || 64000) * 0.9),
      });

      if (!apiResponse.content || apiResponse.content.trim() === '') {
        console.warn('[StrategyAgent] Empty outline response, using fallback');
        return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
      }

      const content = apiResponse.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.outline?.mainSections) {
            console.log('[StrategyAgent] Successfully parsed outline from JSON');
            return parsed.outline;
          }
          if (parsed.mainSections) {
            console.log('[StrategyAgent] Successfully parsed outline from direct JSON');
            return parsed;
          }
        } catch (e) {
          console.warn('[StrategyAgent] JSON parsing failed, parsing structured text:', e);
        }
      }

      return this.parseOutlineText(content, input.researchData.keyword, input.targetWordCount);

    } catch (error) {
      console.error('[StrategyAgent] Outline generation failed:', error);
      console.error('[StrategyAgent] Response (first 500):', apiResponse?.content?.substring(0, 500));
      return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
    }
  }

  private parseOutlineText(content: string, keyword: string, targetWordCount: number): StrategyOutput['outline'] {
    const introMatch = content.match(/### 前言[\s\S]*?(?=###|$)/);
    const mainMatch = content.match(/### 主要段落[\s\S]*?(?=### 結論|$)/);
    const conclusionMatch = content.match(/### 結論[\s\S]*?(?=### 常見問題|$)/);
    const faqMatch = content.match(/### 常見問題[\s\S]*$/);

    const extractListItems = (text: string): string[] => {
      const items: string[] = [];
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/[-•]\s*(.+?)[：:]\s*(.+)/);
        if (match && match[2]) {
          items.push(match[2].trim().replace(/\[|\]/g, ''));
        }
      }
      return items;
    };

    const introduction = introMatch ? {
      hook: extractListItems(introMatch[0])[0] || `${keyword}是什麼？為什麼重要？`,
      context: extractListItems(introMatch[0])[1] || `${keyword}的基本概念與應用場景`,
      thesis: extractListItems(introMatch[0])[2] || `本文將深入探討${keyword}的各個面向`,
      wordCount: 200,
    } : {
      hook: `${keyword}是什麼？為什麼重要？`,
      context: `${keyword}的基本概念與應用場景`,
      thesis: `本文將深入探討${keyword}的各個面向`,
      wordCount: 200,
    };

    const mainSections: Array<{
      heading: string;
      subheadings: string[];
      keyPoints: string[];
      targetWordCount: number;
      keywords: string[];
    }> = [];

    if (mainMatch) {
      const sectionBlocks = mainMatch[0].split(/- 段落標題/).slice(1);
      const sectionWordCount = Math.floor((targetWordCount - 350) / Math.min(sectionBlocks.length, 4));

      for (let i = 0; i < Math.min(sectionBlocks.length, 4); i++) {
        const block = sectionBlocks[i];
        const headingMatch = block.match(/[：:]\s*(.+?)(?:\n|$)/);
        const subheadingsMatch = block.match(/- 子標題[：:]\s*(.+?)(?:\n|$)/);
        const keyPointsMatch = block.match(/- 關鍵重點[：:]\s*(.+?)(?:\n|$)/);
        const keywordsMatch = block.match(/- 相關關鍵字[：:]\s*(.+?)(?:\n|$)/);

        mainSections.push({
          heading: headingMatch ? headingMatch[1].trim().replace(/\[|\]/g, '') : `${keyword}重點${i + 1}`,
          subheadings: subheadingsMatch ? subheadingsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 2) : [],
          keyPoints: keyPointsMatch ? keyPointsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 3) : [],
          targetWordCount: sectionWordCount,
          keywords: keywordsMatch ? keywordsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 3) : [keyword],
        });
      }
    }

    if (mainSections.length === 0) {
      console.warn('[StrategyAgent] No main sections parsed, using fallback');
      return this.getFallbackOutline(keyword, targetWordCount);
    }

    const conclusion = conclusionMatch ? {
      summary: extractListItems(conclusionMatch[0])[0] || `${keyword}的核心要點回顧`,
      callToAction: extractListItems(conclusionMatch[0])[1] || `開始實踐${keyword}，提升您的能力`,
      wordCount: 150,
    } : {
      summary: `${keyword}的核心要點回顧`,
      callToAction: `開始實踐${keyword}，提升您的能力`,
      wordCount: 150,
    };

    const faq: Array<{ question: string; answerOutline: string }> = [];
    if (faqMatch) {
      const faqLines = faqMatch[0].split('\n').filter(line => line.trim());
      for (let i = 0; i < faqLines.length && faq.length < 2; i++) {
        const match = faqLines[i].match(/[?？](.+)/);
        if (match) {
          faq.push({
            question: faqLines[i].trim(),
            answerOutline: faqLines[i + 1]?.trim() || '詳細說明',
          });
        }
      }
    }

    if (faq.length === 0) {
      faq.push(
        { question: `${keyword}適合新手嗎？`, answerOutline: '適合，本文從基礎講起' },
        { question: `學習${keyword}需要多久？`, answerOutline: '視個人情況，通常 1-3 個月' }
      );
    }

    return { introduction, mainSections, conclusion, faq };
  }

  private getFallbackOutline(keyword: string, targetWordCount: number): StrategyOutput['outline'] {
    const sectionCount = 3;
    const sectionWordCount = Math.floor((targetWordCount - 350) / sectionCount);

    return {
      introduction: {
        hook: `${keyword}是什麼？為什麼重要？`,
        context: `${keyword}的基本概念與應用場景`,
        thesis: `本文將深入探討${keyword}的各個面向`,
        wordCount: 200,
      },
      mainSections: [
        {
          heading: `${keyword}基礎知識`,
          subheadings: ['核心概念', '重要術語'],
          keyPoints: ['定義與原理', '應用範圍', '基本特點'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '基礎', '入門'],
        },
        {
          heading: `${keyword}實用技巧`,
          subheadings: ['進階方法', '常見問題'],
          keyPoints: ['實用策略', '避免錯誤', '最佳實踐'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '技巧', '方法'],
        },
        {
          heading: `${keyword}案例分析`,
          subheadings: ['成功案例', '經驗分享'],
          keyPoints: ['實際應用', '效果評估', '經驗總結'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '案例', '實戰'],
        },
      ],
      conclusion: {
        summary: `${keyword}的核心要點回顧`,
        callToAction: `開始實踐${keyword}，提升您的能力`,
        wordCount: 150,
      },
      faq: [
        {
          question: `${keyword}適合新手嗎？`,
          answerOutline: '適合，本文從基礎講起',
        },
        {
          question: `學習${keyword}需要多久？`,
          answerOutline: '視個人情況，通常 1-3 個月',
        },
      ],
    };
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
