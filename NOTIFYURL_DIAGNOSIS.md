# NotifyURL 沒有被調用 - 完整診斷報告

## 問題概述
定期定額授權成功後，ReturnURL 被調用，但 NotifyURL 完全沒有被調用。

## 根本原因

### 1. **藍新金流的行為差異**

根據藍新金流定期定額 API 文檔（版本 1.5）:
- **ReturnURL**：授權成功時調用（用於前端重定向）- **同步調用**
- **NotifyURL**：首次授權時藍新不會調用；只有在定期扣款時才會調用 - **需要自動扣款觸發**

**核心問題**：定期定額首次授權成功時，藍新金流 **只調用 ReturnURL，不調用 NotifyURL**。

### 2. **代碼中的假設錯誤**

在 `/src/app/api/payment/recurring/callback/route.ts` 第 156-199 行：

```typescript
// 對於定期定額，等待 NotifyURL 處理完成（最多 5 秒）
if (isPeriodCallback) {
  console.log('[Payment Callback] 等待 NotifyURL 處理完成...')
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: mandate } = await supabase
      .from('recurring_mandates')
      .select('status, first_payment_order_id')
      .eq('mandate_no', orderNo)
      .maybeSingle()

    // 檢查 mandate 是否存在且狀態為 active（表示 NotifyURL 已處理完成）
    if (mandate && mandate.status === 'active') {
      console.log(`[Payment Callback] NotifyURL 已完成，狀態為 active (嘗試 ${attempt}/3)`)
      // ... 返回成功
    }
  }
}
```

**問題**：代碼期望 NotifyURL 在 ReturnURL 之前或同時調用，但實際上 NotifyURL 根本不會被調用（至少在授權階段）。

### 3. **正確的藍新金流流程**

#### 階段 1: 授權（用戶在藍新完成授權）
```
用戶提交定期定額表單
  ↓
藍新金流授權頁面
  ↓
授權成功
  ↓
藍新調用 ReturnURL（GET 或 POST）
  ↓
前端收到回調，顯示成功
```

⚠️ **此時 NotifyURL 不被調用**

#### 階段 2: 定期扣款（由藍新後台定時觸發）
```
藍新后台扣款周期到達
  ↓
藍新從用户卡片扣款
  ↓
扣款成功/失敗
  ↓
藍新調用 NotifyURL（POST）
  ↓
後端更新定期定額訂單狀態
```

## 影響分析

### 現象
- ReturnURL 被調用，前端顯示 pending（等待 NotifyURL）
- NotifyURL 永遠不會被調用（用戶端可能永遠看不到成功）
- `recurring_mandates` 表的 status 永遠停留在 `pending`

### 用戶體驗
1. 用戶完成授權
2. 前端顯示處理中（輪詢等待）
3. 用戶可能長時間看不到成功確認

## 解決方案

### 方案 A: 在 ReturnURL 中直接設置狀態為 active（推薦）

問題：藍新 ReturnURL 回調沒有加密的訂單詳情，但可以從 Period 參數中解密。

**更正**：`/src/app/api/payment/recurring/callback/route.ts` 中已經通過 `Period` 參數解密了完整信息，應該直接在 ReturnURL 中設置狀態為 `active`。

當前代碼邏輯（第 156-199 行）不應該等待 NotifyURL，而應該：

```typescript
if (isPeriodCallback) {
  console.log('[Payment Callback] 處理定期定額授權，直接設置為 active')
  
  try {
    const decryptedData = paymentService.decryptPeriodCallback(period!)
    const result = decryptedData.Result
    const mandateNo = result.MerchantOrderNo
    
    // 從 Period 參數直接更新狀態為 active
    // 因為 ReturnURL 本身就表示授權成功
    const { error: updateError } = await supabase
      .from('recurring_mandates')
      .update({
        status: 'active',
        newebpay_period_no: result.PeriodNo,
        activated_at: new Date().toISOString(),
      })
      .eq('mandate_no', mandateNo)
    
    if (updateError) throw updateError
    
    // 直接返回成功，不等待 NotifyURL
    const redirectUrl = `${baseUrl}/dashboard/billing?payment=success&orderNo=${encodeURIComponent(mandateNo)}`
    return redirectToSuccess(redirectUrl)
  } catch (error) {
    console.error('[Payment Callback] 處理失敗:', error)
    // 返回失敗或 pending
  }
}
```

### 方案 B: 分離授權成功和首次扣款

保持 `pending` 狀態直到第一次 NotifyURL 調用（但需要等待藍新自動扣款）。

**缺點**：用戶需要等待藍新後台扣款，可能要 1-2 分鐘才能看到成功。

## 建議方案：採用方案 A

因為：
1. 定期定額授權成功（ReturnURL 被調用）= 授權確認成功
2. 第一次 NotifyURL 只在藍新扣款時調用，不適合用於授權確認
3. NotifyURL 是用於後續定期扣款的狀態通知，與授權流程分離

## 實施步驟

1. 在 `/src/app/api/payment/recurring/callback/route.ts` 中移除 NotifyURL 等待邏輯
2. 直接在 ReturnURL 中從 Period 參數解密後設置 `status = 'active'`
3. 更新前端在 `payment=success` 時直接顯示成功，而不是 `payment=pending`
4. 保留 NotifyURL 以處理後續定期扣款的狀態更新

## 測試步驟

1. 創建新的定期定額授權
2. 完成授權後檢查是否立即重定向到成功頁面（不是 pending）
3. 檢查 `recurring_mandates` 表中 `status` 是否為 `active`
4. 驗證 `newebpay_period_no` 是否已填充
5. 驗證 `activated_at` 時間戳是否已設置

## 文件參考

- **問題代碼**: `/src/app/api/payment/recurring/callback/route.ts:156-199`
- **回調處理**: `/src/app/api/payment/recurring/callback/route.ts:124-151`
- **NotifyURL 端點**: `/src/app/api/payment/recurring/notify/route.ts`
- **Payment Service**: `/src/lib/payment/payment-service.ts:408-481`
- **NewebPay Service**: `/src/lib/payment/newebpay-service.ts:114-169`

## 藍新金流 API 文檔引用

- 定期定額 API 版本：1.5
- 授權回調：使用 Period 參數（JSON 格式）
- NotifyURL 用途：定期扣款結果通知，不包括授權確認

