import { BaseAgent } from "./base-agent";
import type {
  CompetitorAnalysisInput,
  CompetitorAnalysisOutput,
} from "@/types/agents";

export class CompetitorAnalysisAgent extends BaseAgent<
  CompetitorAnalysisInput & {
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
  CompetitorAnalysisOutput
> {
  get agentName(): string {
    return "CompetitorAnalysisAgent";
  }

  protected async process(
    input: CompetitorAnalysisInput & {
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<CompetitorAnalysisOutput> {
    const {
      serpData,
      primaryKeyword,
      targetLanguage,
      model,
      temperature,
      maxTokens,
    } = input;

    const prompt = this.buildPrompt(serpData, primaryKeyword, targetLanguage);

    const response = await this.complete(prompt, {
      model,
      temperature: temperature ?? 0.3,
      maxTokens: maxTokens ?? 2000,
      format: "json",
    });

    const analysis = this.parseResponse(response.content);

    return {
      ...analysis,
      executionInfo: {
        model: response.model,
        executionTime: this.getExecutionInfo().executionTime,
        tokenUsage: {
          input: response.usage.promptTokens,
          output: response.usage.completionTokens,
        },
      },
    };
  }

  private buildPrompt(
    serpData: CompetitorAnalysisInput["serpData"],
    primaryKeyword: string,
    targetLanguage: string,
  ): string {
    return `您是一位專精於 ${targetLanguage} SEO 優化的資深競爭內容分析師。

請分析前 10 名 SERP 結果並制定 ${targetLanguage} 策略。

## SERP 數據

### 搜尋意圖
- 類型: ${serpData.searchIntent}
- 信心度: ${serpData.intentConfidence}

### 排名特徵
- 內容長度範圍: ${serpData.topRankingFeatures.contentLength.min} - ${serpData.topRankingFeatures.contentLength.max} 字
- 平均長度: ${serpData.topRankingFeatures.contentLength.avg} 字
- 常見標題模式: ${serpData.topRankingFeatures.titlePatterns.join(", ")}
- 結構模式: ${serpData.topRankingFeatures.structurePatterns.join(", ")}
- 常見主題: ${serpData.topRankingFeatures.commonTopics.join(", ")}
- 常見格式: ${serpData.topRankingFeatures.commonFormats.join(", ")}

### 內容缺口
${serpData.contentGaps.map((gap) => `- ${gap}`).join("\n")}

### 競爭對手分析
${serpData.competitorAnalysis
  .map(
    (comp, i) => `
${i + 1}. ${comp.title}
   - URL: ${comp.url}
   - 預估字數: ${comp.estimatedWordCount}
   - 優勢: ${comp.strengths.join(", ")}
   - 弱點: ${comp.weaknesses.join(", ")}
   - 獨特角度: ${comp.uniqueAngles.join(", ")}
`,
  )
  .join("")}

### 建議策略
${serpData.recommendedStrategy}

### 相關關鍵字
${serpData.relatedKeywords.join(", ")}

目標關鍵字：${primaryKeyword}

## 規則
- 不得額外增加 JSON 鍵值
- 每個陣列 2-5 項，除非有合理理由
- 不得虛構統計數據；如不確定請使用定性描述
- 避免通用措辭（如「提升品質」）—要具體且可執行
- 若 SERP 數據模糊，請在前面標註「推測：」

## 輸出格式
返回以下 JSON 結構：

{
  "competitorAnalysis": {
    "topSiteFeatures": "前 3 名網站的共同特徵分析（權威性、版面配置、價值主張）",
    "contentLength": "預估平均字數範圍及建議目標字數（附理由）",
    "titlePatterns": "重複出現的標題公式（數字、年份、修飾詞等）",
    "contentStructure": "常見大綱與層次結構（核心 H2 主題、FAQ 使用情況）",
    "missingAngles": ["內容缺口1", "內容缺口2", "內容缺口3"]
  },
  "differentiationStrategy": {
    "contentAngle": "我們將採用的獨特角度",
    "valueEnhancement": "具體的價值增加策略",
    "userExperience": "用戶體驗/清晰度改善建議"
  },
  "seoOpportunities": {
    "keywordGaps": ["支援關鍵字1", "支援關鍵字2", "支援關鍵字3"],
    "structureOptimization": "大綱與內部連結改善建議",
    "eatImprovement": "E-A-T 權威性/信任度提升策略"
  },
  "contentRecommendations": {
    "mustInclude": ["必須包含的要點1", "必須包含的要點2"],
    "canSkip": ["低價值可跳過的面向1", "低價值可跳過的面向2"],
    "focusAreas": ["深度重點領域1", "深度重點領域2"]
  }
}

僅返回純 JSON 物件，不要包含任何其他文字。`;
  }

  private parseResponse(
    content: string,
  ): Omit<CompetitorAnalysisOutput, "executionInfo"> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        competitorAnalysis: {
          topSiteFeatures: parsed.competitorAnalysis?.topSiteFeatures ?? "",
          contentLength: parsed.competitorAnalysis?.contentLength ?? "",
          titlePatterns: parsed.competitorAnalysis?.titlePatterns ?? "",
          contentStructure: parsed.competitorAnalysis?.contentStructure ?? "",
          missingAngles: parsed.competitorAnalysis?.missingAngles ?? [],
        },
        differentiationStrategy: {
          contentAngle: parsed.differentiationStrategy?.contentAngle ?? "",
          valueEnhancement:
            parsed.differentiationStrategy?.valueEnhancement ?? "",
          userExperience: parsed.differentiationStrategy?.userExperience ?? "",
        },
        seoOpportunities: {
          keywordGaps: parsed.seoOpportunities?.keywordGaps ?? [],
          structureOptimization:
            parsed.seoOpportunities?.structureOptimization ?? "",
          eatImprovement: parsed.seoOpportunities?.eatImprovement ?? "",
        },
        contentRecommendations: {
          mustInclude: parsed.contentRecommendations?.mustInclude ?? [],
          canSkip: parsed.contentRecommendations?.canSkip ?? [],
          focusAreas: parsed.contentRecommendations?.focusAreas ?? [],
        },
      };
    } catch (error) {
      this.log("error", "Failed to parse competitor analysis response", {
        error,
        content: content.substring(0, 500),
      });

      return {
        competitorAnalysis: {
          topSiteFeatures: "分析失敗，使用預設策略",
          contentLength: "建議 2000-3000 字",
          titlePatterns: "包含關鍵字的描述性標題",
          contentStructure: "標準 H2 分段結構",
          missingAngles: [],
        },
        differentiationStrategy: {
          contentAngle: "提供實用價值",
          valueEnhancement: "加入具體案例和數據",
          userExperience: "清晰的段落結構",
        },
        seoOpportunities: {
          keywordGaps: [],
          structureOptimization: "標準內部連結",
          eatImprovement: "引用權威來源",
        },
        contentRecommendations: {
          mustInclude: [],
          canSkip: [],
          focusAreas: [],
        },
      };
    }
  }
}
