# Spec: content-plan-agent

## Overview

新增 ContentPlanAgent 整合 research、strategy、competitor analysis、brand voice，產生詳細的寫作計劃 JSON。

## ADDED Requirements

### Requirement: CONTENT-PLAN-001 - ContentPlanAgent 基本功能

ContentPlanAgent MUST extend BaseAgent and implement complete content plan generation.

#### Scenario: 生成完整寫作計劃

**Given** 輸入包含 StrategyOutput、ResearchOutput、CompetitorAnalysisOutput、BrandVoice
**When** ContentPlanAgent.execute() 被調用
**Then** 返回 ContentPlanOutput 包含：

- optimizedTitle（優化後的標題）
- contentStrategy（內容策略）
- detailedOutline（詳細大綱）
- seoOptimization（SEO 優化）
- localization（地區本地化）
- researchInsights（研究洞察）
- executionInfo（執行資訊）

### Requirement: CONTENT-PLAN-002 - 標題優化輸出

ContentPlanOutput.optimizedTitle MUST include primary title, alternatives, and reasoning.

#### Scenario: 標題優化結構

**Given** StrategyAgent 選定標題為 "專業畢業典禮錄影服務"
**When** ContentPlanAgent 生成寫作計劃
**Then** optimizedTitle.primary 為最終確認的標題
**And** optimizedTitle.alternatives 包含 1-2 個備選標題
**And** optimizedTitle.reasoning 說明選擇理由

### Requirement: CONTENT-PLAN-003 - 內容策略輸出

ContentPlanOutput.contentStrategy MUST include primary angle, user pain points, and value proposition.

#### Scenario: 內容策略結構

**Given** 關鍵字為 "畢業典禮錄影"
**When** ContentPlanAgent 生成寫作計劃
**Then** contentStrategy 包含：

- primaryAngle: 文章的主要切入角度
- userPainPoints: 至少 3 個用戶痛點
- valueProposition: 明確的價值主張
- differentiationPoints: 與競爭對手的差異點
- toneGuidance: 語調指導

### Requirement: CONTENT-PLAN-004 - 詳細大綱輸出

ContentPlanOutput.detailedOutline MUST include complete article structure.

#### Scenario: 大綱結構

**Given** ContentPlanAgent 生成寫作計劃
**Then** detailedOutline 包含：

- introduction: 引言段落計劃
- mainSections: 3 個主要內容區塊
- faq: FAQ 區塊計劃
- conclusion: 結論段落計劃
  **And** 每個區塊包含 h2Title、keyPoints、targetWordCount

#### Scenario: 主要內容區塊結構

**Given** detailedOutline.mainSections 中的任一區塊
**Then** 該區塊包含：

- h2Title: H2 標題
- subheadings: 子標題陣列
- writingInstructions: 寫作指導說明
- researchInsights: 要引用的研究洞察
- targetWordCount: 目標字數
- specialBlock: 選擇性的特殊區塊

### Requirement: CONTENT-PLAN-005 - 特殊區塊選擇性使用

Special blocks (💡專家提示、🏆本地優勢、⚠️專家警告) MUST be used selectively based on article topic.

#### Scenario: 教學類文章

**Given** 文章主題為教學類或技巧類
**When** ContentPlanAgent 生成寫作計劃
**Then** 至少一個 mainSection 包含 specialBlock.type = 'expert_tip'

#### Scenario: 地區性服務文章

**Given** 文章主題為地區性服務或本地化內容
**When** ContentPlanAgent 生成寫作計劃
**Then** 至少一個 mainSection 包含 specialBlock.type = 'local_advantage'

#### Scenario: 安全風險相關文章

**Given** 文章主題涉及安全、風險或警告
**When** ContentPlanAgent 生成寫作計劃
**Then** 至少一個 mainSection 包含 specialBlock.type = 'expert_warning'

#### Scenario: 一般性文章

**Given** 文章主題不屬於上述特殊類型
**When** ContentPlanAgent 生成寫作計劃
**Then** specialBlock 可以為 undefined

### Requirement: CONTENT-PLAN-006 - 整合深度研究資料

ContentPlanAgent MUST use ResearchOutput.deepResearch data when available.

#### Scenario: 使用趨勢資料

**Given** ResearchOutput.deepResearch.trends 包含內容
**When** ContentPlanAgent 生成寫作計劃
**Then** researchInsights.trendTopics 包含趨勢相關內容
**And** detailedOutline 中引用趨勢洞察

#### Scenario: 深度研究資料不存在

**Given** ResearchOutput.deepResearch 為 undefined
**When** ContentPlanAgent 生成寫作計劃
**Then** 使用 ResearchOutput 中的其他資料
**And** researchInsights 基於現有資料生成

### Requirement: CONTENT-PLAN-007 - FAQ 策略

detailedOutline.faq MUST include questions and answer guidelines.

#### Scenario: FAQ 結構

**Given** ContentPlanAgent 生成寫作計劃
**Then** faq 包含：

- h2Title: "常見問題" 或相似標題
- questions: 6-8 個問題物件
- targetWordCount: 500-700 字
  **And** 每個問題物件包含 question 和 answerGuidelines

### Requirement: CONTENT-PLAN-008 - 執行資訊追蹤

ContentPlanOutput.executionInfo MUST record model and performance information.

#### Scenario: 記錄執行資訊

**Given** ContentPlanAgent 完成執行
**Then** executionInfo 包含：

- model: 使用的 AI 模型
- totalTokens: 消耗的 token 數
- latencyMs: 執行時間（毫秒）

## Related Capabilities

- `research-deep-integration`: 提供 deepResearch 資料
- `strategy-brand-voice`: 提供 StrategyOutput 和品牌聲音
- `writing-topic-alignment`: 使用 ContentPlanOutput 確保主題一致
