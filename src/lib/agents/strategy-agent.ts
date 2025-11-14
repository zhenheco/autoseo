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
- 搜尋意圖：${input.researchData.searchIntent}
- 讀者需求：${input.researchData.recommendedStrategy}

## 競爭對手優勢分析
${topCompetitors.map((c, i) => `${i + 1}. ${c.title}
   - 優勢：${c.strengths.join('、')}
   - 弱點：${c.weaknesses.join('、')}
   - 獨特角度：${c.uniqueAngles.join('、')}`).join('\n')}

## 內容缺口（競爭對手未覆蓋的重點）
${topGaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n')}

## 推理步驟
1. 分析讀者搜尋此主題的真實需求和痛點
2. 評估競爭對手的優勢與弱點，找出超越機會
3. **重點**：將內容缺口轉化為獨特的 section 角度
4. 設計邏輯流暢且互補的大綱結構
5. 確保每個 section 回答不同的問題或解決不同的痛點

## ⚠️ Section 多樣化要求（極為重要）

**每個 mainSection 必須有獨特的角度和價值：**

1. **基於內容缺口設計**：優先使用上述「內容缺口」來設計 sections
2. **回答不同的問題**：每個 section 應該解決讀者的不同疑問或需求
3. **避免重複**：不要在每個 section 標題中硬置入相同的關鍵字
4. **多樣化視角**：混合使用「理論說明」「實作步驟」「案例分析」「常見錯誤」「進階技巧」等不同類型
5. **自然流暢**：sections 之間應該有邏輯遞進關係（例如：基礎 → 應用 → 進階）

**錯誤示範（sections 太相似）：**
- 如何選擇 Python 學習資源
- 如何學習 Python 基礎語法
- 如何練習 Python 程式設計
- 如何提升 Python 編程技能

**正確示範（多樣化且互補）：**
- Python 開發環境建置與工具選擇
- 掌握資料結構：從 list 到 dictionary 的實戰應用
- 常見錯誤與除錯技巧：新手必知的 10 個陷阱
- 進階學習路徑：從腳本到專案的升級之路

## 重要規則
1. mainSections 最多 4 個
2. 每個 section 的 heading 必須獨特且有價值，不要重複相似的句式
3. 每個 section 的 keyPoints 最多 3 個，每個最多 20 字
4. keyPoints 應該反映該 section 的核心內容，而非關鍵字堆砌
5. faq 最多 2 個，問題要具體且實用
6. 字數分配要合理，總和應接近目標字數

## ⚠️ 重要：輸出格式要求

**必須直接輸出純 JSON，不要包含任何額外內容：**
- ❌ 不要使用 Markdown 代碼塊（不要用 \`\`\`json 或 \`\`\`）
- ❌ 不要在 JSON 前後加上任何說明文字
- ❌ 不要使用「以下是」、「這是」等開場白
- ✅ 直接以 { 開頭，以 } 結尾
- ✅ 確保是有效的 JSON 格式

**正確範例（直接輸出 JSON）：**
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

**錯誤範例（不要這樣做）：**
以下是文章大綱的 JSON 格式：
\`\`\`json
{...}
\`\`\`

請立即開始輸出 JSON：`;

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
    // Log AI response details for debugging
    console.log('[StrategyAgent] AI Response Analysis:', {
      totalLength: content.length,
      firstChars: content.substring(0, 200),
      lastChars: content.substring(Math.max(0, content.length - 200)),
      hasMarkdownCodeBlock: content.includes('```json') || content.includes('```'),
      hasJsonBraces: content.includes('{') && content.includes('}'),
      startsWithBrace: content.trim().startsWith('{'),
    });

    const parsers: Array<{
      name: string;
      parse: () => StrategyOutput['outline'] | null;
    }> = [
      {
        name: 'DirectJSONParser',
        parse: () => this.tryDirectJSONParse(content)
      },
      {
        name: 'MarkdownCodeBlockParser',
        parse: () => this.tryMarkdownCodeBlockParse(content)
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
            sectionsCount: result.mainSections.length,
            sectionTitles: result.mainSections.map(s => s.heading).slice(0, 3)
          });
          return result;
        }

        console.warn(`[StrategyAgent] ⚠️ ${parser.name} returned empty or invalid result`);
      } catch (error) {
        const err = error as Error;
        console.warn(`[StrategyAgent] ❌ ${parser.name} failed:`, {
          errorMessage: err.message,
          errorName: err.name
        });
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

  private tryMarkdownCodeBlockParse(content: string): StrategyOutput['outline'] | null {
    // Try to extract JSON from Markdown code blocks like ```json...``` or ```{...}```
    const codeBlockPatterns = [
      /```json\s*\n?([\s\S]*?)\n?```/,  // ```json ... ```
      /```\s*\n?(\{[\s\S]*?\})\n?```/,   // ``` {...} ```
    ];

    for (const pattern of codeBlockPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1].trim());

          if (parsed.outline?.mainSections) {
            console.log('[StrategyAgent] Extracted JSON from Markdown code block (nested)');
            return parsed.outline;
          }

          if (parsed.mainSections) {
            console.log('[StrategyAgent] Extracted JSON from Markdown code block (direct)');
            return parsed;
          }
        } catch (error) {
          console.warn('[StrategyAgent] Failed to parse Markdown code block content:', error);
        }
      }
    }

    return null;
  }

  private tryNestedJSONParse(content: string): StrategyOutput['outline'] | null {
    // 嘗試多種 JSON 提取策略
    const extractionStrategies = [
      // 策略 1: 找到最後一個完整的 JSON 物件（最可能是輸出結果）
      () => {
        const matches = content.matchAll(/\{[\s\S]*?\}/g);
        const allMatches = Array.from(matches);
        if (allMatches.length === 0) return null;

        // 從最後一個 match 開始往前試
        for (let i = allMatches.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(allMatches[i][0]);
            if (parsed.mainSections || parsed.outline?.mainSections) {
              console.log(`[StrategyAgent] Found valid JSON at match ${i + 1}/${allMatches.length}`);
              return parsed;
            }
          } catch {
            continue;
          }
        }
        return null;
      },

      // 策略 2: 找到最大的 JSON 物件（最可能包含完整資訊）
      () => {
        const matches = content.matchAll(/\{[\s\S]*?\}/g);
        const allMatches = Array.from(matches);
        if (allMatches.length === 0) return null;

        // 按長度排序，從最長的開始試
        const sortedByLength = allMatches.sort((a, b) => b[0].length - a[0].length);
        for (const match of sortedByLength) {
          try {
            const parsed = JSON.parse(match[0]);
            if (parsed.mainSections || parsed.outline?.mainSections) {
              console.log(`[StrategyAgent] Found valid JSON with length ${match[0].length}`);
              return parsed;
            }
          } catch {
            continue;
          }
        }
        return null;
      },

      // 策略 3: 使用貪婪匹配，嘗試找到最外層的 JSON（原本的邏輯）
      () => {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }
    ];

    for (let i = 0; i < extractionStrategies.length; i++) {
      try {
        const parsed = extractionStrategies[i]();
        if (!parsed) continue;

        if (parsed.outline?.mainSections) {
          console.log(`[StrategyAgent] ✅ Extraction strategy ${i + 1} succeeded (nested structure)`);
          return parsed.outline;
        }

        if (parsed.mainSections) {
          console.log(`[StrategyAgent] ✅ Extraction strategy ${i + 1} succeeded (direct structure)`);
          return parsed;
        }
      } catch (error) {
        console.warn(`[StrategyAgent] Extraction strategy ${i + 1} failed:`, error);
        continue;
      }
    }

    console.warn('[StrategyAgent] All JSON extraction strategies failed');
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
