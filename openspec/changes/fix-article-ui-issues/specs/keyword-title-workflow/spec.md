# Keyword Title Workflow Specification

## MODIFIED Requirements

### Requirement: 主題關鍵字輸入欄位標示

The system SHALL clearly distinguish between "topic/keyword" and "article title" to avoid user confusion.

#### Scenario: 用戶輸入文章主題

Given 用戶在批次文章生成對話框
When 用戶看到輸入欄位
Then 欄位標籤顯示為「文章主題/關鍵字」而非「關鍵字」
And 欄位下方有提示文字「輸入文章主題方向，系統將基於此生成標題建議」

### Requirement: 標題生成流程優化

The system MUST use topic keywords as reference for title generation rather than using them directly as titles.

#### Scenario: 基於主題生成標題

Given 用戶輸入主題「AI取代程式設計師」
When 用戶點擊「生成標題建議」
Then 系統生成 5 個相關但不同的標題選項
And 原始主題不會直接出現在標題選項中
And 每個標題都是完整、可發布的文章標題

### Requirement: 進行中列表去重

The system MUST ensure no duplicate items appear in the "in-progress" list.

#### Scenario: 添加標題到生成佇列

Given 用戶已選擇一個生成的標題
When 用戶點擊「加入待生成列表」
Then 該標題出現在「進行中」列表一次
And 同一標題不會重複出現
And 列表顯示正確的關鍵字和標題配對

## ADDED Requirements

### Requirement: 自訂標題輸入增強

The system SHALL allow users to directly input custom titles in addition to AI suggestions.

#### Scenario: 用戶輸入自訂標題

Given 用戶已輸入主題關鍵字
And AI 已生成標題建議
When 用戶在「自訂標題」欄位輸入標題
And 點擊「添加自訂標題」
Then 自訂標題加入待生成列表
And 保留原始主題關鍵字作為 metadata

### Requirement: 標題編輯功能

The system MUST allow users to edit queued titles before submitting for generation.

#### Scenario: 編輯待生成標題

Given 待生成列表中有標題項目
When 用戶點擊標題進行編輯
Then 標題變為可編輯狀態
And 用戶可以修改標題文字
And 修改後自動保存

## ADDED Requirements (2024 AI Content Platform Standards)

### Requirement: 三階段工作流程視覺化

The system SHALL implement a clear three-stage workflow with visual progress indicators.

#### Scenario: 步驟進度顯示

Given 用戶在批次文章生成流程中
When 查看當前狀態
Then 顯示步驟指示器（1/3 主題、2/3 標題、3/3 確認）
And 當前步驟高亮顯示
And 已完成步驟顯示勾選標記
And 可點擊返回上一步

### Requirement: 標題評分與預測

The system SHOULD provide title scoring to help users select optimal titles.

#### Scenario: AI 標題評分

Given 系統生成了 5-10 個標題選項
When 顯示標題列表
Then 每個標題顯示 SEO 分數（0-100）
And 顯示預估點擊率（CTR）
And 標記最佳建議（AI 推薦）
And 提供評分理由說明

### Requirement: 智能關鍵字群組

The system SHALL support keyword clustering for better SEO optimization.

#### Scenario: 關鍵字群組輸入

Given 用戶在主題輸入階段
When 輸入關鍵字
Then 支援多個關鍵字（逗號分隔）
And 自動建議相關關鍵字
And 顯示搜尋量指標（如可用）
And 群組關鍵字用於內容優化

### Requirement: 搜尋意圖識別

The system MUST identify and categorize search intent for better content alignment.

#### Scenario: 意圖分類

Given 用戶輸入主題關鍵字
When 系統分析輸入
Then 識別搜尋意圖（資訊型/商業型/導航型/交易型）
And 根據意圖調整標題風格
And 顯示意圖標籤給用戶
And 解釋為何歸類此意圖

### Requirement: A/B 測試支援

The system SHALL support generating multiple title variants for A/B testing.

#### Scenario: 多版本標題生成

Given 用戶選擇 A/B 測試模式
When 確認標題選擇
Then 允許選擇 2-3 個標題變體
And 標記為 A/B 測試組
And 生成相同內容的多個版本
And 追蹤各版本效果指標
