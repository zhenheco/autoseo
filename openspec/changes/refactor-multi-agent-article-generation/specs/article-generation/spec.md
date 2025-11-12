# Article Generation (Multi-Agent)

## ADDED Requirements

### Requirement: Specialized Agent Execution
系統 SHALL 使用專門的 agent 生成文章的各個特定部分。

#### Scenario: IntroductionAgent 生成前言
- **GIVEN** StrategyAgent 已完成 outline 規劃且 ImageAgent 已生成 featured image
- **WHEN** Orchestrator 調用 IntroductionAgent
- **THEN** IntroductionAgent SHALL 生成文章前言的 Markdown 內容
- **AND** 如果 featuredImage 存在，SHALL 在前言開頭插入圖片 Markdown `![alt](url)`
- **AND** 前言字數 SHALL 在 150-300 字之間

#### Scenario: SectionAgent 逐段生成內容
- **GIVEN** StrategyAgent 已完成 outline 規劃且 ImageAgent 已為每個 section 生成圖片
- **WHEN** Orchestrator 調用 SectionAgent for each mainSection
- **THEN** SectionAgent SHALL 生成該段落的完整 Markdown 內容
- **AND** 如果該 section 有對應的 sectionImage，SHALL 在段落適當位置插入圖片 Markdown
- **AND** 如果有 previousSummary，SHALL 參考前一段落內容保持文章連貫性
- **AND** SHALL 輸出 summary 供下一個 SectionAgent 使用

#### Scenario: ConclusionAgent 生成結論
- **GIVEN** StrategyAgent 已完成 outline 規劃
- **WHEN** Orchestrator 調用 ConclusionAgent
- **THEN** ConclusionAgent SHALL 生成文章結論的 Markdown 內容
- **AND** 結論 SHALL 總結主要觀點
- **AND** 結論字數 SHALL 在 100-200 字之間

#### Scenario: QAAgent 生成常見問題
- **GIVEN** StrategyAgent 已完成 outline 規劃
- **WHEN** Orchestrator 調用 QAAgent
- **THEN** QAAgent SHALL 生成 3-5 個與文章主題相關的常見問題和答案
- **AND** 每個問題 SHALL 有詳細的答案（至少 50 字）
- **AND** 輸出 SHALL 包含格式化的 FAQ Markdown

#### Scenario: SectionAgent 順序執行保持連貫
- **GIVEN** 有 N 個 mainSections 需要生成
- **WHEN** Orchestrator 執行 SectionAgent
- **THEN** SectionAgent SHALL 按照 outline 中的順序逐個執行
- **AND** 除了第一個 section，每個 SectionAgent SHALL 接收前一個 section 的 summary
- **AND** SectionAgent SHALL 使用 summary 保持段落間的自然過渡

### Requirement: Content Assembly
系統 SHALL 組合所有 agent 生成的內容成完整且連貫的文章。

#### Scenario: 成功組合所有部分
- **GIVEN** 所有內容生成 agent（Introduction, Sections, Conclusion, QA）已成功執行
- **WHEN** Orchestrator 調用 ContentAssemblerAgent
- **THEN** ContentAssemblerAgent SHALL 按順序組合：Introduction + Sections + Conclusion + FAQ
- **AND** SHALL 驗證所有必要部分都存在（至少：title, introduction, 1 section）
- **AND** SHALL 計算完整的統計資料（總字數、段落數、sections 數、FAQs 數）
- **AND** SHALL 輸出完整的 Markdown 文章

#### Scenario: 處理部分內容缺失
- **GIVEN** 某些非關鍵 agent 執行失敗（如 QA 或 Conclusion）
- **WHEN** ContentAssemblerAgent 嘗試組合內容
- **THEN** ContentAssemblerAgent SHALL 使用可用的部分組合文章
- **AND** 如果 Introduction 或所有 Sections 缺失，SHALL 拋出錯誤
- **AND** 缺失的非關鍵部分（QA, Conclusion）SHALL 記錄 warning 但不影響組合

#### Scenario: 驗證文章最低完整度
- **GIVEN** ContentAssemblerAgent 接收到所有內容部分
- **WHEN** 執行組合前的驗證
- **THEN** SHALL 驗證至少包含：標題、前言、至少 1 個 section
- **AND** 總字數 SHALL >= 800 字
- **AND** 如果不符合最低要求，SHALL 拋出 ValidationError

### Requirement: Image Integration
系統 SHALL 在生成內容之前完成所有圖片生成，並在內容中自然插入圖片。

#### Scenario: ImageAgent 優先執行
- **GIVEN** StrategyAgent 已完成 outline 規劃
- **WHEN** 開始內容生成流程
- **THEN** ImageAgent SHALL 在任何內容 agent 執行之前完成
- **AND** SHALL 為 featured image 生成 1 張圖片
- **AND** SHALL 為每個 mainSection 生成 1 張對應的圖片

#### Scenario: 處理圖片生成失敗
- **GIVEN** ImageAgent 為某個 section 生成圖片失敗（經過重試後）
- **WHEN** SectionAgent 生成該 section 的內容
- **THEN** SectionAgent SHALL 檢查 sectionImage 是否為 null
- **AND** 如果為 null，SHALL 生成純文字內容（不插入圖片 Markdown）
- **AND** 內容生成 SHALL 繼續進行，不因圖片失敗而中斷

#### Scenario: 圖片 URL 已永久儲存
- **GIVEN** ImageAgent 生成圖片
- **WHEN** 返回圖片資訊給內容生成 agent
- **THEN** 圖片 SHALL 已上傳到 R2 或 Supabase Storage
- **AND** 返回的 URL SHALL 是永久可訪問的 URL（非 OpenAI 臨時 URL）
- **AND** 如果所有永久儲存失敗，SHALL 使用 OpenAI 臨時 URL 並記錄 warning

### Requirement: Link Insertion Strategy
系統 SHALL 在 HTMLAgent 階段統一處理內部和外部連結的插入。

#### Scenario: 內容生成不插入連結
- **GIVEN** 內容生成 agent（Introduction, Section, Conclusion, QA）執行時
- **WHEN** 生成 Markdown 內容
- **THEN** agent SHALL 專注於內容品質，不插入 internal 或 external links
- **AND** 所有連結插入 SHALL 留給 HTMLAgent 處理

#### Scenario: HTMLAgent 統一插入連結
- **GIVEN** ContentAssemblerAgent 已完成 Markdown 組合
- **WHEN** HTMLAgent 處理完整的 Markdown
- **THEN** HTMLAgent SHALL 使用現有的 `findRelevantKeywords` 邏輯智能插入 internal links
- **AND** SHALL 插入 research 階段準備的 external references
- **AND** SHALL 確保每個連結只插入一次
- **AND** SHALL 確保連結分布自然且均勻

### Requirement: Execution Flow Consistency
系統 SHALL 遵循明確定義的執行順序，確保資料依賴正確。

#### Scenario: 完整執行流程
- **GIVEN** 用戶觸發文章生成
- **WHEN** Orchestrator 執行多 agent 流程
- **THEN** SHALL 按以下順序執行：
  1. Phase 1: ResearchAgent（收集資料和連結）
  2. Phase 2: StrategyAgent（規劃 outline 和選擇標題）
  3. Phase 3: ImageAgent（生成所有圖片）
  4. Phase 4: Content Generation（並行：Intro, Conclusion, QA；順序：Sections）
  5. Phase 5: ContentAssemblerAgent（組合內容）
  6. Phase 6: HTMLAgent（Markdown → HTML + 插入連結）
  7. Phase 7: MetaAgent（生成 meta 資訊，基於完整 HTML）
  8. Phase 8: CategoryAgent（分類建議）

#### Scenario: MetaAgent 需要完整 HTML
- **GIVEN** HTMLAgent 已完成 Markdown → HTML 轉換和連結插入
- **WHEN** Orchestrator 調用 MetaAgent
- **THEN** MetaAgent SHALL 基於完整的 HTML 內容生成 meta description
- **AND** SHALL 從 HTML 提取關鍵字
- **AND** SHALL 生成 SEO 友好的 slug

### Requirement: Batch Parallelization
系統 SHALL 在不影響內容品質的前提下，最大化並行執行以提升效率。

#### Scenario: Batch 1 並行執行
- **GIVEN** ImageAgent 已完成所有圖片生成
- **WHEN** 開始內容生成
- **THEN** Orchestrator SHALL 並行執行：IntroductionAgent, ConclusionAgent, QAAgent
- **AND** SHALL 等待所有 Batch 1 agent 完成後再執行 Batch 2

#### Scenario: Batch 2 順序執行
- **GIVEN** Batch 1（Intro, Conclusion, QA）已完成
- **WHEN** 執行 SectionAgent
- **THEN** Orchestrator SHALL 順序執行每個 SectionAgent
- **AND** 每個 SectionAgent SHALL 等待前一個完成並接收其 summary

### Requirement: StrategyAgent Enhancement
系統 SHALL 強化 StrategyAgent 的 outline 解析能力，減少 "No main sections parsed" 錯誤。

#### Scenario: 強制使用 JSON 輸出
- **GIVEN** StrategyAgent 調用 AI 生成 outline
- **WHEN** 發送 AI 請求
- **THEN** SHALL 使用 `format: 'json'` 參數強制 JSON 輸出
- **AND** SHALL 在 prompt 中明確說明 JSON schema 結構

#### Scenario: 多層 fallback 解析
- **GIVEN** StrategyAgent 接收到 AI 回應
- **WHEN** 嘗試解析 outline
- **THEN** SHALL 按順序嘗試以下解析器：
  1. Direct JSON parsing（`JSON.parse(content)`）
  2. Nested JSON parsing（提取 `{...}` 部分）
  3. Markdown structured parsing（尋找 `### 主要段落` 等標記）
  4. Fallback outline（3 個預設 sections）
- **AND** 每個解析器成功或失敗 SHALL 記錄詳細日誌

#### Scenario: 解析成功率追蹤
- **GIVEN** StrategyAgent 使用某個解析器成功解析 outline
- **WHEN** 完成解析
- **THEN** SHALL 記錄使用的解析器類型（JSON/Nested/Markdown/Fallback）
- **AND** SHALL 記錄 mainSections 數量
- **AND** ErrorTracker SHALL 追蹤每種解析器的成功率
