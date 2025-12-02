## MODIFIED Requirements

### Requirement: 資料傳遞完整性

系統 SHALL 將用戶選擇的產業 (industry)、地區 (region)、語言 (language) 完整傳遞給所有 Agent。

#### Scenario: 產業資訊正確傳遞

- **WHEN** 用戶選擇產業類型（如 tech, finance, healthcare 等）
- **THEN** Orchestrator 從 input 參數讀取 industry
- **AND** 傳遞給 ResearchAgent, StrategyAgent 等所有需要的 Agent
- **AND** 日誌顯示正確的 industry 值（非 null）

#### Scenario: 地區資訊正確傳遞

- **WHEN** 用戶選擇地區（如 taiwan, japan, usa 等）
- **THEN** Orchestrator 從 input 參數讀取 region
- **AND** 傳遞給 ResearchAgent 等所有需要的 Agent
- **AND** 日誌顯示正確的 region 值（非 undefined）

#### Scenario: 從 metadata 讀取資料

- **WHEN** GitHub Actions 執行 process-jobs.ts
- **THEN** 從 article_jobs.metadata 讀取 industry, region, language
- **AND** 正確傳遞給 Orchestrator 的 input 參數

## ADDED Requirements

### Requirement: H2 結構動態決定

系統 SHALL 讓 AI 根據主題特性動態決定 H2 結構，不使用制式化模板。

#### Scenario: 結構根據主題決定

- **WHEN** ContentPlanAgent 規劃文章結構
- **THEN** 根據主題和搜尋意圖選擇適合的結構類型
- **AND** 不使用「基本定義與原理」「必要工具與資源」等制式標題
- **AND** 每個 H2 標題具體且與主題直接相關

#### Scenario: 提供方向性指引

- **WHEN** ContentPlanAgent 生成 H2 結構
- **THEN** 可參考方向性指引（問題解決型、比較型、教學型、評測型等）
- **AND** 最終結構由 AI 自主決定
- **AND** 不同主題的文章結構不應雷同

### Requirement: HTMLAgent 安全解析

系統 SHALL 安全解析 HTML 內容，處理各種異常情況。

#### Scenario: 確保 HTML 結構完整

- **WHEN** 輸入的 HTML 缺少 `<!DOCTYPE>`, `<html>`, `<body>` 標籤
- **THEN** 系統自動補充完整的 HTML 結構
- **AND** 再進行解析處理

#### Scenario: 處理 null documentElement

- **WHEN** HTML 解析後 documentElement 為 null
- **THEN** 系統記錄警告日誌
- **AND** 返回原始 HTML 內容
- **AND** 不中斷文章生成流程

### Requirement: tokenUsage 正確記錄

系統 SHALL 在每個 Agent 執行完成後正確記錄 tokenUsage。

#### Scenario: executionInfo 包含 tokenUsage

- **WHEN** 任何 Agent 完成 AI 呼叫
- **THEN** executionInfo 物件包含 tokenUsage 屬性
- **AND** tokenUsage 包含 input, output, total 三個欄位
- **AND** 日誌不顯示「executionInfo 中沒有 tokenUsage 屬性」警告
