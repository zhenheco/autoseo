## Why

目前的 multi-agent pipeline 存在嚴重的穩定性問題：

1. **資料傳遞斷層**：industry/region 資訊在 Agent 間遺失
2. **平行執行失敗率高**：SectionAgent 的 fetch 錯誤導致頻繁 fallback 到 legacy 模式
3. **JSON 解析錯誤**：各 Agent 的 JSON 輸出格式不一致，解析失敗率高
4. **缺乏質檢機制**：沒有像 N8N 那樣的中間驗證步驟
5. **API 調用冗餘**：Research 階段同時調用 AI 和 Perplexity，應改為順序執行
6. **外部連結未使用**：ResearchAgent 收集的 externalReferences 沒有被插入文章
7. **內部連結邏輯薄弱**：沒有主動查詢資料庫，依賴參數傳入
8. **缺乏 Checkpoint 機制**：失敗後必須從頭重跑，浪費已完成階段的 token
9. **Idempotency 檢查不完整**：沒有防止重複處理相同關鍵字

用戶提供的 N8N 工作流程已穩定運行，架構設計值得借鏡。本次重構將以 N8N 流程為藍本，保留現有圖片配置（Gemini Flash 2.5 精選圖 + GPT Image 1 Mini 配圖），重構 pipeline 架構以提升穩定性。

## What Changes

### P0 - 架構重構（核心）

- **採用線性流程替代過度平行化**：參考 N8N 的順序執行模式，僅圖片生成保持平行
- **統一 Context 物件傳遞**：建立 `PipelineContext` 物件，確保 industry/region/language 等資訊在整個流程中保持一致
- **Research 順序執行**：先 Perplexity 研究，再 AI 分析研究結果（不是同時）
- **Checkpoint 機制**：記錄各階段輸出到 DB，失敗時從中斷點繼續
- **Idempotency 檢查**：Pipeline 入口檢查是否已處理過相同關鍵字

### P1 - Agent 整合與簡化

- **合併 StrategyAgent + ContentPlanAgent**：參考 N8N 的 "Content Strategy & Optimization - AI" 節點
- **合併寫作 Agent**：IntroductionAgent, SectionAgent, ConclusionAgent, QAAgent → WritingAgent
- **CategoryAgent 延後執行**：移到發佈階段前，先查詢 WordPress 分類表再讓 AI 選擇

### P2 - 連結處理強化

- **外部連結插入**：ResearchAgent 輸出 referenceMapping，WritingAgent 使用，LinkEnrichmentAgent 轉換為真實超連結
- **內部連結重構**：LinkEnrichmentAgent 主動查詢 DB（取代 Google Sheet），選擇相關文章插入連結
- **SlugValidator**：MetaAgent 增加 Slug 驗證邏輯（中文轉拼音、長度限制、重複檢查）

### P3 - 錯誤處理與品質

- **統一 JSON 解析器**：建立 `AIResponseParser` 類別，處理各種 AI 輸出格式
- **Quality Gate 機制**：在關鍵步驟後驗證輸出品質
- **增強重試邏輯**：統一重試配置，採用指數退避

### P4 - 保留項目（不變更）

- **圖片生成配置**：Gemini Flash 2.5 精選圖 + GPT Image 1 Mini 配圖
- **WordPress 發布流程**：現有 PublishAgent 邏輯不變
- **Token 計費邏輯**：現有計費架構不變

## Impact

- 受影響 specs: `article-generation`（新增）
- 受影響程式碼:
  - `src/lib/agents/orchestrator.ts`（重構核心流程）
  - `src/lib/agents/pipeline-context.ts`（新增，Context 管理）
  - `src/lib/agents/checkpoint-manager.ts`（新增，Checkpoint 機制）
  - `src/lib/ai/json-parser.ts`（新增，統一 JSON 解析）
  - `src/lib/agents/research-agent.ts`（重構，順序執行 + referenceMapping）
  - `src/lib/agents/strategy-agent.ts`（合併 ContentPlanAgent）
  - `src/lib/agents/content-plan-agent.ts`（移除，合併至 strategy-agent）
  - `src/lib/agents/writing-agent.ts`（重構，合併所有寫作功能）
  - `src/lib/agents/section-agent.ts`（移除，合併至 writing-agent）
  - `src/lib/agents/introduction-agent.ts`（移除，合併至 writing-agent）
  - `src/lib/agents/conclusion-agent.ts`（移除，合併至 writing-agent）
  - `src/lib/agents/qa-agent.ts`（移除，合併至 writing-agent）
  - `src/lib/agents/link-enrichment-agent.ts`（重構，處理內外部連結）
  - `src/lib/agents/meta-agent.ts`（增加 SlugValidator）
  - `src/lib/agents/category-agent.ts`（重構，查詢 WordPress 分類表）
  - `src/lib/agents/quality-gate-agent.ts`（新增，品質驗證）
  - `src/types/agents.ts`（更新型別定義）
  - DB schema: `article_jobs` 表增加 `pipeline_state`, `current_phase`, `last_checkpoint` 欄位

## N8N vs 現有架構分析

### N8N 流程優勢

| 特性       | N8N 流程         | 目前架構      | 改進方向         |
| ---------- | ---------------- | ------------- | ---------------- |
| 執行模式   | 線性順序         | 過度平行      | 採用線性為主     |
| 資料傳遞   | 明確的節點輸出入 | 隱式依賴      | 統一 Context     |
| 錯誤處理   | 內建重試         | 各 Agent 獨立 | 統一重試策略     |
| 質檢機制   | 有專門節點       | 無            | 新增 QualityGate |
| Agent 數量 | ~10 個節點       | 15+ 個 Agent  | 整合減少         |
| AI 調用    | 集中管理         | 分散          | 統一 AI Client   |

### N8N 節點對應

```
N8N 節點                    →  目標架構
─────────────────────────────────────────────
Website Config              →  PipelineContext 初始化
Brand Voice                 →  BrandVoice 模組
SERP Analysis              →  ResearchAgent
Competitor Analysis        →  CompetitorAnalysisAgent
Content Strategy           →  StrategyAgent（合併後）
Preliminary Plan           →  ContentPlanAgent（合併後）
Write Blog                 →  WritingAgent（整合後）
Add Internal Links         →  LinkEnrichmentAgent
HTML Version               →  HTMLAgent（簡化）
Quality Check              →  QualityGateAgent（新增）
Generate Meta              →  MetaAgent
Select Categories/Tags     →  CategoryAgent
Image Generation           →  ImageAgent（保持現有配置）
WordPress Publishing       →  PublishAgent
```

## 用戶可能沒想到的問題

### 1. 失敗恢復機制

N8N 支援從失敗節點重新開始，目前架構只能從頭重跑。建議增加 checkpoint 機制。

### 2. Token 消耗優化

N8N 使用 DeepSeek Reasoner 進行策略規劃，比 GPT-4 便宜 10 倍。建議調整 model 選擇策略。

### 3. 內部連結品質

N8N 有專門的 "Add Internal Links" 節點，目前的 LinkEnrichmentAgent 功能較弱。

### 4. Slug/Meta 生成

N8N 分開處理 Slug 和 Meta，確保 SEO 最佳化。目前 MetaAgent 合併處理可能遺漏細節。

### 5. 品類選擇邏輯

N8N 有 AI 驅動的品類選擇，目前 CategoryAgent 可能需要強化。
