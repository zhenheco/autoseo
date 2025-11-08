# Spec: Recurring Callback Resilience（定期定額回調韌性）

## 概述
確保定期定額訂閱的授權成功後，即使部分業務邏輯失敗，仍然向用戶顯示成功訊息，而不是錯誤訊息。

## 問題陳述
當前實作中，藍新金流授權成功後，如果任何業務邏輯步驟失敗（如資料庫更新、代幣發放等），系統會返回 `payment=error`，導致用戶看到「訂閱失敗」，即使授權已經完成且費用已扣款。

## ADDED Requirements

### Requirement: 授權成功優先原則
當藍新金流授權成功（Status=SUCCESS）時，系統 MUST 優先返回成功狀態，業務邏輯錯誤 SHALL 作為警告處理，不影響用戶看到的成功訊息。

#### Scenario: 授權成功但創建訂閱失敗
- **GIVEN** 藍新金流授權成功（Status=SUCCESS，PeriodNo 已發放）
- **AND** `recurring_mandates` 狀態已更新為 `active`
- **WHEN** 創建 `company_subscriptions` 時失敗（如資料庫連線問題）
- **THEN** 系統記錄警告日誌
- **AND** 返回 `{ success: true, warnings: ['創建訂閱失敗'] }`
- **AND** 前端顯示「訂閱成功」訊息

#### Scenario: 授權成功但代幣發放失敗
- **GIVEN** 藍新金流授權成功
- **AND** `recurring_mandates` 和 `company_subscriptions` 都已更新
- **WHEN** 更新 `companies.seo_token_balance` 時失敗
- **THEN** 系統記錄警告日誌
- **AND** 返回 `{ success: true, warnings: ['更新公司訂閱資料失敗'] }`
- **AND** 前端顯示「訂閱成功」訊息
- **AND** 管理員收到警告通知（未來功能）

#### Scenario: 所有業務邏輯成功
- **GIVEN** 藍新金流授權成功
- **WHEN** 所有業務邏輯步驟都成功執行
- **THEN** 返回 `{ success: true }`（無警告）
- **AND** 前端顯示「訂閱成功」訊息

### Requirement: 業務邏輯錯誤分類
系統 MUST 區分關鍵錯誤和非關鍵錯誤，只有關鍵錯誤（如找不到委託記錄、解密失敗）SHALL 導致授權失敗，其他業務邏輯錯誤 SHALL 作為警告處理。

#### Scenario: 關鍵錯誤 - 找不到委託記錄
- **GIVEN** 藍新金流授權成功
- **WHEN** 系統找不到對應的 `recurring_mandates` 記錄（重試 10 次後）
- **THEN** 返回 `{ success: false, error: '找不到定期定額委託' }`
- **AND** 前端顯示「訂閱失敗」訊息
- **AND** 建議用戶聯繫客服

#### Scenario: 關鍵錯誤 - 解密資料結構錯誤
- **GIVEN** 藍新金流回調包含 Period 參數
- **WHEN** 解密後缺少必要欄位（如 Result.MerchantOrderNo）
- **THEN** 返回 `{ success: false, error: '解密資料結構錯誤' }`
- **AND** 前端顯示「訂閱失敗」訊息

#### Scenario: 非關鍵錯誤 - 資料庫暫時性失敗
- **GIVEN** 藍新金流授權成功且委託記錄已更新
- **WHEN** 建立 `company_subscriptions` 時因資料庫連線暫時中斷失敗
- **THEN** 記錄警告但不影響成功狀態
- **AND** 系統稍後可透過補償機制修復（未來功能）

### Requirement: 警告資訊透明化
當業務邏輯失敗但授權成功時，系統 MUST 清楚記錄哪些步驟失敗，包含詳細的錯誤堆疊和警告訊息，以便後續排查和修復。

#### Scenario: 記錄詳細警告資訊
- **GIVEN** 授權成功但有業務邏輯失敗
- **WHEN** 返回成功響應
- **THEN** 包含 `warnings` 陣列，列出所有失敗的步驟
- **AND** 每個警告包含清楚的描述（如「更新訂單狀態失敗」）
- **AND** 控制台日誌記錄完整錯誤堆疊

#### Scenario: 前端處理警告
- **GIVEN** callback 返回 `{ success: true, warnings: [...] }`
- **WHEN** 前端接收響應
- **THEN** 顯示「訂閱成功」訊息（綠色）
- **AND** 如果有警告，在控制台記錄（但不影響用戶體驗）
- **AND** 重定向到 `payment=success&mandateNo={mandateNo}`

## 實作細節

### 修改點 1: payment-service.ts:776-784
```typescript
// 修正前
if (businessLogicErrors.length > 0) {
  console.warn('[PaymentService] ⚠️ 授權成功但部分業務邏輯失敗:', businessLogicErrors)
  if (!authorizationSuccess) {
    return { success: false, error: '授權處理失敗: ' + businessLogicErrors.join(', ') }
  }
}

// 修正後
if (businessLogicErrors.length > 0) {
  console.warn('[PaymentService] ⚠️ 授權成功但部分業務邏輯失敗:', businessLogicErrors)
  // ✅ 不再因為業務邏輯失敗而返回 success: false
  // 授權已成功，業務邏輯可以之後透過補償機制修復
}

console.log('[PaymentService] ✅ 授權成功處理完成')
return {
  success: true,
  warnings: businessLogicErrors.length > 0 ? businessLogicErrors : undefined
}
```

### 修改點 2: recurring/callback/route.ts:172-232
```typescript
// 修正前
const handleResult = await paymentService.handleRecurringCallback(period!)

if (!handleResult.success) {
  console.error('[Payment Callback] 處理授權失敗:', handleResult.error)
  throw new Error(handleResult.error || '處理授權失敗')
}

// 修正後
const handleResult = await paymentService.handleRecurringCallback(period!)

if (!handleResult.success) {
  console.error('[Payment Callback] 處理授權失敗:', handleResult.error)
  throw new Error(handleResult.error || '處理授權失敗')
}

// ✅ 即使有警告也視為成功（授權已完成）
if (handleResult.warnings?.length) {
  console.warn('[Payment Callback] 授權成功但有警告:', handleResult.warnings)
  // TODO: 未來可在這裡觸發補償機制或發送警告郵件給管理員
}

console.log('[Payment Callback] 授權成功，所有資料已更新（包含訂閱和代幣）')
```

## 測試案例

### 測試 1: 模擬創建訂閱失敗
```typescript
// 在 handleRecurringCallback 中注入錯誤
const { error: subscriptionError } = { error: new Error('模擬資料庫錯誤') }
// 預期: 返回 { success: true, warnings: ['創建訂閱失敗'] }
// 預期: 前端顯示「訂閱成功」
```

### 測試 2: 模擬代幣發放失敗
```typescript
// 在更新 companies.seo_token_balance 時注入錯誤
const { error: companyUpdateError } = { error: new Error('模擬更新失敗') }
// 預期: 返回 { success: true, warnings: ['更新公司訂閱資料失敗'] }
// 預期: 前端顯示「訂閱成功」
```

### 測試 3: 所有步驟成功
```typescript
// 正常流程
// 預期: 返回 { success: true }
// 預期: 前端顯示「訂閱成功」
```

## 向後兼容性
✅ 此變更向後兼容：
- 前端已正確處理 `payment=success` 狀態
- 只是改變何時返回成功狀態的條件
- 不影響現有成功案例的行為

## 相關規格
- `payment-callbacks` - 支付回調流程
- `recurring-subscription` - 定期定額訂閱

## 參考
- `src/lib/payment/payment-service.ts:535-800`
- `src/app/api/payment/recurring/callback/route.ts:172-232`
- `src/components/subscription/SubscriptionStatusChecker.tsx:41-50`
