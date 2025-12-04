# AI Gateway Header Configuration

## MODIFIED Requirements

### Requirement: Dual Header Mode for Gateway Requests

系統 MUST 在使用 Cloudflare AI Gateway 時同時傳送 provider 的 Authorization header 和 Gateway 的 cf-aig-authorization header。

#### Scenario: DeepSeek API through Gateway

**Given** Gateway 已啟用 (`isGatewayEnabled() === true`)
**And** 環境變數 `DEEPSEEK_API_KEY` 已設定
**And** 環境變數 `CF_AI_GATEWAY_TOKEN` 已設定
**When** 呼叫 DeepSeek API
**Then** request headers 必須包含：

- `Authorization: Bearer ${DEEPSEEK_API_KEY}`
- `cf-aig-authorization: Bearer ${CF_AI_GATEWAY_TOKEN}`

#### Scenario: Direct DeepSeek API (non-Gateway)

**Given** Gateway 未啟用 (`isGatewayEnabled() === false`)
**And** 環境變數 `DEEPSEEK_API_KEY` 已設定
**When** 呼叫 DeepSeek API
**Then** request headers 必須包含：

- `Authorization: Bearer ${DEEPSEEK_API_KEY}`
  **And** 不包含 `cf-aig-authorization`

#### Scenario: Gemini API through Gateway

**Given** Gateway 已啟用
**And** 環境變數 `GEMINI_API_KEY` 已設定
**When** 呼叫 Gemini API
**Then** request headers 必須包含：

- `x-goog-api-key: ${GEMINI_API_KEY}`
- `cf-aig-authorization: Bearer ${CF_AI_GATEWAY_TOKEN}`
  **And** URL 必須包含 `?key=${GEMINI_API_KEY}` 參數

### Requirement: API Key Validation

系統 MUST 在執行 AI API 呼叫前驗證對應的 API Key 是否已設定。

#### Scenario: Missing DeepSeek API Key

**Given** 環境變數 `DEEPSEEK_API_KEY` 未設定
**When** 嘗試呼叫 DeepSeek API
**Then** 拋出錯誤 "DEEPSEEK_API_KEY is not set"

#### Scenario: Missing Gemini API Key

**Given** 環境變數 `GEMINI_API_KEY` 未設定
**When** 嘗試呼叫 Gemini API
**Then** 拋出錯誤 "GEMINI_API_KEY is not set"
