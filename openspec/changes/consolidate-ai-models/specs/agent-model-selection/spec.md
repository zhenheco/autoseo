# Spec: Agent 模型選擇與執行

## ADDED Requirements

### Requirement: Agents MUST select models based on processing tier

每個 Agent 必須根據其處理階段（複雜處理或簡單功能）從網站配置中選擇適當的模型。

#### Scenario: Research Agent 使用複雜處理模型

**Given** 網站配置的 `complex_processing_model` 為 `deepseek/deepseek-reasoner`
**When** Research Agent 執行關鍵字研究
**Then** Agent 應使用 `deepseek/deepseek-reasoner` 模型進行分析
**And** 記錄到 `agent_executions` 表時 `model_id` 為 `deepseek/deepseek-reasoner`

#### Scenario: Strategy Agent 使用複雜處理模型

**Given** 網站配置的 `complex_processing_model` 為 `claude-sonnet-4.5`
**When** Strategy Agent 執行大綱規劃
**Then** Agent 應使用 `claude-sonnet-4.5` 模型
**And** 記錄模型使用資訊

#### Scenario: Writing Agent 使用簡單功能模型

**Given** 網站配置的 `simple_processing_model` 為 `deepseek/deepseek-chat`
**When** Writing Agent 執行文章生成
**Then** Agent 應使用 `deepseek/deepseek-chat` 模型
**And** 記錄模型使用資訊

#### Scenario: Category/Tag Agent 使用簡單功能模型

**Given** 網站配置的 `simple_processing_model` 為 `gpt-4o-mini`
**When** Category Agent 或 Tag Agent 執行分類/標籤生成
**Then** Agent 應使用 `gpt-4o-mini` 模型
**And** 記錄模型使用資訊

---

### Requirement: Fixed-model agents MUST use designated models

某些 Agent 必須使用固定的模型，不受網站配置影響。

#### Scenario: Image Agent 使用固定圖片模型

**Given** 任何網站配置
**When** Image Agent 執行圖片生成
**Then** Agent 必須使用 `openai/dall-e-3` 或 `openai/dall-e-3-mini`
**And** 不論網站如何配置都保持一致

#### Scenario: 所有研究階段使用 Perplexity

**Given** 任何 Agent 需要即時搜尋資料
**When** Agent 執行搜尋查詢
**Then** 必須使用 Perplexity Sonar 作為搜尋來源
**And** 記錄 Perplexity API 使用量

---

### Requirement: Orchestrator MUST implement model distribution logic

Orchestrator 必須正確分配模型給每個 Agent，並處理 fallback 情況。

#### Scenario: 載入網站模型配置

**Given** Orchestrator 開始執行文章生成流程
**When** 載入網站的 `agent_configs`
**Then** 應提取以下配置：

- `complexModel = config.complex_processing_model || 'deepseek/deepseek-reasoner'`
- `simpleModel = config.simple_processing_model || 'deepseek/deepseek-chat'`
- `imageModel = 'openai/dall-e-3'` (固定)

#### Scenario: 分配模型給各 Agent

**Given** 已載入模型配置
**When** Orchestrator 初始化各 Agent
**Then** 應分配如下：

- Research Agent → `complexModel`
- Strategy Agent → `complexModel`
- Writing Agent → `simpleModel`
- Internal Links Agent → `simpleModel`
- External Links Agent → `simpleModel`
- Category Agent → `simpleModel`
- Tag Agent → `simpleModel`
- Meta Agent → `simpleModel`
- Image Agent → `imageModel` (固定)

#### Scenario: 模型配置缺失時的 Fallback

**Given** 網站的 `agent_configs` 中新欄位為 NULL
**When** Orchestrator 載入配置
**Then** 應 fallback 到預設值：

- `complex_processing_model` → `'deepseek/deepseek-reasoner'`
- `simple_processing_model` → `'deepseek/deepseek-chat'`

---

### Requirement: The system MUST track agent execution records

每個 Agent 執行時必須詳細記錄模型使用資訊，包含成功/失敗狀態和 token 使用量。

#### Scenario: 記錄 Agent 執行開始

**Given** Agent 開始執行
**When** 記錄到 `agent_executions` 表
**Then** 應包含：

- `article_job_id`: 關聯的文章任務 ID
- `agent_name`: Agent 名稱 (research, strategy, writing 等)
- `ai_model_id`: 使用的模型 ID (外鍵到 `ai_models`)
- `started_at`: 開始時間
- `status`: 初始狀態為 `'running'`

#### Scenario: 記錄 Agent 執行完成

**Given** Agent 成功完成執行
**When** 更新 `agent_executions` 記錄
**Then** 應更新：

- `completed_at`: 完成時間
- `status`: `'completed'`
- `execution_time_ms`: 執行時長（毫秒）
- `token_usage`: JSON 格式的 token 使用資訊
  ```json
  {
    "input_tokens": 1000,
    "output_tokens": 2000,
    "total_cost": 0.0044
  }
  ```
- `output_data`: Agent 產生的結果（JSON）

#### Scenario: 記錄 Agent 執行失敗

**Given** Agent 執行過程中發生錯誤
**When** 更新 `agent_executions` 記錄
**Then** 應更新：

- `completed_at`: 失敗時間
- `status`: `'failed'`
- `error_message`: 錯誤訊息
- `retry_count`: 重試次數

---

### Requirement: The system MUST implement model fallback mechanism

當主要模型無法使用時，系統必須自動嘗試 fallback 模型鏈。

#### Scenario: 複雜處理模型 Fallback

**Given** 配置的 `complex_processing_model` 為 `deepseek/deepseek-reasoner`
**When** 該模型 API 呼叫失敗
**Then** 應依序嘗試以下 fallback 模型：

1. `anthropic/claude-sonnet-4.5`
2. `openai/gpt-4o`
3. `google/gemini-2.5-pro`
   **And** 記錄使用了 fallback 模型

#### Scenario: 簡單功能模型 Fallback

**Given** 配置的 `simple_processing_model` 為 `deepseek/deepseek-chat`
**When** 該模型 API 呼叫失敗
**Then** 應依序嘗試以下 fallback 模型：

1. `openai/gpt-4o-mini`
2. `google/gemini-2.0-flash`
3. `anthropic/claude-sonnet-4.5`
   **And** 記錄使用了 fallback 模型

#### Scenario: 所有 Fallback 都失敗

**Given** 主要模型和所有 fallback 模型都無法使用
**When** 嘗試完整個 fallback 鏈
**Then** 應：

1. 記錄 `agent_executions` 狀態為 `'failed'`
2. 記錄錯誤訊息「所有模型都無法使用」
3. 標記文章任務為失敗
4. 通知使用者生成失敗

---

### Requirement: The system MUST handle OpenRouter API instability

系統必須處理 OpenRouter API 的不穩定性，包含 retry 機制和錯誤恢復。

#### Scenario: API 呼叫超時 Retry

**Given** Agent 呼叫 OpenRouter API
**When** 請求超時（> 30 秒）
**Then** 應：

1. 立即 retry，最多 3 次
2. 每次 retry 間隔遞增（2s, 4s, 8s）
3. 記錄每次 retry 的狀態
4. 如果 3 次都超時，嘗試 fallback 模型

#### Scenario: API 回應 5xx 錯誤 Retry

**Given** Agent 呼叫 OpenRouter API
**When** 收到 500, 502, 503 等伺服器錯誤
**Then** 應：

1. 判定為臨時性錯誤，執行 retry
2. 使用指數退避策略
3. 如果仍然失敗，嘗試 fallback 模型

#### Scenario: API 回應 4xx 錯誤不 Retry

**Given** Agent 呼叫 OpenRouter API
**When** 收到 400, 401, 403, 429 等客戶端錯誤
**Then** 應：

1. 不執行 retry（因為 retry 不會成功）
2. 根據錯誤類型處理：
   - 429 (Rate Limit): 等待後重試
   - 401 (Unauthorized): 檢查 API Key
   - 其他: 直接嘗試 fallback 模型

#### Scenario: 記錄 OpenRouter 不穩定事件

**Given** 發生 API 超時、5xx 錯誤或需要 retry
**When** 事件發生
**Then** 應記錄到監控系統：

- 時間戳記
- 模型 ID
- 錯誤類型
- Retry 次數
- 最終結果（成功/失敗/使用 fallback）

---

## MODIFIED Requirements

### Requirement: BaseAgent MUST support model parameters

所有 Agent 的基礎類別必須接受並使用 `model` 參數。

#### Scenario: Agent 初始化時接收模型參數

**Given** Orchestrator 初始化 Agent
**When** 建立 Agent 實例
**Then** 應傳入以下參數：

```typescript
new ResearchAgent({
  model: "deepseek/deepseek-reasoner",
  temperature: 0.3,
  maxTokens: 4000,
  // ... 其他參數
});
```

#### Scenario: Agent 執行時使用指定模型

**Given** Agent 已初始化並指定模型
**When** Agent 執行 `execute()` 方法
**Then** 應使用初始化時指定的模型呼叫 AI API
**And** 不應使用任何硬編碼的模型名稱

---

## REMOVED Requirements

無移除需求。

---

## Cross-References

- Depends on: `model-configuration` - 模型必須先在資料庫中定義
- Related to: `perplexity-integration` - 搜尋階段使用 Perplexity
- Implements: Orchestrator 的執行邏輯

---

## Non-Functional Requirements

### Performance

- Agent 初始化 < 100ms
- 模型選擇邏輯 < 10ms
- Fallback 切換 < 500ms

### Reliability

- Retry 機制確保成功率 > 95%
- Fallback 鏈確保至少有一個模型可用
- OpenRouter 不穩定時自動降級

### Maintainability

- Agent 模型選擇邏輯集中在 Orchestrator
- 每個 Agent 不需要關心模型選擇邏輯
- 新增 Agent 時自動套用模型分配規則

### Monitoring

- 記錄每個模型的成功率和平均回應時間
- 追蹤 Fallback 使用頻率
- 監控 OpenRouter API 的可用性和延遲
