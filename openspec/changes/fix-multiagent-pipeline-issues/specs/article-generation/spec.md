# article-generation Specification (MODIFIED)

## MODIFIED Requirements

### Requirement: Unified JSON Parsing

系統 SHALL 使用統一的 JSON 解析器處理所有 AI 輸出，包含移除 AI 思考過程的能力。

#### Scenario: Parse AI response with multiple strategies

- **WHEN** 收到 AI 回應
- **THEN** 若模型支援 JSON Mode，優先使用 `response_format: { type: "json_object" }`
- **AND** 依序嘗試：直接解析 → 移除 Markdown 包裝 → 結構化提取（括號平衡） → 正則提取
- **AND** 結構化提取為語言無關方案：找到第一個 `{` 或 `[`，使用括號平衡演算法提取完整 JSON
- **AND** 使用 Zod schema 驗證解析結果的結構完整性
- **AND** 解析失敗時，使用更嚴格的 prompt 重試一次
- **AND** 重試仍失敗時使用 fallback 值並記錄 root cause
- **AND** 在 prompt 結尾加上「⚠️ 只輸出 JSON，直接以 { 或 [ 開頭」

#### Scenario: Model capability detection

- **WHEN** 呼叫需要 JSON 輸出的 AI API
- **THEN** 查詢 `MODEL_CAPABILITIES` 表確認模型是否支援 JSON Mode
- **AND** 支援時啟用 `response_format: { type: "json_object" }`
- **AND** 不支援時直接使用解析策略

#### Scenario: Unified parser usage across agents

- **WHEN** Agent 需要解析 JSON 回應
- **THEN** 必須使用 `AIResponseParser.parse(content, schema)` 搭配 Zod schema
- **AND** 各 Agent 定義專屬 schema（TitleOptionsSchema, OutlineSchema 等）
- **AND** 不得在 Agent 內部實作獨立的 `cleanContent` 邏輯
- **AND** 受影響 Agent：StrategyAgent、ContentPlanAgent、UnifiedStrategyAgent

#### Scenario: Parse failure retry

- **WHEN** JSON 解析失敗（所有策略都無法提取有效 JSON）
- **THEN** 使用更嚴格的 prompt 重試一次
- **AND** 重試 prompt 加入「⚠️ 只輸出 JSON，第一個字符必須是 { 或 [，禁止任何解釋」
- **AND** 記錄重試次數和結果至日誌
- **AND** 重試仍失敗時觸發 fallback 並記錄 root cause

#### Scenario: Fallback root cause tracking

- **WHEN** JSON 解析失敗觸發 fallback
- **THEN** 記錄原始回應前 200 字元
- **AND** 記錄使用的模型 ID
- **AND** 記錄失敗的解析策略（直接解析、markdown 移除、思考過程移除、正則提取）
- **AND** 整合至 PipelineLogger

### Requirement: Featured Image Title Handling

FeaturedImageAgent SHALL 使用最終選定的標題（selectedTitle）生成圖片 prompt。

#### Scenario: Use selectedTitle for image generation

- **WHEN** FeaturedImageAgent 生成精選圖片
- **THEN** `buildPrompt()` 優先使用 `input.selectedTitle`
- **AND** 若 `selectedTitle` 不存在，則使用 `input.title`
- **AND** Orchestrator 傳遞 `selectedTitle` 給 FeaturedImageAgent

### Requirement: Industry Field Priority

系統 SHALL 按優先順序處理 industry 欄位：UI 選擇 > 網站設定 > 空值。

#### Scenario: Industry field resolution

- **WHEN** Pipeline 初始化
- **THEN** 優先使用 `input.industry`（來自 UI 下拉選單）
- **AND** 若 UI 未選擇，則使用 `websiteSettings.industry`
- **AND** 若網站設定也沒有，則為空值

#### Scenario: ArticleForm industry auto-fill

- **WHEN** 用戶在 ArticleForm 選擇網站
- **THEN** 若網站有設定 industry，自動帶入下拉選單
- **AND** 用戶可手動更改（UI 值優先）

### Requirement: Quality Gate Validation (Enhanced)

系統 SHALL 在關鍵階段後執行品質驗證，包含更強健的類型檢查。

#### Scenario: HTML output validation

- **WHEN** HTMLAgent 完成
- **THEN** 驗證 HTML 結構完整（標籤配對正確）
- **AND** 驗證不包含 Markdown 語法殘留
- **AND** 驗證 `html` 欄位為字串類型（非物件、非 null、非 undefined）
- **AND** 驗證 `html` 不是 Promise（檢測 `[object Promise]` 問題）
- **AND** 驗證 `html` 不是空字串
- **AND** 驗證 `html` 不是 JSON 物件（不以 `{` 或 `[` 開頭）
- **AND** 若 `html` 是 Promise，await 它取得實際值
- **AND** 若 `html` 不是字串，嘗試從物件的 `html` 屬性提取
- **AND** 若無法提取，從 `markdown` 重新轉換
- **AND** 若仍失敗，使用 fallback HTML

### Requirement: Token Usage Logging

系統 SHALL 正確處理無 tokenUsage 的階段，避免產生過多警告。

#### Scenario: ImageAgent token usage handling

- **WHEN** 計算 Pipeline 總 token 使用量
- **AND** 階段為 ImageAgent 或其他無 tokenUsage 的階段
- **THEN** 不輸出警告訊息
- **AND** 使用 DEBUG 級別日誌或完全跳過

### Requirement: Code Execution Layer

系統 SHALL 實作純代碼執行層，減少對 AI 的依賴，提高穩定性和可預測性。

#### Scenario: Content type selection

- **WHEN** Pipeline 初始化
- **THEN** 使用純代碼邏輯選擇內容類型（教學攻略、推薦清單、比較分析、新聞趨勢、How-to指南）
- **AND** 用戶指定的類型優先，否則隨機選擇
- **AND** 返回對應的寫作風格和結構模板
- **AND** 不依賴 AI 進行此決策

#### Scenario: SERP data analysis

- **WHEN** ResearchAgent 獲取 SERP 數據
- **THEN** 使用純代碼計算競爭程度（極高/高/中/低）
- **AND** 定義權威網站清單（wikipedia、facebook、youtube、shopee、momo 等）
- **AND** 計算前 10 名中權威網站數量
- **AND** 識別內容缺口（tutorial、review、comparison、news、product 類型分佈）
- **AND** 提取相關搜尋和常見問題
- **AND** 不依賴 AI 進行競爭程度計算

#### Scenario: Slug validation

- **WHEN** MetaAgent 生成 slug
- **THEN** 使用純代碼驗證和調整 slug
- **AND** 移除引號和多餘空格
- **AND** 如果太短（< 15 字元），智能添加後綴（guide、tips、best）
- **AND** 如果太長（> 30 字元），智能截斷到最後一個連字符
- **AND** 根據內容類型選擇適當的後綴映射

#### Scenario: Category and tag integration

- **WHEN** AI 完成分類/標籤選擇
- **THEN** 使用純代碼處理 AI 輸出
- **AND** 提取分類 ID 陣列
- **AND** 提取標籤 ID 陣列
- **AND** 若無有效選擇，使用預設分類（ID=1）
- **AND** 確保輸出格式符合 WordPress API 要求
