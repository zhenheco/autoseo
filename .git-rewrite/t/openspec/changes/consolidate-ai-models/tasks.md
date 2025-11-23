# Tasks: 整合並標準化 AI 模型配置系統

## Phase 1: 資料準備與驗證 (2-3 小時)

### T1.1 驗證模型可用性

- [ ] 確認 OpenRouter 上所有目標模型的可用性和正確 ID
  - `deepseek/deepseek-reasoner`
  - `deepseek/deepseek-chat`
  - `openai/gpt-4o`
  - `openai/gpt-4o-mini`
  - `google/gemini-2.5-pro` 或 `google/gemini-2.0-flash-exp`
  - `anthropic/claude-sonnet-4.5` 或最新版本
  - `openai/dall-e-3` (查證是否有 mini 版本)
- [ ] 記錄每個模型的官方定價（input/output per 1M tokens）
- [ ] 確認 Perplexity API 的 sonar 模型名稱

**驗證**: 建立測試腳本呼叫每個模型的 API，確保回應正常

### T1.2 審查現有 Perplexity 整合

- [ ] 測試 `PerplexityClient` 的所有方法
- [ ] 確認 Research Agent 正確使用 Perplexity
- [ ] 檢查是否有其他 Agent 需要整合 Perplexity
- [ ] 驗證引用（citations）的擷取和儲存

**驗證**: 執行 Research Agent 測試，確認 Perplexity 回應包含引用來源

## Phase 2: 資料庫 Schema 更新 (2-3 小時)

### T2.1 建立 Migration 檔案

- [ ] 建立 `supabase/migrations/YYYYMMDD_consolidate_ai_models.sql`
- [ ] 新增 `processing_tier` 欄位到 `ai_models` 表
- [ ] 新增所有缺少的模型記錄（含正確定價）
- [ ] 更新 `agent_configs` 表結構
  - 新增 `complex_processing_model` 欄位
  - 新增 `simple_processing_model` 欄位
  - 保留舊欄位以維持向後相容

```sql
-- 範例結構
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS processing_tier TEXT
  CHECK (processing_tier IN ('complex', 'simple', 'both', 'fixed'));

ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS complex_processing_model TEXT DEFAULT 'deepseek/deepseek-reasoner',
  ADD COLUMN IF NOT EXISTS simple_processing_model TEXT DEFAULT 'deepseek/deepseek-chat';
```

**驗證**: 在開發環境執行 migration，確認無錯誤

### T2.2 更新 Token 計費規則

- [ ] 確認 `token_billing_system` 中的計費邏輯
- [ ] 實作 2x token 倍數計算規則：
  - 官方定價不變（顯示給使用者看）
  - 內部計算時 token 數量 × 2
  - 範例：客戶使用 1k tokens，系統記錄 2k tokens，但仍按 1k 的官方價格計費
- [ ] 新增註解說明此倍數計算邏輯

**驗證**: 單元測試驗證計費計算正確

### T2.3 更新種子資料

- [ ] 為現有網站建立預設 `agent_configs`
- [ ] 設定合理的預設模型：
  - `complex_processing_model`: `deepseek/deepseek-reasoner`
  - `simple_processing_model`: `deepseek/deepseek-chat`

**驗證**: 查詢資料庫確認所有網站都有完整配置

## Phase 3: 型別定義更新 (1 小時)

### T3.1 更新 TypeScript 型別

- [ ] 更新 `src/types/agents.ts` 中的 `AgentConfig` 介面
- [ ] 新增 `ProcessingTier` 型別定義
- [ ] 更新 `AIModel` 型別，新增 `processing_tier` 欄位
- [ ] 新增 `ModelPricingInfo` 型別（含官方定價和倍數規則）

```typescript
export type ProcessingTier = "complex" | "simple" | "both" | "fixed";

export interface AgentConfig {
  // ... 現有欄位
  complex_processing_model: string;
  simple_processing_model: string;
  image_model: string; // 固定為 dall-e-3 或 dall-e-3-mini
}

export interface ModelPricingInfo {
  model_id: string;
  official_input_price: number; // 每 1M tokens 的官方價格
  official_output_price: number;
  token_multiplier: number; // 固定為 2.0
  display_price: number; // 顯示給使用者的價格
}
```

**驗證**: TypeScript 編譯無錯誤

## Phase 4: Backend API 更新 (3-4 小時)

### T4.1 更新 Orchestrator

- [ ] 修改 `ParallelOrchestrator.getAgentConfig()` 方法
- [ ] 實作模型選擇邏輯：

  ```typescript
  const complexModel =
    config.complex_processing_model || "deepseek/deepseek-reasoner";
  const simpleModel =
    config.simple_processing_model || "deepseek/deepseek-chat";

  // 複雜處理
  researchAgent.execute({ model: complexModel });
  strategyAgent.execute({ model: complexModel });

  // 簡單功能
  writingAgent.execute({ model: simpleModel });
  categoryAgent.execute({ model: simpleModel });

  // 固定
  imageAgent.execute({ model: "openai/dall-e-3-mini" });
  ```

- [ ] 確保所有 Agent 都正確接收模型參數

**驗證**: 單元測試驗證模型選擇邏輯

### T4.2 更新計費服務

- [ ] 修改 `TokenBillingService.recordUsage()` 方法
- [ ] 實作 2x token 計算邏輯
- [ ] 新增記錄字段區分「實際 tokens」和「計費 tokens」
- [ ] 更新成本計算：`cost = (tokens × 2) × official_price / 1_000_000`

**驗證**: 測試案例驗證計費金額正確

### T4.3 建立模型管理 API

- [ ] `GET /api/ai-models` - 列出所有可用模型（依 processing_tier 分組）
- [ ] `GET /api/ai-models/pricing` - 取得模型定價資訊
- [ ] `PUT /api/websites/[id]/agent-config` - 更新網站的模型配置

**驗證**: Postman 測試所有 API endpoints

## Phase 5: Frontend UI 開發 (4-5 小時)

### T5.1 建立模型選擇元件

- [ ] 建立 `ModelSelector` 元件
  - 支援依 `processing_tier` 過濾模型
  - 顯示模型名稱、描述、相對成本
  - 提供「推薦」標籤
- [ ] 建立 `ModelPricingBadge` 元件顯示成本等級

**驗證**: Storybook 測試元件各種狀態

### T5.2 更新網站設定頁面

- [ ] 在 `src/app/(dashboard)/dashboard/websites/[id]/settings/page.tsx` 新增「AI 模型配置」區塊
- [ ] 整合 `ModelSelector` 元件：

  ```tsx
  <ModelSelector
    label="複雜處理（研究、規劃）"
    tier="complex"
    value={config.complex_processing_model}
    onChange={(model) => updateConfig({ complex_processing_model: model })}
  />

  <ModelSelector
    label="簡單功能（寫作、分類）"
    tier="simple"
    value={config.simple_processing_model}
    onChange={(model) => updateConfig({ simple_processing_model: model })}
  />

  <div className="text-sm text-gray-500">
    <p>圖片生成: DALL-E 3 Mini (固定)</p>
    <p>搜尋來源: Perplexity Sonar (固定)</p>
  </div>
  ```

- [ ] 實作儲存功能
- [ ] 新增載入和錯誤狀態處理

**驗證**: 手動測試選擇和儲存模型配置

### T5.3 更新成本預估顯示

- [ ] 在文章生成頁面顯示預估成本
- [ ] 根據選擇的模型計算預估 token 使用量
- [ ] 顯示 2x 倍數的說明提示

**驗證**: 驗證成本計算與實際計費一致

## Phase 6: Perplexity 整合驗證 (2 小時)

### T6.1 確保所有研究階段使用 Perplexity

- [ ] Research Agent: 確認使用 `PerplexityClient.search()`
- [ ] Strategy Agent: 如需外部資料，整合 Perplexity
- [ ] Writing Agent: 確認引用來自 Perplexity 的資料
- [ ] 統一錯誤處理和 fallback 機制

**驗證**: 產生文章時追蹤 API 呼叫，確認使用 Perplexity

### T6.2 優化 Perplexity 使用

- [ ] 實作 cache 機制避免重複查詢
- [ ] 優化查詢 prompt 提升結果品質
- [ ] 確保引用來源正確儲存和顯示

**驗證**: 檢查生成文章包含正確的引用來源

## Phase 7: 測試與驗證 (4-5 小時)

### T7.1 單元測試

- [ ] `OrchestratTests` - 測試模型選擇邏輯
- [ ] `TokenBillingService.test` - 測試 2x 倍數計算
- [ ] `ModelSelector.test` - 測試 UI 元件
- [ ] `PerplexityClient.test` - 測試搜尋功能

**驗證**: 所有測試通過，覆蓋率 > 80%

### T7.2 整合測試

- [ ] 測試案例 1: 使用 `deepseek-reasoner` + `deepseek-chat` 生成文章
- [ ] 測試案例 2: 使用 `gpt-4o` + `gpt-4o-mini` 生成文章
- [ ] 測試案例 3: 使用 `claude-sonnet-4.5` 生成文章
- [ ] 測試案例 4: 驗證 Perplexity 搜尋和引用
- [ ] 測試案例 5: 驗證成本計算（2x 倍數）

**驗證**: 每個案例都成功生成文章，模型和成本記錄正確

### T7.3 生成測試文章

- [ ] 選擇關鍵字：例如「Next.js 15 新功能」
- [ ] 使用不同模型組合生成 3 篇文章
- [ ] 驗證每篇文章的品質和完整性
- [ ] 檢查以下項目：
  - ✅ 研究資料來自 Perplexity
  - ✅ 引用來源正確顯示
  - ✅ 使用正確的模型（記錄在 `agent_executions`）
  - ✅ 成本計算正確（2x 倍數）
  - ✅ 文章結構完整（標題、大綱、內容、分類、標籤、meta）

**驗證**: 測試文章品質符合預期，成本計算正確

## Phase 8: 文件與部署 (2 小時)

### T8.1 更新技術文件

- [ ] 更新 `docs/agents/` 下的 Agent 文件
- [ ] 新增 `docs/ai-models/MODEL_CONFIGURATION.md`
- [ ] 新增 `docs/ai-models/TOKEN_BILLING.md` 說明 2x 倍數規則
- [ ] 更新 `docs/ai-models/PERPLEXITY_INTEGRATION.md`

### T8.2 更新使用者文件

- [ ] 新增「AI 模型配置指南」
- [ ] 說明複雜處理 vs 簡單功能的差異
- [ ] 提供模型選擇建議（效能 vs 成本）
- [ ] 說明計費規則（含 2x 倍數）

### T8.3 部署與監控

- [ ] 執行 database migration
- [ ] 部署到 staging 環境測試
- [ ] 監控錯誤日誌
- [ ] 部署到 production

**驗證**: Production 環境成功生成測試文章

## Dependencies

- T2.x 依賴 T1.x (需要先驗證模型可用性)
- T4.x 依賴 T2.x (需要先更新資料庫)
- T5.x 依賴 T3.x 和 T4.x (需要型別和 API)
- T7.x 依賴所有前面的 tasks
- T8.x 可在 T7.x 完成後開始

## Parallelizable Work

- T3.1 可以與 T2.x 並行
- T4.1 和 T4.2 可以並行
- T5.1 可以在 T3.1 完成後開始，不需等待 T4.x
- T8.1 和 T8.2 可以並行

## Estimated Timeline

- Phase 1-2: Day 1
- Phase 3-4: Day 1-2
- Phase 5: Day 2
- Phase 6-7: Day 2-3
- Phase 8: Day 3

Total: **2-3 工作天**
