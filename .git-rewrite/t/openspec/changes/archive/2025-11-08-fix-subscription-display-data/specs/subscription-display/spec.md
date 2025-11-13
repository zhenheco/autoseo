# Subscription Display Specification

## ADDED Requirements

### Requirement: Database-Driven Subscription Display
系統 SHALL 從 `company_subscriptions` 表動態讀取所有訂閱和 Token 相關資料，而非使用硬編碼值。

#### Scenario: 顯示正確的 Token 餘額
- **WHEN** 用戶查看 Dashboard、訂閱頁面或文章管理頁面
- **THEN** 系統應從 `company_subscriptions.monthly_quota_balance` 和 `company_subscriptions.purchased_token_balance` 讀取並顯示正確的 Token 餘額
- **AND** 總餘額應為 `monthly_quota_balance + purchased_token_balance`

#### Scenario: 顯示正確的月配額資訊
- **WHEN** 用戶為付費方案（monthly_token_quota > 0）
- **THEN** 系統應顯示月配額資訊：剩餘 / 總額
- **AND** 應從 `company_subscriptions.monthly_token_quota` 和 `company_subscriptions.monthly_quota_balance` 讀取數據

#### Scenario: 顯示正確的到期日
- **WHEN** 用戶為付費方案（current_period_end 不為 null）
- **THEN** 系統應顯示配額重置日期，從 `company_subscriptions.current_period_end` 讀取
- **WHEN** 用戶為免費方案（current_period_end 為 null）
- **THEN** 系統不應顯示到期日或重置日期

### Requirement: Free Plan Specific Display Logic
系統 SHALL 正確處理免費方案的顯示邏輯，區分一次性 Token 和每月配額。

#### Scenario: 免費方案不顯示到期日
- **WHEN** 用戶為免費方案（subscription_tier = 'free' 且 monthly_token_quota = 0）
- **THEN** 訂閱頁面和 Dashboard 不應顯示「配額重置日」或「到期日」
- **AND** 應顯示「無到期日」或「一次性配額」提示

#### Scenario: 免費方案顯示一次性 Token
- **WHEN** 用戶為免費方案
- **THEN** 系統應顯示購買的 Token 餘額（purchased_token_balance）
- **AND** 不應顯示月配額相關資訊（因為 monthly_token_quota = 0）
- **AND** 應顯示「永不過期」或類似提示

#### Scenario: 免費方案正確的餘額計算
- **WHEN** 用戶為免費方案
- **THEN** 可用 Token 應等於 `purchased_token_balance`
- **AND** 不應包含 `monthly_quota_balance`（因為免費方案無月配額）

### Requirement: Consistent Data Across All Pages
所有顯示訂閱資訊的頁面 SHALL 使用相同的資料來源和計算邏輯。

#### Scenario: Dashboard 和訂閱頁面數據一致
- **WHEN** 用戶在 Dashboard 和訂閱頁面查看 Token 餘額
- **THEN** 兩個頁面應顯示相同的 Token 數量
- **AND** 應使用相同的 API 端點或資料查詢邏輯

#### Scenario: 文章管理頁面數據一致
- **WHEN** 用戶在文章管理頁面查看 Token 餘額
- **THEN** 應與 Dashboard 和訂閱頁面顯示相同的 Token 數量
- **AND** 應從相同的資料來源讀取

#### Scenario: 即時數據更新
- **WHEN** Token 餘額發生變化（例如：使用、購買、重置）
- **THEN** 所有頁面應在重新載入後顯示更新後的數據
- **AND** 不應出現快取導致的數據不一致

### Requirement: Remove Hardcoded Values
系統 SHALL NOT 在前端頁面中硬編碼任何 Token 數量、訂閱層級或會員資格資訊。

#### Scenario: 無硬編碼的 Token 數值
- **WHEN** 檢查前端程式碼
- **THEN** 不應存在硬編碼的 Token 數量（如 10000, 20000）
- **AND** 所有 Token 數值應從 API 或資料庫查詢獲得

#### Scenario: 無硬編碼的訂閱資訊
- **WHEN** 檢查前端程式碼
- **THEN** 訂閱層級、到期日、配額應從資料庫動態讀取
- **AND** 不應在程式碼中直接設定預設值

#### Scenario: 使用正確的資料庫欄位
- **WHEN** 查詢訂閱資訊
- **THEN** 應使用 `company_subscriptions` 表的標準欄位
- **AND** 不應引用過時或錯誤的欄位名稱
