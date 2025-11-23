# onetime-purchase-fix Specification

## Purpose

修復單次購買（Token 包、終身方案）的訂單查詢與處理流程，確保付款成功後能正確更新訂單狀態並通知用戶。

## MODIFIED Requirements

### Requirement: System MUST Create Single Payment Orders with Immediate Persistence

The system SHALL ensure orders are immediately persisted to the database before generating payment forms, and MUST be queryable during payment callbacks.

#### Scenario: Create order before redirecting to payment gateway

- **WHEN** 用戶點擊購買 token 包或終身方案
- **THEN** 系統必須：
  - 在 `/api/payment/onetime/create` 中創建 `payment_orders` 記錄
  - 設定 `status` 為 'pending'
  - 設定 `payment_type` 為 'token_package' 或 'lifetime_subscription'
  - 生成唯一的 `order_no`（格式：`ORD{timestamp}{random}`）
  - **等待資料庫 INSERT 操作完成**（await）
  - 只在訂單成功創建後才生成付款表單
  - 返回付款表單資料給前端

#### Scenario: Verify order exists before payment form generation

- **WHEN** 訂單創建 API 被呼叫
- **THEN** 系統必須：
  - 執行 INSERT 到 `payment_orders` 表
  - 檢查 INSERT 回應的 error 欄位
  - 如果 error 存在，返回錯誤並不生成付款表單
  - 如果成功，記錄 `order.id` 和 `order_no`
  - 使用該 `order_no` 生成 NewebPay 付款表單
  - 確保 `MerchantOrderNo` 與資料庫中的 `order_no` 完全一致

#### Scenario: Order creation fails

- **WHEN** 資料庫 INSERT 失敗（例如：約束違反、連線問題）
- **THEN** 系統必須：
  - 捕獲資料庫錯誤
  - 記錄完整錯誤訊息到 console
  - 返回 `{ success: false, error: '訂單創建失敗' }` 給前端
  - **不生成付款表單**
  - **不重定向用戶到付款頁面**

### Requirement: System MUST Lookup Onetime Callback Orders with Extended Retry

The system MUST use extended retry mechanism to handle database replication delays when processing onetime purchase callbacks.

#### Scenario: Lookup order with 20 retries and progressive delays

- **WHEN** `handleOnetimeCallback` 被 NewebPay 回調觸發
- **THEN** 系統必須：
  - 解密 `TradeInfo` 取得 `MerchantOrderNo`
  - 嘗試從 `payment_orders` 表查詢該 `order_no`
  - 使用 `.maybeSingle()` 避免 PGRST116 錯誤
  - 如果找不到訂單，重試最多 20 次
  - 重試間隔：500ms, 1000ms, 1500ms, 2000ms, 然後固定 2000ms
  - 每次重試記錄嘗試次數和結果
  - 總等待時間約 20-25 秒

#### Scenario: Order found on early attempt

- **WHEN** 訂單在前幾次嘗試中被找到（例如第 3 次）
- **THEN** 系統必須：
  - 停止後續重試
  - 記錄成功訊息：`[PaymentService] 成功找到訂單 (第 N 次嘗試)`
  - 繼續執行訂單狀態更新流程

#### Scenario: Order not found after all retries

- **WHEN** 經過 20 次重試後仍找不到訂單
- **THEN** 系統必須：
  - 記錄錯誤：`[PaymentService] 找不到訂單（已重試20次，總計約20-25秒）`
  - 記錄 `orderNo`, `tradeNo`, 最後的資料庫錯誤
  - 返回 `{ success: false, error: '找不到訂單' }`
  - 讓 ReturnURL handler 重定向用戶到錯誤頁面

### Requirement: System MUST Process Onetime Payment Success

The system SHALL correctly update order status and process business logic after confirming order existence.

#### Scenario: Update order status to success

- **WHEN** NewebPay Status 為 'SUCCESS' 且訂單已找到
- **THEN** 系統必須：
  - 更新 `payment_orders` 表：
    - `status` = 'success'
    - `newebpay_status` = Status
    - `newebpay_message` = Message
    - `newebpay_trade_no` = TradeNo
    - `newebpay_response` = 完整的 decryptedData
    - `paid_at` = 當前時間（ISO 8601）
  - 檢查更新操作的 error
  - 如果更新失敗，返回錯誤
  - 如果更新成功，繼續業務邏輯處理

#### Scenario: Process token package purchase

- **WHEN** 訂單類型為 'token_package' 且狀態更新成功
- **THEN** 系統必須：
  - 查詢 `token_packages` 表取得 token 數量
  - 使用 `related_id` 欄位找到對應的 token 包
  - 更新 `companies` 表的 `seo_token_balance`
  - 增加對應數量的 tokens
  - 記錄操作成功

#### Scenario: Process lifetime subscription purchase

- **WHEN** 訂單類型為 'lifetime_subscription' 且狀態更新成功
- **THEN** 系統必須：
  - 查詢 `subscription_plans` 表取得方案詳情
  - 使用 `related_id` 欄位找到對應的方案
  - 更新 `companies` 表：
    - `subscription_tier` = 對應的 tier（使用 mapPlanSlugToTier）
    - `subscription_ends_at` = NULL（終身方案無到期日）
  - 創建 `payment_orders` 記錄標記為終身購買
  - 記錄操作成功

### Requirement: System MUST Return Callback Error Response

The system MUST return clear error messages to callback handlers when any step fails.

#### Scenario: Return error object on failure

- **WHEN** 任何步驟失敗（解密、查詢、更新、業務邏輯）
- **THEN** 系統必須：
  - 返回 `{ success: false, error: '具體錯誤訊息' }`
  - 錯誤訊息範例：
    - '找不到訂單'
    - '更新訂單狀態失敗'
    - 'Token 包不存在'
    - '更新 Token 餘額失敗'
  - 讓 `/api/payment/callback` route 使用該錯誤訊息重定向用戶

#### Scenario: Redirect user with error status

- **WHEN** `handleOnetimeCallback` 返回 `success: false`
- **THEN** `/api/payment/callback` 必須：
  - 構建重定向 URL：`/dashboard/subscription?payment=failed&error={encodeURIComponent(error)}`
  - 使用 HTML meta refresh 或 JavaScript 重定向
  - 確保錯誤訊息正確傳遞給前端

### Requirement: System MUST Redirect Success Callback

The system SHALL redirect users to subscription page with success message after onetime purchase completion.

#### Scenario: Redirect to subscription page on success

- **WHEN** `handleOnetimeCallback` 返回 `success: true`
- **THEN** `/api/payment/callback` 必須：
  - 構建重定向 URL：`/dashboard/subscription?payment=success`
  - 使用 HTML meta refresh 或 JavaScript 重定向
  - 確保成功狀態傳遞給前端

#### Scenario: Display success message in subscription page

- **WHEN** 用戶被重定向到 `/dashboard/subscription?payment=success`
- **THEN** 頁面必須：
  - 顯示成功訊息（使用 PaymentStatusChecker 或類似組件）
  - 更新顯示的 token 餘額或訂閱狀態
  - 2 秒後自動清除 URL 參數
