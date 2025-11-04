# Proposal: 整合並標準化 AI 模型配置系統

## Why

用戶在生成文章時無法選擇最適合的 AI 模型組合，導致成本控制困難且品質不一致。目前系統存在以下問題：

1. **模型配置不一致**：`ai_models` 表中缺少 `deepseek-reasoner`（但計費系統有），程式碼預設使用的模型與資料庫定義不符
2. **無法區分處理階段**：所有 Agent 都使用相同模型，無法針對簡單任務使用經濟模型、複雜任務使用高階模型
3. **OpenRouter 不穩定**：API 經常無法正常調用，缺乏 retry 和 fallback 機制
4. **Token 計費不透明**：實作了 2x 倍數規則但未明確文件化

這影響了平台的運營成本、用戶體驗和功能擴展性。使用者無法根據需求選擇合適的模型組合，也無法有效控制文章生成成本。

## What Changes

### 資料庫層
1. 新增所有支援的模型到 `ai_models` 表（DeepSeek Reasoner, GPT-4o, Gemini 2.x, Claude Sonnet 4.5）
2. 新增 `processing_tier` 欄位區分複雜處理和簡單功能
3. 更新 `agent_configs` 表支援階段化模型配置
4. 完善 token 計費記錄（2x 倍數）

### Backend/Agent 層
1. Orchestrator 實作智慧模型分配（複雜 vs 簡單處理）
2. 實作 OpenRouter API retry 和 fallback 機制
3. 統一 Perplexity 搜尋整合
4. 完善 Agent 執行記錄和成本追蹤

### Frontend 層
1. 網站設定頁面新增「AI 模型配置」區塊
2. 支援選擇複雜處理和簡單功能的模型
3. 顯示成本預估和模型定價資訊

## 摘要

整合專案中的 AI 模型配置，建立統一的模型管理系統，支援最新的 AI 模型（DeepSeek、OpenAI GPT-4o、Gemini 2.x、Claude Sonnet 4.5），並讓使用者在網站層級配置不同階段的 AI 模型選擇。確保 Perplexity 搜尋功能正常運作作為所有研究階段的資料來源。

## 背景與動機

### 現有問題

1. **模型配置不一致**
   - `ai_models` 表中缺少 `deepseek-reasoner`（但計費系統有）
   - 程式碼預設使用的模型與資料庫定義不符
   - 模型命名混亂（chatgpt-5 vs gpt-4o）

2. **模型選擇機制不清晰**
   - 目前同時存在公司級別和網站級別的配置
   - 無法針對不同處理階段選擇不同模型
   - 缺乏複雜處理（研究、規劃）vs 簡單功能（寫作、分類）的區分

3. **Perplexity 整合狀態不明**
   - 有完整的 `PerplexityClient` 實作
   - Research Agent 有使用，但需要確認其他階段
   - 缺乏明確的資料來源策略文件

### 目標

1. **統一模型清單**：建立標準化的模型列表，包含所有最新模型
2. **階段化模型選擇**：區分複雜處理和簡單功能的模型需求
3. **網站級配置**：在網站設定中預設模型配置
4. **確保 Perplexity 整合**：所有研究階段統一使用 Perplexity

## 支援的 AI 模型與 API 策略

### 文字模型（採用混合 API 策略）

#### DeepSeek 模型 → 使用官方 API
**API 端點**: `https://api.deepseek.com/v1/chat/completions`

**複雜處理（研究、大綱規劃）**
- `deepseek-reasoner` - DeepSeek R1 推理模型，適合深度分析

**簡單功能（寫文章、連結、分類、標籤）**
- `deepseek-chat` - 經濟實惠的對話模型

**優勢**:
- 直接使用最新的 DeepSeek 模型版本
- 更穩定的連接和效能
- 官方技術支援

#### 其他模型 → 使用 OpenRouter
**API 端點**: `https://openrouter.ai/api/v1/chat/completions`

**複雜處理 Fallback**
- `openai/gpt-4o` - GPT-4 優化版本（兩者皆可）
- `google/gemini-2.5-flash` - Gemini 2.5 Flash

**簡單功能 Fallback**
- `openai/gpt-4o` - 可用於兩種處理階段
- `openai/gpt-4o-mini` - GPT-4o 輕量版
- `anthropic/claude-3.5-sonnet` - 兩者皆可

### 圖片模型 → 使用 OpenAI 官方 API
**API 端點**: `https://api.openai.com/v1/images/generations`

- `dall-e-3` - DALL-E 3 圖片生成（固定使用）

**原因**: OpenRouter 目前未明確支援圖片生成模型

### 搜尋來源（已整合且運作正常）
**API 端點**: `https://api.perplexity.ai/chat/completions`

- **Perplexity Sonar** - 統一用於所有研究和資料搜尋
- 已在 Research Agent 中完整實作
- 支援引用來源提取、錯誤處理、Mock 資料 fallback

## 處理階段分類

### 複雜處理階段
1. **Research Agent** - 關鍵字研究、SERP 分析、競爭對手分析
2. **Strategy Agent** - 大綱規劃、內容策略制定

### 簡單功能階段
1. **Writing Agent** - 文章內容生成
2. **Internal Links Agent** - 內部連結建議
3. **External Links Agent** - 外部連結建議
4. **Category Agent** - 文章分類
5. **Tag Agent** - 標籤生成
6. **Meta Agent** - SEO meta 資訊生成

### 固定處理
- **Image Agent** - 使用 `dall-e-3` (OpenAI 官方 API)
- **所有研究** - 使用 Perplexity Sonar 搜尋（已整合）

## 提議的架構

### 1. 資料庫 Schema 更新

```sql
-- 新增 api_provider 欄位區分 API 來源
ALTER TABLE ai_models ADD COLUMN api_provider TEXT CHECK (api_provider IN ('deepseek', 'openrouter', 'openai', 'perplexity'));

-- 更新 ai_models 表，新增缺少的模型
-- DeepSeek 官方 API (不含 provider 前綴)
INSERT INTO ai_models (model_id, model_name, model_type, api_provider, processing_tier, ...) VALUES
  ('deepseek-reasoner', 'DeepSeek Reasoner', 'text', 'deepseek', 'complex', ...),
  ('deepseek-chat', 'DeepSeek Chat', 'text', 'deepseek', 'simple', ...);

-- OpenRouter API (含 provider 前綴)
INSERT INTO ai_models (model_id, model_name, model_type, api_provider, processing_tier, ...) VALUES
  ('openai/gpt-4o', 'GPT-4o', 'text', 'openrouter', 'both', ...),
  ('openai/gpt-4o-mini', 'GPT-4o Mini', 'text', 'openrouter', 'simple', ...),
  ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'text', 'openrouter', 'complex', ...),
  ('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'text', 'openrouter', 'both', ...);

-- OpenAI 官方 API
INSERT INTO ai_models (model_id, model_name, model_type, api_provider, ...) VALUES
  ('dall-e-3', 'DALL-E 3', 'image', 'openai', ...);

-- Perplexity API (搜尋來源)
INSERT INTO ai_models (model_id, model_name, model_type, api_provider, ...) VALUES
  ('sonar', 'Perplexity Sonar', 'search', 'perplexity', ...);

-- 更新 agent_configs 表，支援階段化模型選擇
ALTER TABLE agent_configs ADD COLUMN complex_processing_model TEXT DEFAULT 'deepseek-reasoner';
ALTER TABLE agent_configs ADD COLUMN simple_processing_model TEXT DEFAULT 'deepseek-chat';
```

### 2. 網站配置 UI

在網站設定頁面新增「AI 模型配置」區塊：

```
┌─────────────────────────────────────┐
│ AI 模型配置                          │
├─────────────────────────────────────┤
│ 複雜處理（研究、規劃）               │
│ ▼ DeepSeek Reasoner                 │
│   使用 DeepSeek 官方 API             │
│                                     │
│ 簡單功能（寫作、分類、標籤）          │
│ ▼ DeepSeek Chat                     │
│   使用 DeepSeek 官方 API             │
│                                     │
│ 圖片生成                            │
│   DALL-E 3 (固定)                   │
│   使用 OpenAI 官方 API               │
│                                     │
│ 搜尋來源                            │
│   Perplexity Sonar (固定)           │
│   使用 Perplexity 官方 API           │
└─────────────────────────────────────┘
```

### 3. Agent 執行邏輯更新

```typescript
// orchestrator.ts
const config = await this.getAgentConfig(websiteId);

// 複雜處理階段 - 使用 DeepSeek 官方 API
const researchModel = config.complex_processing_model || 'deepseek-reasoner';
const strategyModel = config.complex_processing_model || 'deepseek-reasoner';

// 簡單功能階段 - 使用 DeepSeek 官方 API
const writingModel = config.simple_processing_model || 'deepseek-chat';
const categoryModel = config.simple_processing_model || 'deepseek-chat';
const tagModel = config.simple_processing_model || 'deepseek-chat';

// 固定模型
const imageModel = 'dall-e-3';  // OpenAI 官方 API
const searchEngine = 'sonar';   // Perplexity 官方 API

// 根據模型選擇 API 客戶端
function getAIClient(modelId: string) {
  // 從 ai_models 表查詢 api_provider
  const model = await getModelInfo(modelId);

  switch (model.api_provider) {
    case 'deepseek':
      return new DeepSeekClient();  // 官方 API
    case 'openrouter':
      return new OpenRouterClient();
    case 'openai':
      return new OpenAIClient();    // 官方 API
    case 'perplexity':
      return new PerplexityClient(); // 官方 API
  }
}
```

## 相關變更

### Spec Deltas
1. `model-configuration` - AI 模型的定義和管理
2. `agent-model-selection` - Agent 如何選擇和使用模型
3. `perplexity-integration` - Perplexity 搜尋的整合和使用

### 技術棧
- Database: Supabase (PostgreSQL)
- Backend: Next.js API Routes
- Frontend: React + TypeScript
- AI Clients: OpenRouter (統一 API)

## 風險與考量

### 技術風險
1. **模型可用性**：某些新模型可能尚未在 OpenRouter 上線
2. **成本控制**：不同模型的定價差異需要透明化
3. **向後相容**：需要處理現有文章的模型配置

### 緩解措施
1. 驗證所有模型在 OpenRouter 的可用性
2. 在 UI 顯示每個模型的相對成本
3. 提供模型 fallback 機制
4. 保留舊配置作為預設值

## 時間估算

- **Spec 撰寫**：2 小時
- **資料庫 Migration**：2 小時
- **Backend API 更新**：4 小時
- **Frontend UI 開發**：4 小時
- **測試與驗證**：4 小時
- **文件撰寫**：2 小時

**總計**：約 2-3 個工作天

## 驗收標準

1. ✅ 所有模型都正確登記在 `ai_models` 表
2. ✅ 網站設定 UI 可以選擇複雜/簡單處理的模型
3. ✅ 所有 Agent 正確使用配置的模型
4. ✅ Perplexity 搜尋在所有研究階段正常運作
5. ✅ 可以成功生成測試文章並驗證每個階段使用的模型
6. ✅ 成本計算正確反映各模型的使用

## 下一步

1. Review 此提案並確認模型名稱的正確性
2. 驗證 OpenRouter 上的模型可用性
3. 開始 Spec 撰寫
4. 實作 Migration 和程式碼變更
5. 撰寫測試文章驗證整個流程
