# Tasks: Fix Single Purchase Payment Flow

## Phase 1: API 端點實作

### Task 1.1: 實作 `/api/payment/single/create` 端點

- 接收參數：`planId`, `paymentType`, `packageId` (可選)
- 驗證使用者認證和公司會員資格
- 查詢方案或套餐資料
- 建立 `payment_orders` 記錄（status: pending）
- 呼叫 `PaymentService.createSinglePayment()` 生成付款表單
- 回傳 `{ success, orderId, orderNo, paymentForm }`
- **驗證**: 使用 curl 測試 API 回應

### Task 1.2: 實作 `/api/payment/single/callback` 端點

- 接收 NewebPay 回調資料（POST）
- 解密並驗證 `TradeInfo` 參數
- 查詢對應的 `payment_orders` 記錄
- 根據 `Status` 更新訂單狀態：
  - `SUCCESS` -> `success`
  - `FAIL` -> `failed`
- 付款成功時：
  - 更新公司代幣餘額（如果是代幣套餐）
  - 記錄 `token_transactions`
- 回傳 HTML 頁面重導向至 `/dashboard/billing?status=success`
- **驗證**: 模擬 NewebPay 回調測試

### Task 1.3: 實作 `/api/payment/single/notify` 端點

- 接收 NewebPay 通知資料（POST）
- 解密並驗證資料
- 執行與 callback 相同的訂單更新邏輯
- 回傳 `200 OK`（NewebPay 要求）
- 新增錯誤重試機制（最多 3 次）
- **驗證**: 測試與 callback 的資料一致性

## Phase 2: PaymentService 擴充

### Task 2.1: 實作 `createSinglePayment()` 方法

- 參數：`companyId`, `planId`, `amount`, `description`, `email`, `paymentType`
- 生成唯一 `order_no`（格式：`ORD{timestamp}{random}`）
- 插入 `payment_orders` 記錄
- 呼叫 `NewebPayService.encryptTradeInfo()` 生成付款表單
- 回傳 `{ success, orderId, orderNo, paymentForm }`
- **驗證**: 單元測試驗證訂單建立和表單生成

### Task 2.2: 實作 `handleSinglePaymentCallback()` 方法

- 參數：解密後的回調資料
- 查詢 `payment_orders` 記錄
- 更新訂單狀態和付款資訊
- 如果是代幣套餐：
  - 更新 `company_tokens.balance`
  - 插入 `token_transactions` 記錄
- 回傳處理結果
- **驗證**: 模擬成功和失敗情境

## Phase 3: 前端整合

### Task 3.1: 改進 `authorizing` 頁面錯誤處理

- 新增超時檢測（5 秒無回應顯示錯誤）
- 改進錯誤訊息顯示
- 新增「重新嘗試」按鈕
- 新增「返回計費中心」按鈕
- **驗證**: 測試各種錯誤情境

### Task 3.2: 修正計費頁面的付款按鈕邏輯

- 區分單次購買和定期定額
- 單次購買呼叫 `/api/payment/single/create`
- 定期定額呼叫 `/api/payment/recurring/create`
- 統一錯誤處理
- **驗證**: E2E 測試完整流程

### Task 3.3: 實作付款成功頁面

- 顯示訂單資訊
- 顯示代幣餘額（如適用）
- 提供「返回首頁」和「查看訂單」按鈕
- **驗證**: 視覺測試

## Phase 4: 測試與驗證

### Task 4.1: 整合測試

- 測試單次購買完整流程：
  1. 選擇方案
  2. 建立訂單
  3. 跳轉授權頁面
  4. 模擬 NewebPay 回調
  5. 驗證訂單狀態和代幣餘額
- **驗證**: 所有步驟成功完成

### Task 4.2: 錯誤情境測試

- 測試付款失敗情境
- 測試網路錯誤
- 測試超時情境
- 測試重複回調
- **驗證**: 錯誤處理正確

### Task 4.3: 日誌驗證

- 檢查所有關鍵步驟有日誌記錄
- 驗證敏感資料不出現在日誌中
- 確認錯誤日誌包含足夠除錯資訊
- **驗證**: 日誌分析

## Phase 5: 文件更新

### Task 5.1: 更新 API 文件

- 記錄新增的 3 個端點
- 說明請求/回應格式
- 提供範例
- **驗證**: 文件完整性

### Task 5.2: 更新 OpenSpec specs

- 更新 `payment-processing` spec
- 更新 `payment-callbacks` spec
- **驗證**: `openspec validate` 通過

## Dependencies

- Task 1.2 依賴 Task 2.2
- Task 1.3 依賴 Task 2.2
- Task 3.2 依賴 Task 1.1
- Task 4.1 依賴 Phases 1-3

## Parallel Work Opportunities

- Phase 1 和 Phase 2 可並行開發
- Task 3.1 可在 Phase 1 完成後立即開始
