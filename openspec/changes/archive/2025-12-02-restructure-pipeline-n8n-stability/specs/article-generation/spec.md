## ADDED Requirements

### Requirement: Linear Pipeline Execution

Pipeline 執行 SHALL 採用線性順序模式，僅圖片生成步驟保持平行執行。

#### Scenario: Sequential phase execution

- **WHEN** Pipeline 開始執行
- **THEN** 各階段依序執行：Research → CompetitorAnalysis → Strategy → Writing → LinkEnrichment → HTML → Meta → Image → Category → Publish
- **AND** 每階段完成後才執行下一階段
- **AND** 圖片生成（FeaturedImage + ContentImages）為唯一平行執行步驟
- **AND** CategoryAgent 在 Publish 前執行（需要查詢 WordPress）

### Requirement: Pipeline Context Management

系統 SHALL 維護 `PipelineContext` 物件，確保所有 Agent 共享一致的上下文資訊。

#### Scenario: Context initialization and propagation

- **WHEN** Pipeline 初始化
- **THEN** 建立 PipelineContext 包含 keyword, targetLanguage, industry, region, brandVoice
- **AND** 所有 Agent 從 Context 讀取參數
- **AND** 每階段完成後更新 Context 狀態

### Requirement: Checkpoint and Resume

系統 SHALL 支援 Checkpoint 機制，允許從失敗點恢復執行。

#### Scenario: Save checkpoint after each phase

- **WHEN** 任一階段成功完成
- **THEN** 將該階段輸出儲存至 `article_jobs.pipeline_state`
- **AND** 更新 `current_phase` 為下一階段
- **AND** 更新 `last_checkpoint` 為當前時間

#### Scenario: Resume from checkpoint on failure

- **WHEN** Pipeline 從失敗狀態重新執行
- **THEN** 讀取 `pipeline_state` 中已完成階段的輸出
- **AND** 從 `current_phase` 指示的階段繼續執行
- **AND** 不重複執行已完成的階段

### Requirement: Idempotency Check

系統 SHALL 在 Pipeline 入口檢查 Idempotency，避免重複處理相同請求。

#### Scenario: Duplicate request detection

- **WHEN** 收到文章生成請求
- **THEN** 檢查是否已有相同 `website_id` + `keyword` 的已完成任務
- **AND** 如果存在，返回現有結果而非重新執行

### Requirement: External Link Processing

系統 SHALL 自動插入外部引用連結，並設定正確的 SEO 屬性。

#### Scenario: External reference collection

- **WHEN** ResearchAgent 完成研究
- **THEN** 輸出 `externalReferences` 陣列（含 url, title, type, domain）
- **AND** 輸出 `referenceMapping` 標記各引用適合的段落

#### Scenario: External link insertion

- **WHEN** LinkEnrichmentAgent 處理文章
- **THEN** 將 `[REF:url]` 標記替換為真實超連結
- **AND** 設定 `target="_blank"`
- **AND** 設定 `rel="noopener noreferrer"`
- **AND** 非權威來源加上 `rel="nofollow"`

#### Scenario: Authority source handling

- **WHEN** 外部來源為權威網站（.edu, .gov, 官方文檔）
- **THEN** 不加 `nofollow` 屬性（傳遞權重）

### Requirement: Internal Link Processing

系統 SHALL 主動查詢資料庫，自動插入相關內部連結。

#### Scenario: Query internal articles

- **WHEN** LinkEnrichmentAgent 開始處理
- **THEN** 查詢同網站已發布文章（最近 20 篇）
- **AND** 排除當前正在處理的文章

#### Scenario: Insert internal links

- **WHEN** 查詢到相關文章
- **THEN** AI 分析當前文章與已發布文章的關聯性
- **AND** 選擇 2-3 篇最相關的文章
- **AND** 在適當位置插入內部連結

### Requirement: Slug Validation

MetaAgent SHALL 驗證生成的 Slug 符合 SEO 最佳實踐。

#### Scenario: Slug format validation

- **WHEN** MetaAgent 生成 Slug
- **THEN** 將中文轉換為拼音或英文
- **AND** 移除特殊字符
- **AND** 限制長度在 50 字元內
- **AND** 使用連字符分隔單詞

#### Scenario: Slug uniqueness check

- **WHEN** Slug 生成完成
- **THEN** 查詢資料庫確認 Slug 不重複
- **AND** 如重複則自動添加數字後綴

### Requirement: Category Selection at Publish Time

CategoryAgent SHALL 在發佈階段前執行，從 WordPress 現有分類中選擇。

#### Scenario: Query WordPress categories

- **WHEN** 準備發佈文章
- **THEN** 查詢目標 WordPress 網站的現有分類和標籤
- **AND** AI 從現有選項中選擇最適合的分類

#### Scenario: Skip for non-publish scenario

- **WHEN** 文章不需要發佈
- **THEN** 跳過 CategoryAgent 執行

### Requirement: Quality Gate Validation

系統 SHALL 在關鍵階段後執行品質驗證。

#### Scenario: Research output validation

- **WHEN** ResearchAgent 完成
- **THEN** 驗證 searchIntent, contentGaps, externalReferences 存在且有效

#### Scenario: Writing output validation

- **WHEN** WritingAgent 完成
- **THEN** 驗證字數符合目標範圍
- **AND** 驗證包含所有計劃的 H2 段落
- **AND** 驗證關鍵字密度在合理範圍

#### Scenario: HTML output validation

- **WHEN** HTMLAgent 完成
- **THEN** 驗證 HTML 結構完整（標籤配對正確）
- **AND** 驗證不包含 Markdown 語法殘留

### Requirement: Unified JSON Parsing

系統 SHALL 使用統一的 JSON 解析器處理所有 AI 輸出。

#### Scenario: Parse AI response with multiple strategies

- **WHEN** 收到 AI 回應
- **THEN** 依序嘗試：直接解析 → 移除 Markdown 包裝 → 正則提取 JSON
- **AND** 使用 schema 驗證解析結果
- **AND** 解析失敗時使用 fallback 值

### Requirement: Checkpoint Version Control

系統 SHALL 維護 Checkpoint 版本號，確保程式碼更新後不會讀取不兼容的舊 Checkpoint。

#### Scenario: Version mismatch handling

- **WHEN** 從 Checkpoint 恢復執行
- **THEN** 檢查 `checkpoint_version` 是否與當前程式碼版本一致
- **AND** 如果版本不符，從頭重新執行
- **AND** 記錄 warning log

### Requirement: New Website Internal Link Handling

系統 SHALL 正確處理無已發布文章的新網站。

#### Scenario: No published articles available

- **WHEN** LinkEnrichmentAgent 查詢內部文章
- **AND** 查詢結果為空（新網站）
- **THEN** 跳過內部連結處理
- **AND** 直接返回原內容

### Requirement: Enhanced Idempotency

系統 SHALL 支援時間窗口和強制重新生成選項。

#### Scenario: Time window check

- **WHEN** 收到文章生成請求
- **THEN** 檢查過去 30 天內是否有相同 `website_id` + `normalized_keyword` 的已完成任務
- **AND** 關鍵字正規化（移除空格、統一小寫）

#### Scenario: Force regenerate

- **WHEN** 請求帶有 `force_regenerate: true` 參數
- **THEN** 跳過 Idempotency 檢查
- **AND** 重新生成文章

### Requirement: External Link Quality Control

系統 SHALL 確保外部連結品質並限制數量。

#### Scenario: Dead link detection

- **WHEN** LinkEnrichmentAgent 插入外部連結
- **THEN** 先對 URL 發送 HEAD 請求確認可用
- **AND** 跳過無法訪問的 URL

#### Scenario: Link density limit

- **WHEN** 外部連結數量超過 8 個
- **THEN** 只保留相關性最高的 8 個連結

#### Scenario: Competitor filtering

- **WHEN** 外部來源域名在 `WebsiteSettings.competitor_domains` 清單中
- **THEN** 不插入該連結

### Requirement: LinkEnrichment Output Format

LinkEnrichmentAgent SHALL 輸出 Markdown 格式，由 HTMLAgent 統一轉換為 HTML。

#### Scenario: Markdown link output

- **WHEN** LinkEnrichmentAgent 處理完成
- **THEN** 外部連結輸出為 Markdown 格式 `[anchor](url)`
- **AND** 內部連結輸出為 Markdown 格式 `[標題](/slug)`
- **AND** HTMLAgent 負責轉換為 `<a>` 標籤並設定 rel 屬性

### Requirement: Image Storage Flow

系統 SHALL 先將圖片儲存至 Supabase，發布時再上傳 WordPress。

#### Scenario: Image generation and storage

- **WHEN** ImageAgent 生成圖片
- **THEN** 上傳至 Supabase Storage
- **AND** 儲存 Supabase URL 到 `generated_articles.images`

#### Scenario: WordPress image upload

- **WHEN** PublishAgent 發布文章
- **THEN** 下載 Supabase 圖片並上傳 WordPress Media Library
- **AND** 如上傳失敗，使用 Supabase URL 作為 fallback 並記錄 warning

### Requirement: CJK Word Count

系統 SHALL 根據語言使用不同的字數計算方式。

#### Scenario: CJK language word count

- **WHEN** 目標語言為 zh-TW, zh-CN, ja, ko
- **THEN** 使用字元數（排除空格）計算字數

#### Scenario: Latin language word count

- **WHEN** 目標語言為其他語言
- **THEN** 使用單詞數（以空格分隔）計算字數

### Requirement: Image Generation Configuration

圖片生成 SHALL 使用指定的模型配置。

#### Scenario: Featured image generation

- **WHEN** 生成精選圖片
- **THEN** 使用 Gemini Flash 2.5 模型

#### Scenario: Content image generation

- **WHEN** 生成配圖
- **THEN** 使用 GPT Image 1 Mini 模型

#### Scenario: Parallel execution

- **WHEN** 開始圖片生成階段
- **THEN** FeaturedImage 和 ContentImages 平行執行
