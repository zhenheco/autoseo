import { BaseAgent } from './base-agent';
import type { StrategyInput, StrategyOutput } from '@/types/agents';

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return 'StrategyAgent';
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const selectedTitle = input.title || input.researchData.title;

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
    const prompt = `你是 SEO 專家。為文章標題「${input.researchData.title}」生成 3 個標題。

## 推理步驟
1. 分析標題意圖和目標受眾
2. 考慮 SEO 最佳實踐（包含關鍵字、適當長度）
3. 評估標題吸引力和點擊率潛力

## 要求
- 包含關鍵字「${input.researchData.title}」
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
        return this.getFallbackTitles(input.researchData.title);
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
      return this.getFallbackTitles(input.researchData.title);

    } catch (error) {
      console.error('[StrategyAgent] Title generation failed:', error);
      return this.getFallbackTitles(input.researchData.title);
    }
  }

  private getFallbackTitles(title: string): string[] {
    return [
      `${title}完整指南：從入門到精通`,
      `2025 最新${title}教學：實用技巧大公開`,
      `${title}全攻略：專家推薦的 10 個關鍵重點`,
    ];
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string
  ): Promise<StrategyOutput['outline']> {
    const topCompetitors = input.researchData.competitorAnalysis.slice(0, 3);
    const topGaps = input.researchData.contentGaps.slice(0, 3);

    const prompt = `為「${selectedTitle}」生成文章大綱。

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

## 輸出格式（必須是 JSON）
請嚴格按照以下 JSON schema 輸出，不要包含任何額外文字：

{
  "introduction": {
    "hook": "吸引讀者的開場方式",
    "context": "提供相關背景資訊",
    "thesis": "文章主要觀點",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "段落標題",
      "subheadings": ["子標題1", "子標題2"],
      "keyPoints": ["重點1", "重點2", "重點3"],
      "targetWordCount": 500,
      "keywords": ["關鍵字1", "關鍵字2"]
    }
  ],
  "conclusion": {
    "summary": "重點總結",
    "callToAction": "行動呼籲",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "問題1？",
      "answerOutline": "答案大綱"
    }
  ]
}

請確保輸出是有效的 JSON 格式。`;

    let apiResponse;
    try {
      apiResponse = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.5,
        maxTokens: Math.floor((input.maxTokens || 64000) * 0.9),
        format: 'json',
      });

      if (!apiResponse.content || apiResponse.content.trim() === '') {
        console.warn('[StrategyAgent] Empty outline response, using fallback');
        return this.getFallbackOutline(selectedTitle, input.targetWordCount);
      }

      const content = apiResponse.content.trim();

      console.log('[StrategyAgent] Raw outline response:', {
        contentLength: content.length,
        firstChars: content.substring(0, 200),
        hasJsonMarkers: content.includes('{') && content.includes('}'),
        hasMarkdownHeaders: content.includes('###'),
      });

      const parsed = this.parseOutlineWithFallbacks(content, selectedTitle, input.targetWordCount);
      return parsed;

    } catch (error) {
      console.error('[StrategyAgent] Outline generation failed:', error);
      console.error('[StrategyAgent] Response (first 500):', apiResponse?.content?.substring(0, 500));
      return this.getFallbackOutline(selectedTitle, input.targetWordCount);
    }
  }

  private parseOutlineWithFallbacks(content: string, title: string, targetWordCount: number): StrategyOutput['outline'] {
    const parsers: Array<{
      name: string;
      parse: () => StrategyOutput['outline'] | null;
    }> = [
      {
        name: 'DirectJSONParser',
        parse: () => this.tryDirectJSONParse(content)
      },
      {
        name: 'NestedJSONParser',
        parse: () => this.tryNestedJSONParse(content)
      },
      {
        name: 'MarkdownStructuredParser',
        parse: () => this.parseOutlineText(content, title, targetWordCount)
      },
      {
        name: 'FallbackOutline',
        parse: () => this.getFallbackOutline(title, targetWordCount)
      }
    ];

    for (const parser of parsers) {
      try {
        console.log(`[StrategyAgent] Attempting parser: ${parser.name}`);
        const result = parser.parse();

        if (result && result.mainSections && result.mainSections.length > 0) {
          console.log(`[StrategyAgent] ✅ ${parser.name} succeeded:`, {
            sectionsCount: result.mainSections.length
          });
          return result;
        }

        console.warn(`[StrategyAgent] ⚠️ ${parser.name} returned empty or invalid result`);
      } catch (error) {
        console.warn(`[StrategyAgent] ❌ ${parser.name} failed:`, error);
      }
    }

    console.error('[StrategyAgent] All parsers failed, using fallback outline');
    return this.getFallbackOutline(title, targetWordCount);
  }

  private tryDirectJSONParse(content: string): StrategyOutput['outline'] | null {
    try {
      const parsed = JSON.parse(content);
      if (parsed.mainSections) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  private tryNestedJSONParse(content: string): StrategyOutput['outline'] | null {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.outline?.mainSections) {
        return parsed.outline;
      }

      if (parsed.mainSections) {
        return parsed;
      }
    } catch {
      return null;
    }

    return null;
  }

  private parseOutlineText(content: string, title: string, targetWordCount: number): StrategyOutput['outline'] {
    console.log('[StrategyAgent] parseOutlineText called', {
      contentLength: content.length,
      hasFrontmatter: content.includes('### 前言') || content.includes('Introduction'),
      hasMainSections: content.includes('### 主要段落') || content.includes('Main Sections'),
      hasConclusion: content.includes('### 結論') || content.includes('Conclusion'),
    });

    const introMatch = content.match(/### 前言[\s\S]*?(?=###|$)/);
    const mainMatch = content.match(/### 主要段落[\s\S]*?(?=### 結論|$)/);
    const conclusionMatch = content.match(/### 結論[\s\S]*?(?=### 常見問題|$)/);
    const faqMatch = content.match(/### 常見問題[\s\S]*$/);

    console.log('[StrategyAgent] Section matches:', {
      introFound: !!introMatch,
      mainFound: !!mainMatch,
      conclusionFound: !!conclusionMatch,
      faqFound: !!faqMatch,
      mainMatchLength: mainMatch?.[0]?.length || 0,
    });

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
      hook: extractListItems(introMatch[0])[0] || `${title}為什麼重要？`,
      context: extractListItems(introMatch[0])[1] || `${title}的背景說明`,
      thesis: extractListItems(introMatch[0])[2] || `本文將深入探討${title}的各個面向`,
      wordCount: 200,
    } : {
      hook: `${title}為什麼重要？`,
      context: `${title}的背景說明`,
      thesis: `本文將深入探討${title}的各個面向`,
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

      console.log('[StrategyAgent] Parsing main sections:', {
        sectionBlocksCount: sectionBlocks.length,
        firstBlockPreview: sectionBlocks[0]?.substring(0, 100),
      });

      for (let i = 0; i < Math.min(sectionBlocks.length, 4); i++) {
        const block = sectionBlocks[i];
        const headingMatch = block.match(/[：:]\s*(.+?)(?:\n|$)/);
        const subheadingsMatch = block.match(/- 子標題[：:]\s*(.+?)(?:\n|$)/);
        const keyPointsMatch = block.match(/- 關鍵重點[：:]\s*(.+?)(?:\n|$)/);
        const keywordsMatch = block.match(/- 相關關鍵字[：:]\s*(.+?)(?:\n|$)/);

        const section = {
          heading: headingMatch ? headingMatch[1].trim().replace(/\[|\]/g, '') : `${title}重點${i + 1}`,
          subheadings: subheadingsMatch ? subheadingsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 2) : [],
          keyPoints: keyPointsMatch ? keyPointsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 3) : [],
          targetWordCount: sectionWordCount,
          keywords: keywordsMatch ? keywordsMatch[1].split(/[、,，]/).map(s => s.trim().replace(/\[|\]/g, '')).slice(0, 3) : [title],
        };

        console.log(`[StrategyAgent] Parsed section ${i + 1}:`, {
          heading: section.heading,
          keyPointsCount: section.keyPoints.length,
        });

        mainSections.push(section);
      }
    }

    console.log('[StrategyAgent] Final main sections count:', mainSections.length);

    if (mainSections.length === 0) {
      console.warn('[StrategyAgent] No main sections parsed, using fallback');
      console.warn('[StrategyAgent] Main match content (first 500):', mainMatch?.[0]?.substring(0, 500));
      return this.getFallbackOutline(title, targetWordCount);
    }

    const conclusion = conclusionMatch ? {
      summary: extractListItems(conclusionMatch[0])[0] || `${title}的核心要點回顧`,
      callToAction: extractListItems(conclusionMatch[0])[1] || `開始實踐${title}，提升您的能力`,
      wordCount: 150,
    } : {
      summary: `${title}的核心要點回顧`,
      callToAction: `開始實踐${title}，提升您的能力`,
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
        { question: `${title}適合新手嗎？`, answerOutline: '適合，本文從基礎講起' },
        { question: `學習${title}需要多久？`, answerOutline: '視個人情況，通常 1-3 個月' }
      );
    }

    return { introduction, mainSections, conclusion, faq };
  }

  private getFallbackOutline(title: string, targetWordCount: number): StrategyOutput['outline'] {
    const sectionCount = 3;
    const sectionWordCount = Math.floor((targetWordCount - 350) / sectionCount);

    return {
      introduction: {
        hook: `${title}是什麼？為什麼重要？`,
        context: `${title}的基本概念與應用場景`,
        thesis: `本文將深入探討${title}的各個面向`,
        wordCount: 200,
      },
      mainSections: [
        {
          heading: `${title}基礎知識`,
          subheadings: ['核心概念', '重要術語'],
          keyPoints: ['定義與原理', '應用範圍', '基本特點'],
          targetWordCount: sectionWordCount,
          keywords: [title, '基礎', '入門'],
        },
        {
          heading: `${title}實用技巧`,
          subheadings: ['進階方法', '常見問題'],
          keyPoints: ['實用策略', '避免錯誤', '最佳實踐'],
          targetWordCount: sectionWordCount,
          keywords: [title, '技巧', '方法'],
        },
        {
          heading: `${title}案例分析`,
          subheadings: ['成功案例', '經驗分享'],
          keyPoints: ['實際應用', '效果評估', '經驗總結'],
          targetWordCount: sectionWordCount,
          keywords: [title, '案例', '實戰'],
        },
      ],
      conclusion: {
        summary: `${title}的核心要點回顧`,
        callToAction: `開始實踐${title}，提升您的能力`,
        wordCount: 150,
      },
      faq: [
        {
          question: `${title}適合新手嗎？`,
          answerOutline: '適合，本文從基礎講起',
        },
        {
          question: `學習${title}需要多久？`,
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
      const prompt = `為文章標題 "${input.researchData.title}" 生成 5 個 LSI 關鍵字。

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
