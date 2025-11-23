# Capability: Token 餘額 API 正確性

## ADDED Requirements

### Requirement: Correct Token Balance Calculation

Token 餘額 API SHALL 正確計算免費方案和付費方案的餘額。

**變更原因**：修正免費方案顯示 20,000 tokens 的錯誤，應該顯示 10,000 tokens

**變更內容**：

- 免費方案判斷邏輯：`monthly_token_quota === 0`
- 免費方案只計算 `purchased_token_balance`（一次性配額）
- 付費方案計算 `monthly_quota_balance + purchased_token_balance`
- 確保回傳的餘額與資料庫一致

#### Scenario: 免費方案用戶查詢 Token 餘額

**Given**：

- 用戶屬於公司 A
- 公司 A 的訂閱方案為免費方案
- `company_subscriptions` 表中：
  - `monthly_token_quota = 0`（標記為免費方案）
  - `purchased_token_balance = 10000`
  - `monthly_quota_balance = 0`

**When**：

- 用戶調用 `GET /api/token-balance`

**Then**：

- API 回傳：
  ```json
  {
    "balance": {
      "total": 10000,
      "monthlyQuota": 0,
      "purchased": 10000
    },
    "subscription": {
      "tier": "free",
      "monthlyTokenQuota": 0,
      "currentPeriodStart": null,
      "currentPeriodEnd": null
    }
  }
  ```
- `balance.total` MUST 等於 `purchased_token_balance`
- `subscription.tier` MUST 為 `"free"`
- `currentPeriodStart` 和 `currentPeriodEnd` MUST 為 `null`

#### Scenario: 付費方案用戶查詢 Token 餘額

**Given**：

- 用戶屬於公司 B
- 公司 B 的訂閱方案為 STARTER（月費 399）
- `company_subscriptions` 表中：
  - `monthly_token_quota = 20000`
  - `monthly_quota_balance = 15000`（剩餘月配額）
  - `purchased_token_balance = 5000`（另外購買）

**When**：

- 用戶調用 `GET /api/token-balance`

**Then**：

- API 回傳：
  ```json
  {
    "balance": {
      "total": 20000,
      "monthlyQuota": 15000,
      "purchased": 5000
    },
    "subscription": {
      "tier": "starter",
      "monthlyTokenQuota": 20000,
      "currentPeriodStart": "2025-01-01T00:00:00Z",
      "currentPeriodEnd": "2025-02-01T00:00:00Z"
    }
  }
  ```
- `balance.total` MUST 等於 `monthly_quota_balance + purchased_token_balance`
- `subscription.monthlyTokenQuota` MUST 為計劃的配額（20000）

### Requirement: Include Plan Details in API Response

Token 餘額 API SHALL 包含方案詳細資訊。

**變更原因**：前端需要方案名稱和功能限制來正確顯示 UI

**變更內容**：

- 查詢 `subscription_plans` 表取得方案詳細資訊
- 回傳方案的 `name`, `slug`, `features`, `limits`

#### Scenario: API 回傳包含方案資訊

**Given**：

- 用戶的訂閱關聯到方案 ID `plan-abc-123`
- 該方案在 `subscription_plans` 表中定義為：
  ```json
  {
    "id": "plan-abc-123",
    "name": "FREE",
    "slug": "free",
    "features": {
      "article_generation": true,
      "wordpress_sites": 0
    },
    "limits": {
      "wordpress_connection": false
    }
  }
  ```

**When**：

- 用戶調用 `GET /api/token-balance`

**Then**：

- API 回傳包含 `plan` 欄位：
  ```json
  {
    "plan": {
      "name": "FREE",
      "slug": "free",
      "features": { "article_generation": true, "wordpress_sites": 0 },
      "limits": { "wordpress_connection": false }
    }
  }
  ```
