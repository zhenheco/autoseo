# Proposal: Fix Recurring Subscription Creation Failure

## Change ID
fix-recurring-subscription-creation

## Problem Statement
使用者刷卡成功（收到 NewebPay 確認信），但訂閱顯示「訂閱失敗」，系統報錯「找不到定期定額委託」。

### 根本原因分析

1. **前端與後端 API 格式不匹配**
   - 後端回傳：`{ paymentForm: { merchantId, postData, apiUrl } }`
   - 前端期待：`{ paymentForm: { action, params } }`
   - 導致前端無法正確提交表單到 NewebPay

2. **委託記錄未建立**
   - 資料庫中查無委託編號 `MAN17621498992740331`
   - 可能原因：
     - 資料庫寫入失敗但錯誤未被捕獲
     - 前端提交表單失敗但仍跳轉到支付頁面
     - Supabase 複製延遲

3. **錯誤處理不完整**
   - 前端沒有檢查 `response.ok` 狀態
   - API 錯誤時前端仍嘗試提交表單
   - 缺少詳細的日誌記錄

### 日誌證據

```
[Payment Callback] 處理授權成功失敗: Error: 找不到定期定額委託
[PaymentService] 查詢失敗 (嘗試 5/5): { mandateNo: 'MAN17621498992740331', error: null }
Status: "SUCCESS"
Message: "委託單成立，且首次授權成功(00)"
```

## Proposed Solution

### 關鍵變更

1. **統一前端表單提交邏輯**
   - 修改 `subscription-plans.tsx` 使用與 `pricing/page.tsx` 相同的表單提交方式
   - 使用 `authorizing` 頁面統一處理表單提交

2. **加強錯誤處理**
   - 檢查 `response.ok` 和 `data.success`
   - 委託建立失敗時立即回傳錯誤，不生成付款表單
   - 新增詳細的錯誤日誌

3. **改善交易原子性**
   - 確保委託記錄建立成功後才生成付款表單
   - 新增資料庫寫入驗證

## Impact Assessment

- **受影響模組**: Subscription plans UI, Payment API
- **破壞性變更**: 無
- **資料庫變更**: 無
- **API 變更**: 無（格式已正確）

## Success Criteria

- [ ] 使用者訂閱時正確跳轉到 NewebPay 授權頁面
- [ ] 委託記錄成功寫入資料庫
- [ ] 刷卡成功後訂閱狀態正確更新為 active
- [ ] 錯誤時顯示友善的錯誤訊息
- [ ] 所有關鍵步驟有完整日誌記錄

## Dependencies

- 依賴 `payment-processing` spec
- 依賴前一個變更 `fix-single-purchase-payment`

## Timeline

預計 30 分鐘完成修正

## Risks and Mitigation

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|---------|
| 影響現有用戶訂閱 | 低 | 高 | 僅修改前端表單提交邏輯 |
| 資料庫並發問題 | 低 | 中 | 使用 Supabase 交易處理 |

## Open Questions

- [ ] 是否需要補救機制處理已刷卡但未建立委託的情況？
- [ ] 是否需要手動建立遺失的委託記錄？
