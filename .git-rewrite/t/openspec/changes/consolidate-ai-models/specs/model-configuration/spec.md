# Spec: AI 模型配置管理

## ADDED Requirements

### Requirement: The system MUST support tier-based model classification

系統必須支援將 AI 模型分類為不同的處理階段，以便使用者根據任務複雜度選擇適當的模型。

#### Scenario: 查詢複雜處理模型列表

**Given** 使用者在網站設定頁面
**When** 使用者請求「複雜處理」階段的可用模型
**Then** 系統應回傳所有 `processing_tier` 為 `'complex'` 或 `'both'` 的文字模型
**And** 每個模型應包含：
- 模型 ID (`model_id`)
- 顯示名稱 (`model_name`)
- 提供商 (`provider`)
- 官方定價資訊 (`pricing.input_per_1m`, `pricing.output_per_1m`)
- 能力標籤 (`capabilities`)
- Context window 大小

#### Scenario: 查詢簡單功能模型列表

**Given** 使用者在網站設定頁面
**When** 使用者請求「簡單功能」階段的可用模型
**Then** 系統應回傳所有 `processing_tier` 為 `'simple'` 或 `'both'` 的文字模型
**And** 回傳格式與複雜處理模型相同

#### Scenario: 查詢固定用途模型

**Given** 使用者查看模型配置
**When** 使用者查詢圖片生成或搜尋來源模型
**Then** 系統應顯示固定模型且不可變更：
- 圖片生成: `openai/dall-e-3` 或 `openai/dall-e-3-mini`
- 搜尋來源: `perplexity-sonar`

---

### Requirement: The system MUST support all major AI model providers

系統必須在 `ai_models` 表中正確登記所有支援的模型，包含準確的定價資訊。

#### Scenario: DeepSeek 模型完整支援

**Given** 資料庫中的 `ai_models` 表
**When** 查詢 DeepSeek 提供商的模型
**Then** 系統應包含以下模型：
- `deepseek/deepseek-reasoner` (processing_tier: complex)
- `deepseek/deepseek-chat` (processing_tier: simple)
**And** 每個模型都應有正確的官方定價資訊

#### Scenario: OpenAI 最新模型支援

**Given** 資料庫中的 `ai_models` 表
**When** 查詢 OpenAI 提供商的模型
**Then** 系統應包含以下模型：
- `openai/gpt-4o` (processing_tier: both)
- `openai/gpt-4o-mini` (processing_tier: simple)
- `openai/dall-e-3` (model_type: image)
**And** 每個模型都應有正確的官方定價資訊

#### Scenario: Google Gemini 2.x 模型支援

**Given** 資料庫中的 `ai_models` 表
**When** 查詢 Google 提供商的模型
**Then** 系統應包含以下模型：
- `google/gemini-2.5-pro` 或 `google/gemini-pro-exp` (processing_tier: complex)
- `google/gemini-2.0-flash` 或 `google/gemini-2.0-flash-exp` (processing_tier: simple)
**And** 每個模型都應有正確的官方定價資訊

#### Scenario: Anthropic Claude Sonnet 4.5 支援

**Given** 資料庫中的 `ai_models` 表
**When** 查詢 Anthropic 提供商的模型
**Then** 系統應包含以下模型：
- `anthropic/claude-sonnet-4.5` 或最新版本 (processing_tier: both)
**And** 模型應有正確的官方定價資訊

---

### Requirement: The system MUST implement 2x token billing multiplier

系統必須實作 2x token 倍數的計費規則，使用者使用的 token 數量將乘以 2 作為計費基礎。

#### Scenario: 記錄 token 使用量時套用 2x 倍數

**Given** Agent 完成執行並回傳 token 使用量
**When** 系統記錄到 `token_billing_records` 表
**Then** 應同時記錄：
- `raw_input_tokens`: API 回傳的實際輸入 tokens
- `raw_output_tokens`: API 回傳的實際輸出 tokens
- `billable_input_tokens`: `raw_input_tokens × 2`
- `billable_output_tokens`: `raw_output_tokens × 2`
- `multiplier`: 固定為 `2.0`

#### Scenario: 計算成本時使用計費 tokens

**Given** 記錄在 `token_billing_records` 中的使用量
**When** 計算總成本
**Then** 成本公式應為：
```
total_cost = (billable_input_tokens × official_input_price / 1_000_000)
           + (billable_output_tokens × official_output_price / 1_000_000)
```
**And** 使用的是計費 tokens，而非原始 tokens

#### Scenario: 向使用者顯示成本資訊

**Given** 使用者查看文章生成成本
**When** 系統顯示成本明細
**Then** 應包含以下資訊：
- 使用的模型名稱
- 原始 token 數量 (`raw_input_tokens`, `raw_output_tokens`)
- 官方定價 (per 1M tokens)
- 總成本
- 註明「計費包含平台服務費用 (2x tokens)」

---

### Requirement: The system MUST validate model availability

系統必須在新增或啟用模型前，驗證模型在 OpenRouter 上的可用性。

#### Scenario: 驗證新模型的 API 可用性

**Given** 管理員嘗試新增一個新模型
**When** 系統執行模型可用性測試
**Then** 應執行以下檢查：
1. 發送測試 prompt 到 OpenRouter API
2. 驗證回應狀態碼為 200
3. 驗證回應包含有效的 content
4. 記錄測試結果和回應時間

#### Scenario: 模型不可用時的處理

**Given** 測試發現模型無法正常回應
**When** 系統嘗試啟用該模型
**Then** 應：
1. 將模型標記為 `is_active: false`
2. 記錄錯誤訊息
3. 通知管理員模型不可用
4. 不允許使用者選擇該模型

#### Scenario: OpenRouter API 不穩定時的 Fallback

**Given** OpenRouter API 回應緩慢或間歇性失敗
**When** Agent 嘗試呼叫模型
**Then** 系統應：
1. 實作 retry 機制（最多 3 次，間隔 2 秒）
2. 記錄每次 API 呼叫的狀態
3. 如果所有 retry 都失敗，嘗試 fallback 模型鏈
4. 記錄 OpenRouter 不穩定事件供監控

---

### Requirement: The system MUST sync model pricing information

系統必須定期從 OpenRouter 同步最新的模型定價資訊，確保計費準確。

#### Scenario: 定期同步模型定價

**Given** 系統設定為每日同步模型定價
**When** Cron job 執行同步任務
**Then** 應：
1. 從 OpenRouter API 獲取最新定價
2. 比較與資料庫中的定價差異
3. 更新 `ai_models` 表中的 `pricing` 欄位
4. 記錄同步日誌

#### Scenario: 定價變更通知

**Given** 同步過程中發現模型定價變更
**When** 更新完成
**Then** 應：
1. 記錄變更歷史（舊價格、新價格、變更時間）
2. 通知管理員定價已變更
3. 在 UI 顯示「定價已更新」標籤

---

## MODIFIED Requirements

### Requirement: The system MUST update agent_configs table structure

`agent_configs` 表必須支援新的階段化模型配置欄位，同時保留舊欄位以維持向後相容。

#### Scenario: 使用新欄位配置模型

**Given** 網站管理員在設定頁面
**When** 管理員選擇複雜處理模型為 `deepseek/deepseek-reasoner`
**And** 選擇簡單功能模型為 `deepseek/deepseek-chat`
**Then** 系統應更新 `agent_configs` 表：
- `complex_processing_model = 'deepseek/deepseek-reasoner'`
- `simple_processing_model = 'deepseek/deepseek-chat'`

#### Scenario: 向後相容舊配置

**Given** 現有網站使用舊欄位配置（`research_model`, `writing_model` 等）
**When** 系統載入 agent 配置
**Then** 應：
1. 優先使用新欄位（`complex_processing_model`, `simple_processing_model`）
2. 如果新欄位為 NULL，則 fallback 到舊欄位：
   - `complex_processing_model` fallback 到 `research_model` 或 `strategy_model`
   - `simple_processing_model` fallback 到 `writing_model`

#### Scenario: Migration 腳本遷移舊配置

**Given** 執行 database migration
**When** Migration 腳本運行
**Then** 應：
1. 為所有現有記錄填充新欄位：
   - `complex_processing_model = COALESCE(research_model, 'deepseek/deepseek-reasoner')`
   - `simple_processing_model = COALESCE(writing_model, 'deepseek/deepseek-chat')`
2. 保留舊欄位的值不變

---

## REMOVED Requirements

無移除需求。所有現有功能保留，僅新增和修改。

---

## Cross-References

- Related to: `agent-model-selection` - Agent 如何使用這些配置
- Related to: `perplexity-integration` - 搜尋來源的模型選擇
- Depends on: Database migration 必須先完成才能使用新欄位

---

## Non-Functional Requirements

### Performance
- 模型列表 API 回應時間 < 200ms (含快取)
- 模型可用性測試 < 5 秒超時
- Token 計費記錄寫入 < 100ms

### Reliability
- 模型可用性檢查每 5 分鐘執行一次
- OpenRouter API retry 機制: 3 次，指數退避
- 計費記錄必須保證寫入（transaction + retry）

### Security
- API Keys 儲存在環境變數，不存入資料庫
- 模型定價只能由管理員更新
- 計費記錄只能由系統寫入，使用者只能讀取

### Monitoring
- 追蹤每個模型的成功率和回應時間
- 追蹤 OpenRouter API 的可用性
- 追蹤定價同步的成功/失敗次數
