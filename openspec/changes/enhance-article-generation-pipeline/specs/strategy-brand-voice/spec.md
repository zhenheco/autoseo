# Spec: strategy-brand-voice

## Overview

修改 StrategyAgent 讓標題生成和選擇考慮品牌聲音（BrandVoice），確保標題風格與品牌一致。

## MODIFIED Requirements

### Requirement: STRATEGY-TITLE-001 - 標題生成 Prompt 整合品牌聲音

The title generation prompt MUST include brand voice requirements and examples.

#### Scenario: 使用品牌聲音生成標題

**Given** 品牌配置為

- brand_name: "專業攝影工作室"
- tone_of_voice: "專業、友善、易懂"
- target_audience: "準備舉辦畢業典禮的學生和家長"
  **When** StrategyAgent 調用 generateTitleOptions()
  **Then** AI prompt 包含品牌名稱、語調風格、目標讀者
  **And** prompt 包含禁止使用的模板詞清單（如「完整指南」「全攻略」）
  **And** prompt 禁止使用年份（如 2024、2025）

#### Scenario: 包含品牌聲音範例

**Given** BrandVoice 包含 voice_examples.good_examples
**When** StrategyAgent 調用 generateTitleOptions()
**Then** AI prompt 包含品牌聲音範例區塊
**And** 範例數量限制在 3 個以內

### Requirement: STRATEGY-TITLE-002 - 標題長度控制

Title length MUST be controlled based on the target language.

#### Scenario: 中文標題長度

**Given** 目標語系為中文（zh-TW 或 zh-CN）
**When** StrategyAgent 生成標題
**Then** prompt 要求標題長度在 20-35 字之間

#### Scenario: 英文標題長度

**Given** 目標語系為英文（en）
**When** StrategyAgent 生成標題
**Then** prompt 要求標題長度在 50-60 字符之間

## ADDED Requirements

### Requirement: STRATEGY-BRAND-001 - 品牌一致性評分

StrategyAgent MUST add a scoreBrandConsistency() method to evaluate title-brand voice alignment.

#### Scenario: 計算品牌一致性分數

**Given** 標題 "專業畢業典禮錄影服務：讓您珍貴時刻永久保存"
**And** BrandVoice.tone_of_voice 為 "專業、友善、易懂"
**When** scoreBrandConsistency() 被調用
**Then** 返回 0-25 分的評分
**And** 評分包含語調匹配（10分）、句式風格匹配（10分）、避免禁用詞（5分）

#### Scenario: 標題包含禁用模式

**Given** 標題 "2024 畢業典禮錄影完整攻略"
**And** BrandVoice.voice_examples.bad_examples 包含 "完整攻略"
**When** scoreBrandConsistency() 被調用
**Then** 避免禁用詞項目得分為 0

### Requirement: STRATEGY-SCORE-001 - 整合品牌評分到 SEO 評分

scoreTitleSEO() MUST integrate brand consistency scoring.

#### Scenario: 總分計算

**Given** 標題的 SEO 評分為 60 分（滿分 75）
**And** 標題的品牌一致性評分為 20 分（滿分 25）
**When** scoreTitleSEO() 被調用
**Then** 返回總分 80 分（滿分 100）

### Requirement: STRATEGY-TEMP-001 - 調整標題生成 Temperature

Title generation temperature MUST be adjusted to 0.6 for increased creativity.

#### Scenario: 使用新 temperature

**Given** input.temperature 未指定
**When** generateTitleOptions() 調用 AI
**Then** temperature 設為 0.6（而非原本的 0.3）

## Related Capabilities

- `content-plan-agent`: ContentPlanAgent 使用 StrategyAgent 選定的標題
