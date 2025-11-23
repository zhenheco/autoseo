# single-payment-api Specification

## Purpose

提供單次購買付款的完整 API 端點，包括訂單建立、付款回調處理和通知處理，支援訂閱方案和代幣套餐的單次購買。

## ADDED Requirements

### Requirement: Single Payment Order Creation API

系統 SHALL 提供 API 端點讓使用者建立單次付款訂單並取得付款表單。

#### Scenario: 建立訂閱方案單次付款訂單

- **WHEN** 使用者 POST `/api/payment/single/create` with `{ planId, paymentType: 'subscription' }`
- **THEN** 系統應：
  - 驗證使用者已登入
  - 驗證 `planId` 存在於 `subscription_plans` 表
  - 生成唯一 `order_no`（格式：`ORD{timestamp}{random}`）
  - 插入 `payment_orders` 記錄：
    - `company_id`: 使用者所屬公司
    - `order_no`: 生成的訂單號
    - `amount`: 方案價格
    - `payment_type`: `subscription`
    - `related_id`: `planId`
    - `status`: `pending`
  - 生成 NewebPay 付款表單
  - 回傳 `{ success: true, orderId, orderNo, paymentForm: { apiUrl, tradeInfo, tradeSha, version, merchantId } }`

#### Scenario: 建立代幣套餐單次付款訂單

- **WHEN** 使用者 POST `/api/payment/single/create` with `{ packageId, paymentType: 'token_package' }`
- **THEN** 系統應：
  - 驗證 `packageId` 存在於 `token_packages` 表
  - 設定 `payment_type` 為 `token_package`
  - 設定 `related_id` 為 `packageId`
  - 其餘流程同上

#### Scenario: 缺少必要參數

- **WHEN** 請求缺少 `paymentType` 或對應的 ID 參數
- **THEN** 系統應：
  - 回傳 `{ error: '缺少必要參數' }` with status 400
  - 不建立任何資料庫記錄

#### Scenario: 未授權的使用者

- **WHEN** 使用者未登入
- **THEN** 系統應：
  - 回傳 `{ error: '未授權' }` with status 401
  - 不執行任何操作

#### Scenario: 方案或套餐不存在

- **WHEN** 指定的 `planId` 或 `packageId` 不存在
- **THEN** 系統應：
  - 回傳 `{ error: '找不到指定的方案或套餐' }` with status 404
  - 不建立訂單記錄

### Requirement: Single Payment Callback Handling

系統 SHALL 處理 NewebPay 的付款回調，更新訂單狀態並處理後續業務邏輯。

#### Scenario: 付款成功回調（訂閱方案）

- **WHEN** NewebPay POST `/api/payment/single/callback` with encrypted `TradeInfo` containing `Status=SUCCESS`
- **THEN** 系統應：
  - 解密 `TradeInfo` 參數
  - 驗證資料完整性（SHA256）
  - 根據 `MerchantOrderNo` 查詢 `payment_orders` 記錄
  - 更新訂單：
    - `status`: `success`
    - `trade_no`: NewebPay 交易號
    - `payment_date`: 授權時間
  - 回傳 HTML 頁面重導向至 `/dashboard/billing?status=success&orderNo={orderNo}`

#### Scenario: 付款成功回調（代幣套餐）

- **WHEN** NewebPay 回調且 `payment_type=token_package`
- **THEN** 系統應（在更新訂單後）：
  - 查詢 `token_packages` 取得代幣數量
  - 更新 `company_tokens.balance`：`balance = balance + tokens`
  - 插入 `token_transactions` 記錄：
    - `company_id`: 公司 ID
    - `amount`: 代幣數量
    - `type`: `purchase`
    - `description`: `購買代幣套餐 - {packageName}`
    - `related_order_id`: 訂單 ID
  - 回傳成功頁面

#### Scenario: 付款失敗回調

- **WHEN** NewebPay 回調 with `Status != SUCCESS`
- **THEN** 系統應：
  - 更新訂單 `status` 為 `failed`
  - 記錄失敗原因（`Message` 欄位）
  - 回傳 HTML 頁面重導向至 `/dashboard/billing?status=failed&reason={reason}`

#### Scenario: 找不到對應訂單

- **WHEN** 回調的 `MerchantOrderNo` 在資料庫中不存在
- **THEN** 系統應：
  - 記錄錯誤日誌：`[Payment Callback] 找不到訂單: {orderNo}`
  - 回傳錯誤頁面顯示「訂單不存在」
  - 不執行任何資料更新

#### Scenario: 重複回調處理

- **WHEN** 收到相同 `MerchantOrderNo` 的多次回調
- **THEN** 系統應：
  - 檢查訂單狀態
  - 如果已是 `success` 或 `failed`，直接回傳成功頁面
  - 不重複執行代幣新增等業務邏輯

### Requirement: Single Payment Notification Handling

系統 SHALL 處理 NewebPay 的付款通知（NotifyURL），與 Callback 邏輯一致但回傳格式不同。

#### Scenario: 接收付款成功通知

- **WHEN** NewebPay POST `/api/payment/single/notify` with encrypted data
- **THEN** 系統應：
  - 執行與 callback 相同的訂單更新邏輯
  - 回傳 `200 OK` with body `SUCCESS`（NewebPay 要求格式）

#### Scenario: 處理通知失敗

- **WHEN** 訂單更新過程中發生錯誤
- **THEN** 系統應：
  - 記錄錯誤日誌
  - 回傳 `200 OK` with body `ERROR`
  - 允許 NewebPay 重試通知（最多 3 次）

#### Scenario: 解密失敗

- **WHEN** 無法解密通知資料
- **THEN** 系統應：
  - 記錄錯誤：`[Payment Notify] 解密失敗`
  - 回傳 `400 Bad Request`
  - 不執行任何資料更新

### Requirement: Payment Authorization Page Enhancement

系統 SHALL 改進授權頁面的錯誤處理和使用者體驗。

#### Scenario: 顯示授權頁面並自動提交

- **WHEN** 使用者導航至 `/dashboard/billing/authorizing?paymentForm={encodedData}`
- **THEN** 頁面應：
  - 解析 `paymentForm` 參數
  - 驗證包含 `apiUrl`, `tradeInfo`, `tradeSha`, `merchantId`
  - 顯示「正在前往授權頁面...」
  - 在 500ms 後自動提交表單到 NewebPay

#### Scenario: 授權頁面超時

- **WHEN** 頁面載入超過 5 秒仍未跳轉
- **THEN** 頁面應：
  - 顯示錯誤訊息：「連接金流服務超時，請重試」
  - 顯示「重新嘗試」按鈕
  - 顯示「返回計費中心」按鈕

#### Scenario: 缺少付款表單資料

- **WHEN** `paymentForm` 參數缺失或無效
- **THEN** 頁面應：
  - 顯示錯誤訊息：「授權資料遺失」
  - 自動在 3 秒後重導向至 `/dashboard/billing`
  - 記錄錯誤到 console

#### Scenario: 表單提交失敗

- **WHEN** 瀏覽器阻擋表單提交或發生 JavaScript 錯誤
- **THEN** 頁面應：
  - 捕獲錯誤並顯示：「提交失敗，請檢查瀏覽器設定」
  - 提供手動提交按鈕
  - 記錄詳細錯誤資訊

### Requirement: Logging and Monitoring

系統 SHALL 記錄所有付款相關操作的詳細日誌，便於除錯和監控。

#### Scenario: 記錄訂單建立

- **WHEN** 建立新訂單
- **THEN** 系統應記錄：
  - `[Payment] 建立訂單: { orderId, orderNo, amount, paymentType, companyId }`
  - 不包含敏感資料（信用卡號、密鑰等）

#### Scenario: 記錄回調處理

- **WHEN** 處理 NewebPay 回調
- **THEN** 系統應記錄：
  - `[Payment Callback] 收到回調: { orderNo, status, tradeNo }`
  - 成功: `[Payment Callback] ✅ 訂單更新成功`
  - 失敗: `[Payment Callback] ❌ 處理失敗: {error}`

#### Scenario: 記錄代幣交易

- **WHEN** 新增代幣到公司帳戶
- **THEN** 系統應記錄：
  - `[Payment] ✅ 代幣已新增: { companyId, amount, newBalance }`

#### Scenario: 記錄錯誤

- **WHEN** 任何付款操作失敗
- **THEN** 系統應記錄：
  - 錯誤類型和訊息
  - 堆疊追蹤（開發環境）
  - 相關的訂單號或交易號
  - 不包含完整的加密資料或密鑰
