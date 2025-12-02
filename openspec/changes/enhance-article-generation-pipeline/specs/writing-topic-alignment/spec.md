# Spec: writing-topic-alignment

## Overview

更新所有寫作 Agents，透過 ContentContext 確保內文與標題主題完全一致。

## ADDED Requirements

### Requirement: WRITING-CONTEXT-001 - ContentContext 類型定義

A ContentContext interface MUST be added to pass topic context to all writing agents.

#### Scenario: ContentContext 結構

**Given** Orchestrator 需要傳遞主題上下文
**Then** ContentContext 包含：

- primaryKeyword: string（原始關鍵字）
- selectedTitle: string（選定標題）
- searchIntent: string（搜尋意圖）
- targetAudience: string（目標讀者）
- topicKeywords: string[]（主題關鍵字）
- regionContext?: string（地區上下文）
- industryContext?: string（行業上下文）
- brandName?: string（品牌名稱）
- toneGuidance?: string（語調指導）

### Requirement: WRITING-CONTEXT-002 - Orchestrator 構建 ContentContext

Orchestrator MUST build ContentContext before entering the writing phase.

#### Scenario: 構建 ContentContext

**Given** Orchestrator 完成 ContentPlanAgent 執行
**When** 進入寫作階段
**Then** Orchestrator 構建 ContentContext：

- primaryKeyword = input.title
- selectedTitle = contentPlan.optimizedTitle.primary
- searchIntent = researchOutput.searchIntent
- targetAudience = brandVoice.target_audience
- topicKeywords = researchOutput.relatedKeywords（前 10 個）
- toneGuidance = contentPlan.contentStrategy.toneGuidance

### Requirement: WRITING-CONTEXT-003 - SectionAgent 主題對齊

SectionAgent prompt MUST include topic alignment constraints at the beginning.

#### Scenario: SectionAgent prompt 包含主題約束

**Given** SectionAgent 接收 ContentContext
**When** SectionAgent 生成內容
**Then** prompt 開頭包含：

- "CRITICAL: Topic Alignment Requirement"
- Article Title
- PRIMARY KEYWORD
- "You MUST ensure all content is directly relevant to this topic"
- "Do NOT include unrelated content"

#### Scenario: 內容與主題一致

**Given** 標題為 "畢業典禮錄影服務完整介紹"
**And** 主關鍵字為 "畢業典禮錄影"
**When** SectionAgent 生成內容
**Then** 內容全部與畢業典禮錄影相關
**And** 不包含程式開發、技術編碼等無關內容

### Requirement: WRITING-CONTEXT-004 - IntroductionAgent 主題對齊

IntroductionAgent prompt MUST include topic alignment constraints.

#### Scenario: IntroductionAgent 使用 ContentContext

**Given** IntroductionAgent 接收 ContentContext
**When** IntroductionAgent 生成引言
**Then** prompt 包含完整的主題上下文
**And** 引言直接回應標題和主關鍵字

### Requirement: WRITING-CONTEXT-005 - ConclusionAgent 主題對齊

ConclusionAgent prompt MUST include topic alignment constraints.

#### Scenario: ConclusionAgent 使用 ContentContext

**Given** ConclusionAgent 接收 ContentContext
**When** ConclusionAgent 生成結論
**Then** prompt 包含完整的主題上下文
**And** 結論總結與標題主題相關的核心價值

### Requirement: WRITING-CONTEXT-006 - QAAgent 主題對齊

QAAgent prompt MUST include topic alignment constraints.

#### Scenario: QAAgent 使用 ContentContext

**Given** QAAgent 接收 ContentContext
**When** QAAgent 生成 FAQ
**Then** prompt 包含完整的主題上下文
**And** 所有 FAQ 問題與主關鍵字直接相關

### Requirement: WRITING-CONTEXT-007 - WritingAgent（Legacy）主題對齊

WritingAgent (non-Multi-Agent path) prompt MUST include topic alignment constraints.

#### Scenario: WritingAgent 使用 ContentContext

**Given** 使用 Legacy WritingAgent 路徑
**And** WritingAgent 接收 ContentContext
**When** WritingAgent 生成完整文章
**Then** prompt 開頭包含主題對齊約束
**And** 整篇文章與標題主題一致

## MODIFIED Requirements

### Requirement: WRITING-INPUT-001 - 擴展 SectionInput

SectionInput MUST include a contentContext field.

#### Scenario: SectionInput 包含 ContentContext

**Given** Orchestrator 調用 SectionAgent
**Then** SectionInput 包含 contentContext: ContentContext 欄位

### Requirement: WRITING-INPUT-002 - 擴展 IntroductionInput

IntroductionInput MUST include a contentContext field.

#### Scenario: IntroductionInput 包含 ContentContext

**Given** Orchestrator 調用 IntroductionAgent
**Then** IntroductionInput 包含 contentContext: ContentContext 欄位

### Requirement: WRITING-INPUT-003 - 擴展 ConclusionInput

ConclusionInput MUST include a contentContext field.

#### Scenario: ConclusionInput 包含 ContentContext

**Given** Orchestrator 調用 ConclusionAgent
**Then** ConclusionInput 包含 contentContext: ContentContext 欄位

### Requirement: WRITING-INPUT-004 - 擴展 QAInput

QAInput MUST include a contentContext field.

#### Scenario: QAInput 包含 ContentContext

**Given** Orchestrator 調用 QAAgent
**Then** QAInput 包含 contentContext: ContentContext 欄位

## ADDED Requirements (Special Blocks)

### Requirement: WRITING-SPECIAL-001 - 特殊區塊渲染

Writing agents MUST be able to render special blocks.

#### Scenario: 渲染專家提示區塊

**Given** section.specialBlock = { type: 'expert_tip', content: '...' }
**When** SectionAgent 生成內容
**Then** 內容包含 "💡 {品牌名稱} 專家提示" 區塊
**And** 區塊內容為 50-80 字的實用建議

#### Scenario: 渲染本地優勢區塊

**Given** section.specialBlock = { type: 'local_advantage', content: '...' }
**When** SectionAgent 生成內容
**Then** 內容包含 "🏆 本地優勢" 區塊
**And** 區塊內容為 80-120 字的地區特色說明

#### Scenario: 渲染專家警告區塊

**Given** section.specialBlock = { type: 'expert_warning', content: '...' }
**When** SectionAgent 生成內容
**Then** 內容包含 "⚠️ 專家警告" 區塊
**And** 區塊內容為 50-80 字的重要提醒

## Related Capabilities

- `content-plan-agent`: 提供 ContentPlanOutput 和 specialBlock 定義
- `strategy-brand-voice`: 提供品牌名稱和語調
