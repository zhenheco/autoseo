# Proposal: Fix Single Purchase Payment Flow

## Change ID

fix-single-purchase-payment

## Problem Statement

單次購買測試失敗，使用者無法完成購買流程，會卡在「正在前往授權頁面」頁面。

### 根本原因分析

從日誌分析發現以下問題：

1. **缺少單次付款 API 端點**
   - 系統只實作了 `/api/payment/recurring/create`（定期定額）
   - 沒有實作 `/api/payment/single/create`（單次購買）
   - 導致前端無法建立單次付款訂單

2. **授權頁面卡住**
   - `/dashboard/billing/authorizing` 頁面沒有收到有效的 `paymentForm` 參數
   - 頁面停留在 "正在準備付款資料..." 狀態
   - 缺少錯誤處理和超時機制

3. **資料庫記錄問題**
   - 日誌顯示 `[Payment Callback] 處理授權成功失敗: Error: 找不到定期定額委託`
   - Callback 端點嘗試查詢 `recurring_mandates` 表，但單次購買不應有委託記錄
   - 需要獨立的單次付款回調處理邏輯

### 日誌證據

```
[Payment Callback] 處理授權成功失敗: Error: 找不到定期定額委託
[PaymentService] 查詢失敗 (嘗試 1/5): { mandateNo: 'MAN17621498992740331', error: null }
```

## Proposed Solution

實作完整的單次購買流程，包括 API 端點、付款表單生成、回調處理和錯誤處理。

### 關鍵變更

1. 建立 `/api/payment/single/create` 端點
2. 建立 `/api/payment/single/callback` 端點
3. 建立 `/api/payment/single/notify` 端點
4. 改進 `authorizing` 頁面的錯誤處理
5. 在 `PaymentService` 中實作單次付款方法

## Impact Assessment

- **受影響模組**: Payment processing, API routes, Frontend pages
- **破壞性變更**: 無
- **資料庫變更**: 無（使用現有 `payment_orders` 表）
- **API 變更**: 新增 3 個新端點

## Success Criteria

- [ ] 使用者可以選擇單次購買方案並完成付款
- [ ] 授權頁面正確顯示並自動提交表單
- [ ] 付款成功後正確更新訂單狀態和代幣餘額
- [ ] 錯誤情況下顯示友善的錯誤訊息
- [ ] 所有付款流程有完整的日誌記錄

## Dependencies

- 依賴 `payment-processing` spec
- 依賴 `payment-callbacks` spec

## Timeline

預計 1 天完成實作和測試

## Risks and Mitigation

| 風險                  | 機率 | 影響 | 緩解措施                       |
| --------------------- | ---- | ---- | ------------------------------ |
| NewebPay API 整合問題 | 中   | 高   | 參考定期定額實作，複用加密邏輯 |
| 資料庫並發問題        | 低   | 中   | 使用交易處理訂單和代幣更新     |
| 錯誤處理不完整        | 中   | 中   | 全面的日誌記錄和錯誤訊息       |

## Open Questions

- [ ] 單次購買是否需要電子郵件通知？
- [ ] 失敗的訂單是否需要自動清理機制？
- [ ] 是否需要付款超時機制（例如 30 分鐘）？
