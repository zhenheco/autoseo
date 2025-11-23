# Article Generation Specification

## ADDED Requirements

### Requirement: HTML 解析器相容性

系統 SHALL 使用與 Vercel 部署環境相容的 HTML 解析器，避免 ESM/CommonJS 衝突。

#### Scenario: 成功解析 HTML 內容

- **WHEN** 系統需要解析 HTML 內容進行內部連結或格式化
- **THEN** 使用 linkedom 進行解析，不產生 ESM 錯誤
- **AND** 解析結果正確反映原始 HTML 結構

#### Scenario: Vercel 部署環境運行

- **WHEN** 系統部署到 Vercel 生產環境
- **THEN** HTML 解析功能正常運作，無 require() ESM 錯誤
- **AND** 所有文章生成流程正常完成

### Requirement: 語言選擇驗證

系統 SHALL 在文章生成流程開始前驗證語言選擇，並提供清晰的錯誤訊息。

#### Scenario: 支援的語言

- **WHEN** 用戶選擇「繁體中文」作為生成語言
- **THEN** 系統正常執行文章生成流程
- **AND** 生成的內容為繁體中文

#### Scenario: 不支援的語言

- **WHEN** 用戶選擇非「繁體中文」的語言
- **THEN** 系統拋出明確的錯誤訊息：「目前僅支援繁體中文」
- **AND** 不執行任何生成流程，避免浪費資源

#### Scenario: 缺少語言選擇

- **WHEN** 用戶未選擇語言
- **THEN** 系統預設使用「繁體中文」
- **OR** 要求用戶選擇語言

### Requirement: 單一標題生成

系統 SHALL 根據用戶選擇的標題生成文章，不生成額外的關鍵字文章。

#### Scenario: 用戶選擇特定標題

- **WHEN** 用戶在標題選項中選擇一個特定標題
- **THEN** 系統僅生成該標題的文章
- **AND** 不生成基於原始關鍵字的額外文章

#### Scenario: 標題選擇追蹤

- **WHEN** 文章生成流程執行
- **THEN** 系統記錄用戶選擇的標題
- **AND** 在所有生成步驟中使用該標題
- **AND** 最終儲存的文章標題與用戶選擇一致

#### Scenario: 多標題選項

- **WHEN** 系統提供多個標題選項給用戶
- **THEN** 用戶可以選擇其中一個
- **AND** 僅選擇的標題會被生成，其他標題不會觸發生成

### Requirement: 生成流程狀態追蹤

系統 SHALL 在文章生成過程中追蹤每個階段的狀態，確保流程可見性。

#### Scenario: 階段狀態更新

- **WHEN** 每個 Agent 完成執行
- **THEN** 系統更新資料庫中的 `current_phase` 狀態
- **AND** 前端可以即時顯示當前階段

#### Scenario: 錯誤處理

- **WHEN** 任何階段發生錯誤
- **THEN** 系統記錄詳細的錯誤訊息和堆疊追蹤
- **AND** 更新 job 狀態為 'failed'
- **AND** 提供可操作的錯誤訊息給用戶
