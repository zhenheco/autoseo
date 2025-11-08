# subscription-display-fix Specification

## Purpose
TBD - created by archiving change fix-token-balance-display. Update Purpose after archive.
## Requirements
### Requirement: Plan-Based Token Display
訂閱頁面 SHALL 根據方案類型正確顯示 Token 資訊。

**變更原因**：修正訂閱頁面顯示錯誤的月配額、購買 tokens 和到期日

**變更內容**：
- 免費方案只顯示一次性 Token 餘額
- 付費方案顯示月配額剩餘、購買 tokens、配額重置日
- 移除所有硬編碼的 Token 數量

#### Scenario: 免費方案用戶檢視訂閱頁面

**Given**：
- 用戶的公司訂閱免費方案
- `company_subscriptions` 表中：
  - `monthly_token_quota = 0`
  - `purchased_token_balance = 10000`
  - `current_period_end = null`

**When**：
- 用戶訪問 `/dashboard/subscription` 頁面

**Then**：
- 「目前方案」區塊顯示：
  - 方案類型：「免費方案」
  - Token 餘額：「10,000」
  - 配額類型：「永不過期」
  - 不顯示「月配額」欄位
  - 不顯示「配額重置日」欄位
- Token 餘額 MUST 來自資料庫，不得使用硬編碼值

#### Scenario: 付費方案用戶檢視訂閱頁面

**Given**：
- 用戶的公司訂閱 STARTER 方案
- `company_subscriptions` 表中：
  - `monthly_token_quota = 20000`
  - `monthly_quota_balance = 15000`
  - `purchased_token_balance = 5000`
  - `current_period_end = '2025-02-01T00:00:00Z'`

**When**：
- 用戶訪問 `/dashboard/subscription` 頁面

**Then**：
- 「目前方案」區塊顯示：
  - 方案類型：「STARTER」
  - 月配額：「15,000 / 20,000」（剩餘 / 總額）
  - 購買 Tokens：「5,000」（標註「永不過期」）
  - 配額重置日：「2月 1日」

### Requirement: Dashboard Token Balance Display
Dashboard 頁面 SHALL 正確計算並顯示 Token 餘額。

**變更原因**：修正 Dashboard 顯示錯誤的 Token 餘額（20,000 應為 10,000）

**變更內容**：
- 統一使用 `/api/token-balance` API 取得餘額
- 移除在頁面組件中直接查詢資料庫的邏輯
- 確保免費方案和付費方案的計算邏輯一致

#### Scenario: Dashboard 顯示免費方案 Token 餘額

**Given**：
- 用戶的公司訂閱免費方案
- `/api/token-balance` 回傳：
  ```json
  {
    "balance": { "total": 10000 },
    "subscription": { "tier": "free", "monthlyTokenQuota": 0 }
  }
  ```

**When**：
- 用戶訪問 `/dashboard` 頁面

**Then**：
- `TokenBalanceCard` 組件顯示：
  - Token 餘額：「10,000」
  - 標籤：「免費方案」
  - 提示文字：「一次性 Token 餘額」
- 不顯示使用進度條
- 數值 MUST 來自 API，不得使用組件內的硬編碼值

#### Scenario: Dashboard 顯示付費方案 Token 餘額和使用率

**Given**：
- 用戶的公司訂閱 STARTER 方案
- `/api/token-balance` 回傳：
  ```json
  {
    "balance": { "total": 20000, "monthlyQuota": 15000, "purchased": 5000 },
    "subscription": { "tier": "starter", "monthlyTokenQuota": 20000 }
  }
  ```

**When**：
- 用戶訪問 `/dashboard` 頁面

**Then**：
- `TokenBalanceCard` 組件顯示：
  - Token 餘額：「20,000」
  - 使用進度：「25% 已使用」（5000/20000）
  - 進度條顏色：綠色（使用率 < 70%）
- 使用率計算：`(monthlyTokenQuota - monthlyQuota) / monthlyTokenQuota * 100`

