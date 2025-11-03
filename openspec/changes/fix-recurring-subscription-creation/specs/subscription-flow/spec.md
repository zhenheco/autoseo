# Subscription Flow Specification

## MODIFIED Requirements

### Requirement: 訂閱表單提交統一化

訂閱頁面 MUST 使用與單次購買相同的表單提交邏輯，通過授權頁面統一處理。

#### Scenario: 使用者點擊訂閱按鈕

**Given** 使用者在訂閱方案頁面選擇方案

**When** 使用者點擊「訂閱」按鈕

**Then**
- 前端呼叫 `/api/payment/recurring/create` API
- 檢查 `response.ok` 狀態
- 檢查 `data.success` 欄位
- 如果成功，將 `paymentForm` 資料 URL encode 後跳轉到 `/dashboard/billing/authorizing` 頁面
- 授權頁面解析 `paymentForm`，包含 `merchantId`, `postData`, `apiUrl` 欄位
- 自動提交表單到 NewebPay

**And** 如果 API 呼叫失敗
- 顯示詳細錯誤訊息
- 不跳轉到授權頁面

### Requirement: 錯誤處理強化

API 錯誤 MUST 被正確捕獲並顯示給使用者。

#### Scenario: API 回傳錯誤

**Given** API 呼叫失敗或回傳 `success: false`

**When** 前端收到回應

**Then**
- 顯示具體的錯誤訊息（來自 `data.error` 或預設訊息）
- 不進行任何表單提交或頁面跳轉
- 使用者可以重試操作

### Requirement: 後端日誌強化

PaymentService MUST 記錄所有關鍵步驟的詳細日誌。

#### Scenario: 建立定期定額委託

**Given** 系統收到建立委託請求

**When** PaymentService.createRecurringPayment() 執行

**Then**
- 記錄收到的請求參數（planId, periodType 等）
- 記錄生成的委託編號
- 記錄資料庫寫入操作結果
- 如果失敗，記錄完整錯誤堆疊
- 如果成功，記錄委託 ID 和編號

#### Scenario: API 端點處理

**Given** API 端點收到請求

**When** `/api/payment/recurring/create` 執行

**Then**
- 記錄收到的 request body
- 記錄 PaymentService 的回應
- 記錄最終回傳給前端的資料結構
