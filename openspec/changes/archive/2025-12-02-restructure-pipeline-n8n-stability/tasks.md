## 1. 基礎設施

### 1.1 PipelineContext 類別

- [x] 1.1.1 建立 `src/lib/agents/pipeline-context.ts`
- [x] 1.1.2 定義 `PipelineContext` interface（包含 keyword, targetLanguage, industry, region, brandVoice 等）
- [x] 1.1.3 定義 `PipelinePhase` enum（research, strategy, writing, html, meta, image, publish）
- [x] 1.1.4 實作 Context 初始化方法
- [x] 1.1.5 實作 Context 更新方法（每階段完成後更新）

### 1.2 Checkpoint 機制

- [x] 1.2.1 建立 `src/lib/agents/checkpoint-manager.ts`
- [x] 1.2.2 DB migration: `article_jobs` 表增加 `pipeline_state` (JSONB), `current_phase` (TEXT), `last_checkpoint` (TIMESTAMP), `checkpoint_version` (INTEGER) 欄位
- [x] 1.2.3 實作 `saveCheckpoint(jobId, phase, output)` 方法
- [x] 1.2.4 實作 `loadCheckpoint(jobId)` 方法
- [x] 1.2.5 實作 `resumeFromCheckpoint(jobId)` 方法
- [x] 1.2.6 在 orchestrator 各階段完成後呼叫 saveCheckpoint
- [x] 1.2.7 實作 Checkpoint 版本控制（版本不符時重新執行）
- [x] 1.2.8 定義 `CHECKPOINT_VERSION` 常數

### 1.3 Idempotency 檢查

- [x] 1.3.1 實作 `normalizeKeyword(keyword)` 方法（移除空格、統一小寫）
- [x] 1.3.2 實作 `checkIdempotency(websiteId, keyword, options)` 方法
- [x] 1.3.3 增加時間窗口檢查（30 天內算重複）
- [x] 1.3.4 支援 `force_regenerate` 參數跳過檢查
- [x] 1.3.5 在 orchestrator 入口增加 idempotency 檢查
- [x] 1.3.6 如果已處理過，返回現有結果而非重新執行

### 1.4 統一 JSON 解析器

- [x] 1.4.1 建立 `src/lib/ai/json-parser.ts`
- [x] 1.4.2 實作 `AIResponseParser` 類別
- [x] 1.4.3 實作 `cleanContent()` 方法（移除 markdown 包裝、思考過程）
- [x] 1.4.4 實作 `extractJSON()` 方法（多種策略提取 JSON）
- [x] 1.4.5 實作 `parse<T>(content, schema)` 方法（使用 zod 驗證）
- [x] 1.4.6 更新所有 Agent 使用統一解析器

## 2. 流程重構

### 2.1 Orchestrator 重構

- [x] 2.1.1 重構 `orchestrator.ts` 為線性執行模式
- [x] 2.1.2 整合 PipelineContext
- [x] 2.1.3 整合 CheckpointManager
- [x] 2.1.4 整合 Idempotency 檢查
- [x] 2.1.5 移除過度平行化邏輯（保留圖片生成平行）
- [x] 2.1.6 調整 Agent 執行順序為：Research → CompetitorAnalysis → Strategy → Writing → LinkEnrichment → HTML → Meta → Image → Category → Publish

### 2.2 ResearchAgent 重構

- [x] 2.2.1 改為順序執行：先 Perplexity 研究，再 AI 分析
- [x] 2.2.2 增加 `referenceMapping` 輸出（標記哪些引用適合哪個段落）
- [x] 2.2.3 更新 `ResearchOutput` 型別定義
- [x] 2.2.4 確保 externalReferences 包含 relevance_score

## 3. Agent 整合

### 3.1 StrategyAgent + ContentPlanAgent 合併

- [x] 3.1.1 將 ContentPlanAgent 邏輯合併至 StrategyAgent
- [x] 3.1.2 更新 StrategyAgent 輸出包含完整大綱（含 H2/H3 結構）
- [x] 3.1.3 更新 `StrategyOutput` 型別定義
- [x] 3.1.4 移除 `content-plan-agent.ts`（標記為 deprecated 或刪除）
- [x] 3.1.5 更新 orchestrator 中的呼叫邏輯

### 3.2 WritingAgent 整合

- [x] 3.2.1 重構 WritingAgent 處理完整文章寫作
- [x] 3.2.2 整合 Introduction 寫作邏輯
- [x] 3.2.3 整合 Section 寫作邏輯（順序執行，每段落使用前一段的 summary）
- [x] 3.2.4 整合 Conclusion 寫作邏輯
- [x] 3.2.5 整合 QA/FAQ 寫作邏輯
- [x] 3.2.6 接收 externalReferences + referenceMapping，在寫作時引用
- [x] 3.2.7 輸出帶有引用標記 [REF:url] 的 Markdown
- [x] 3.2.8 移除 `introduction-agent.ts`
- [x] 3.2.9 移除 `section-agent.ts`
- [x] 3.2.10 移除 `conclusion-agent.ts`
- [x] 3.2.11 移除 `qa-agent.ts`
- [x] 3.2.12 更新 orchestrator 中的呼叫邏輯

## 4. 連結處理

### 4.1 外部連結處理

- [x] 4.1.1 更新 LinkEnrichmentAgent 接收 externalReferences
- [x] 4.1.2 實作 `insertExternalLinks()` 方法（替換 [REF:url] 為 Markdown 連結）
- [x] 4.1.3 輸出 Markdown 格式 `[anchor](url)`（由 HTMLAgent 轉換為 HTML）
- [x] 4.1.4 權威來源（.edu, .gov, 官方文檔）標記不加 nofollow
- [x] 4.1.5 實作 `checkUrlAlive(url)` 死鏈檢測（HEAD 請求）
- [x] 4.1.6 跳過無法訪問的 URL
- [x] 4.1.7 限制最多 8 個外部連結（保留相關性最高的）
- [x] 4.1.8 從 `WebsiteSettings.competitor_domains` 讀取競爭對手域名
- [x] 4.1.9 過濾競爭對手網站（不加入連結）

### 4.2 內部連結處理

- [x] 4.2.1 實作 `queryInternalArticles(websiteId)` 方法（查詢 DB）
- [x] 4.2.2 查詢條件：同網站、已發布、最近 20 篇
- [x] 4.2.3 處理新網站情況（無已發布文章時跳過內部連結）
- [x] 4.2.4 AI 分析當前文章與已發布文章的關聯性
- [x] 4.2.5 選擇 2-3 篇最相關的文章插入連結
- [x] 4.2.6 輸出 Markdown 格式 `[標題](/slug)`
- [x] 4.2.7 更新 `LinkEnrichmentInput` 和 `LinkEnrichmentOutput` 型別

### 4.3 SlugValidator

- [x] 4.3.1 在 MetaAgent 增加 Slug 驗證邏輯
- [x] 4.3.2 實作中文轉拼音（使用 pinyin 套件或自訂邏輯）
- [x] 4.3.3 實作特殊字符過濾
- [x] 4.3.4 實作長度限制（50 字元內）
- [x] 4.3.5 實作重複檢查（查詢 DB 是否已有相同 slug）

## 5. 發佈階段優化

### 5.1 CategoryAgent 重構

- [x] 5.1.1 移動 CategoryAgent 到發佈階段（Publish 前執行）
- [x] 5.1.2 實作 `queryWordPressCategories(siteId)` 方法
- [x] 5.1.3 實作 `queryWordPressTags(siteId)` 方法
- [x] 5.1.4 AI 從現有分類/標籤中選擇（不創建新的）
- [x] 5.1.5 更新 orchestrator 中的呼叫順序

### 5.2 圖片生成（保持現有配置）

- [x] 5.2.1 確認 FeaturedImageAgent 使用 Gemini Flash 2.5
- [x] 5.2.2 確認 ContentImageAgent 使用 GPT Image 1 Mini
- [x] 5.2.3 保持圖片生成平行執行

## 6. 品質保證

### 6.1 QualityGateAgent

- [x] 6.1.1 建立 `src/lib/agents/quality-gate-agent.ts`
- [x] 6.1.2 實作研究階段驗證（research output 完整性）
- [x] 6.1.3 實作策略階段驗證（大綱結構合理性）
- [x] 6.1.4 實作寫作階段驗證（字數、格式、關鍵字密度）
- [x] 6.1.5 實作 HTML 階段驗證（HTML 結構完整性）
- [x] 6.1.6 定義驗證失敗處理邏輯（warning vs error vs fatal）
- [x] 6.1.7 在 orchestrator 各階段後呼叫 QualityGate
- [x] 6.1.8 定義 `QUALITY_THRESHOLDS` 常數（keywordDensity, wordCount, h2Count 等）
- [x] 6.1.9 實作 `countWords(text, language)` 方法（CJK 用字元數，其他用單詞數）

### 6.2 統一重試配置

- [x] 6.2.1 更新 `retry-config.ts` 統一重試配置
- [x] 6.2.2 設定 maxAttempts: 3, initialDelayMs: 2000, backoffMultiplier: 2
- [x] 6.2.3 擴展 retryableErrors 清單
- [x] 6.2.4 確保所有 Agent 使用統一配置

## 7. 型別更新

### 7.1 型別定義

- [x] 7.1.1 更新 `src/types/agents.ts`
- [x] 7.1.2 新增 `PipelineContext` 型別
- [x] 7.1.3 新增 `PipelinePhase` 型別
- [x] 7.1.4 新增 `CheckpointData` 型別
- [x] 7.1.5 更新 `ResearchOutput` 增加 referenceMapping
- [x] 7.1.6 更新 `StrategyOutput` 包含完整大綱
- [x] 7.1.7 更新 `WritingInput` 接收 externalReferences
- [x] 7.1.8 更新 `LinkEnrichmentInput` 和 `LinkEnrichmentOutput`
- [x] 7.1.9 新增 `QualityGateResult` 型別

## 8. 測試與驗證

### 8.1 單元測試

- [x] 8.1.1 PipelineContext 測試
- [x] 8.1.2 CheckpointManager 測試
- [x] 8.1.3 AIResponseParser 測試
- [x] 8.1.4 SlugValidator 測試
- [x] 8.1.5 LinkEnrichmentAgent 測試（內外部連結）

### 8.2 整合測試

- [x] 8.2.1 完整 Pipeline 執行測試
- [x] 8.2.2 Checkpoint 恢復測試（模擬中斷後恢復）
- [x] 8.2.3 Idempotency 測試（重複關鍵字處理）
- [x] 8.2.4 連結插入測試（驗證外部連結正確插入）

### 8.3 回歸測試

- [x] 8.3.1 確認圖片生成正常（Gemini Flash 2.5 + GPT Image 1 Mini）
- [x] 8.3.2 確認 WordPress 發佈正常
- [x] 8.3.3 確認 Token 計費正常
- [x] 8.3.4 確認 GitHub Actions 觸發正常

## 9. 清理與文檔

### 9.1 程式碼清理

- [x] 9.1.1 移除未使用的 Agent 檔案
- [x] 9.1.2 移除 legacy fallback 邏輯（如不再需要）
- [x] 9.1.3 更新 import 路徑

### 9.2 文檔更新

- [x] 9.2.1 更新 CLAUDE.md Pipeline 架構說明
- [x] 9.2.2 更新 DEVLOG.md 記錄重構過程
- [x] 9.2.3 建立 Pipeline 流程圖（Mermaid）

## 10. 運維優化

### 10.1 WebsiteSettings 擴充

- [x] 10.1.1 DB migration: `websites` 表增加 `competitor_domains` (TEXT[]) 欄位
- [x] 10.1.2 更新 `WebsiteSettings` 型別定義
- [x] 10.1.3 在設定介面增加競爭對手域名輸入

### 10.2 GitHub Actions 並發控制

- [x] 10.2.1 更新 `scripts/process-jobs.ts` 使用 `FOR UPDATE SKIP LOCKED`
- [x] 10.2.2 增加 `worker_id` 欄位追蹤處理中的 worker
- [x] 10.2.3 避免多個 worker 同時處理同一 job

### 10.3 Checkpoint 清理

- [x] 10.3.1 建立 `scripts/cleanup-checkpoints.ts`
- [x] 10.3.2 清理 30 天前的 checkpoint 資料
- [x] 10.3.3 新增 GitHub Actions cron job（每天執行）

### 10.4 監控指標

- [x] 10.4.1 定義 `METRICS` 常數（pipeline.success.rate, phase.duration 等）
- [x] 10.4.2 在關鍵節點記錄 metrics
- [x] 10.4.3 整合現有的 PipelineLogger

### 10.5 BrandVoice 預設值

- [x] 10.5.1 定義 `DEFAULT_BRAND_VOICE` 常數
- [x] 10.5.2 在 `getBrandVoice()` 方法增加 fallback 邏輯

### 10.6 快取策略

- [x] 10.6.1 建立 `src/lib/cache/memory-cache.ts`
- [x] 10.6.2 快取 WordPress categories/tags（TTL 5 分鐘）
- [x] 10.6.3 快取內部文章列表（TTL 5 分鐘）
- [x] 10.6.4 快取 WebsiteSettings（TTL 10 分鐘）
