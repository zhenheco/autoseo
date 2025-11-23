# Article Generation - Spec Delta

## MODIFIED Requirements

### Requirement: HTML 處理與優化

系統 SHALL 接受任何格式的 HTML 輸入（完整文檔或片段），並確保生成有效且優化的 HTML 輸出，適用於 WordPress 和 SEO。

#### Scenario: 處理 HTML 片段輸入

- **GIVEN** WritingAgent 輸出僅包含 HTML 片段（如 `<h2>`, `<p>` 標籤，無 `<html>`, `<body>` 包裹）
- **WHEN** HTMLAgent 處理該片段
- **THEN** 系統 SHALL 自動將片段包裝為完整的 HTML 文檔結構（包含 `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`）
- **AND** 最終輸出僅返回 `<body>` 內容（向後兼容）

#### Scenario: 處理完整 HTML 文檔輸入

- **GIVEN** 輸入已經是完整的 HTML 文檔（包含 `<html>` 標籤）
- **WHEN** HTMLAgent 處理該文檔
- **THEN** 系統 SHALL 直接使用該文檔，不重複包裝
- **AND** 正常執行所有處理步驟（FAQ Schema, 內部連結等）

#### Scenario: HTMLAgent 子功能失敗不中斷流程

- **GIVEN** HTMLAgent 正在處理文章 HTML
- **WHEN** 任何子功能失敗（如 FAQ Schema 插入失敗、內部連結插入失敗）
- **THEN** 系統 SHALL 記錄警告日誌（WARN 級別）
- **AND** 繼續執行其他處理步驟
- **AND** 最終返回可用的 HTML（即使部分功能未成功）
- **AND** 不拋出錯誤導致文章生成流程中斷

#### Scenario: HTMLAgent 完全失敗的安全回退

- **GIVEN** HTMLAgent 遭遇致命錯誤（如 linkedom 解析失敗）
- **WHEN** 錯誤被捕獲
- **THEN** 系統 SHALL 記錄完整錯誤堆疊
- **AND** 返回原始未處理的 HTML
- **AND** 允許文章生成流程繼續（即使 HTML 未優化）

### Requirement: FAQ Schema.org 標記生成

系統 SHALL 自動識別文章中的 FAQ 區域，並生成符合 Schema.org FAQPage 規範的 JSON-LD 標記。

#### Scenario: 識別多語言 FAQ 標題

- **GIVEN** 文章包含 FAQ 區域
- **WHEN** FAQ 區域標題使用以下任一格式：「常見問題」、「FAQ」、「Frequently Asked Questions」、「Q&A」、「問與答」、「qa」（不區分大小寫）
- **THEN** 系統 SHALL 正確識別該區域為 FAQ
- **AND** 解析該區域下的問答對

#### Scenario: 解析 FAQ 問答對

- **GIVEN** 已識別 FAQ 區域
- **WHEN** FAQ 項目格式為 `<h3>Q: 問題</h3>` 後跟包含答案的段落
- **THEN** 系統 SHALL 提取問題文字（移除 "Q:" 前綴）
- **AND** 提取答案文字（移除 "A:" 前綴，如有）
- **AND** 組合成有效的問答對

#### Scenario: 生成 JSON-LD 並插入 body

- **GIVEN** 成功提取至少一個 FAQ 問答對
- **WHEN** 生成 Schema.org JSON-LD
- **THEN** 系統 SHALL 創建 `<script type="application/ld+json">` 標籤
- **AND** 包含符合 FAQPage 規範的 JSON 結構
- **AND** 將該標籤插入 `<body>` 末尾（而非 `<head>`，因為最終僅返回 `body.innerHTML`）
- **AND** 記錄成功日誌，包含 FAQ 項目數量

#### Scenario: 無 FAQ 區域時靜默跳過

- **GIVEN** 文章不包含 FAQ 區域
- **WHEN** HTMLAgent 嘗試插入 FAQ Schema
- **THEN** 系統 SHALL 記錄資訊日誌（INFO 級別）說明未找到 FAQ
- **AND** 不生成 Schema 標記
- **AND** 不拋出錯誤或警告

#### Scenario: FAQ Schema 生成失敗的容錯

- **GIVEN** FAQ 解析或 Schema 生成過程中發生錯誤
- **WHEN** 錯誤被捕獲
- **THEN** 系統 SHALL 記錄警告日誌（包含錯誤詳情）
- **AND** 繼續文章生成流程
- **AND** 不拋出錯誤

## ADDED Requirements

### Requirement: DOM 結構驗證

系統 SHALL 驗證解析後的 DOM 結構完整性，確保必要元素存在。

#### Scenario: 驗證 body 元素存在

- **GIVEN** linkedom 已解析 HTML
- **WHEN** 檢查 `document.body`
- **THEN** 如果 body 元素不存在，系統 SHALL 記錄錯誤
- **AND** 返回原始 HTML（不嘗試處理）
- **AND** 不拋出異常

#### Scenario: 記錄 HTML 解析預覽

- **GIVEN** HTML 解析失敗
- **WHEN** 記錄錯誤日誌
- **THEN** 系統 SHALL 包含以下診斷資訊：
  - HTML 長度（`htmlLength`）
  - HTML 前 200 字符預覽（`htmlPreview`）
  - 完整錯誤物件

### Requirement: 文章列表顯示優化

系統 SHALL 在文章列表中優先顯示文章標題，而非關鍵字。

#### Scenario: 有 metadata.title 時顯示標題

- **GIVEN** 文章記錄包含 `metadata.title`
- **WHEN** 渲染文章列表
- **THEN** `displayTitle` 應為 `metadata.title`
- **AND** 不包含關鍵字前綴

#### Scenario: 無 metadata.title 時顯示關鍵字

- **GIVEN** 文章記錄不包含 `metadata.title`
- **WHEN** 渲染文章列表
- **THEN** `displayTitle` 應為 `keywords.join(', ')`

#### Scenario: 向後兼容舊格式

- **GIVEN** 現有文章可能使用舊的 `${keyword} - ${title}` 格式
- **WHEN** 升級系統後
- **THEN** 舊文章的 `displayTitle` 仍應正常顯示
- **AND** 新生成的文章使用新格式
