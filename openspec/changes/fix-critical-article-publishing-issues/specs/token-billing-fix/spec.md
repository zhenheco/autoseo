# Token 計費修復

## MODIFIED Requirements

### Requirement: AI 模型 Usage 格式標準化

系統 MUST 統一處理不同 AI 供應商返回的 token usage 格式。

#### Scenario: 處理 Anthropic 格式

**Given** 使用 Claude 模型生成文章
**When** API 返回 usage 格式為 `{ input_tokens: 100, output_tokens: 200 }`
**Then** APIRouter 應該標準化為：

```typescript
{
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300
}
```

#### Scenario: 處理 OpenAI 格式

**Given** 使用 GPT-4 模型生成文章
**When** API 返回 usage 格式為 `{ prompt_tokens: 150, completion_tokens: 250, total_tokens: 400 }`
**Then** APIRouter 應該標準化為：

```typescript
{
  promptTokens: 150,
  completionTokens: 250,
  totalTokens: 400
}
```

#### Scenario: 處理缺失 Usage 資料

**Given** AI 模型未返回 usage 資訊
**When** APIRouter 檢測到 `response.usage` 為 undefined
**Then** 應該：

- 記錄警告日誌
- 返回零 tokens：`{ promptTokens: 0, completionTokens: 0, totalTokens: 0 }`
- 允許計費服務使用預估值

### Requirement: Token 計費降級處理

當無法獲取實際 token usage 時，系統 MUST 使用預估值進行計費。

#### Scenario: 使用預估值計費

**Given** AI 響應缺少 usage 資料 (totalTokens === 0)
**When** TokenBillingService 檢測到無效的 usage
**Then** 應該：

- 記錄警告：「No usage data from AI provider, using estimation」
- 使用 `TokenCalculator.estimateArticleTokens()` 計算預估值
- 使用預估的 `chargedTokens` 進行扣除
- 在 `token_usage_logs` 記錄時標記 `metadata.estimation: true`
- 正常完成計費流程，不拋出錯誤

#### Scenario: 正常 Usage 計費

**Given** AI 響應包含有效的 usage 資料
**When** TokenBillingService 處理計費
**Then** 應該：

- 使用實際的 `promptTokens` 和 `completionTokens`
- 調用 `TokenCalculator.calculate()` 計算實際費用
- 記錄完整的 usage 資訊到 `token_usage_logs`
- `metadata.estimation` 欄位不存在或為 false

### Requirement: 詳細 Token 使用日誌

系統 MUST 記錄詳細的 token 使用資訊，便於除錯和審計。

#### Scenario: 記錄 Token 使用

**Given** 任何 AI 模型調用
**When** 計費完成
**Then** `token_usage_logs` 表應包含：

- `model_name`: 使用的模型名稱
- `model_tier`: 'basic' 或 'advanced'
- `model_multiplier`: 費率倍數
- `input_tokens`: 輸入 tokens（實際或預估）
- `output_tokens`: 輸出 tokens（實際或預估）
- `total_official_tokens`: 總官方 tokens
- `charged_tokens`: 實際扣除的 tokens
- `metadata.estimation`: 是否使用預估（布林值）
- `metadata.warning`: 警告訊息（如果有）

#### Scenario: 記錄預估警告

**Given** 使用預估值進行計費
**When** 寫入 `token_usage_logs`
**Then** metadata 應包含：

```json
{
  "estimation": true,
  "warning": "No usage data from AI provider, used estimation"
}
```

## 實作細節

### 修改檔案

- `src/lib/ai/api-router.ts`
  - 添加 `normalizeUsage()` 私有方法
  - 修改 `complete()` 方法調用標準化

- `src/lib/billing/token-billing-service.ts`
  - 修改 `completeWithBilling()` 添加降級處理
  - 添加 usage 有效性檢查
  - 添加詳細日誌

### 相容性

- 向後相容現有所有 AI 模型
- 不影響現有的計費邏輯
- 新增的降級處理只在 usage 無效時觸發

### 錯誤處理

- 不再因為缺少 usage 資料而拋出錯誤
- 使用 console.warn() 記錄警告
- 優雅降級到預估值
