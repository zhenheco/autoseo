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