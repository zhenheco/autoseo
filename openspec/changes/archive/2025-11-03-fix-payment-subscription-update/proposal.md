# 修正付款成功後訂閱更新和帳戶資料重置

## Why

當前系統在定期定額付款授權成功後，存在以下問題：

1. **資料庫查詢失敗**：`handleRecurringCallback` 中查詢 `recurring_mandates` 時找不到記錄，導致授權成功但無法更新資料庫
2. **缺少訂閱更新邏輯**：付款成功後沒有正確更新 company 的 `subscription_tier` (仍為 free)
3. **缺少到期日更新邏輯**：月租型方案付款成功後沒有更新 `subscription_ends_at` 為下個月同一日
4. **缺少 token 餘額更新邏輯**：購買方案後沒有同步更新 `seo_token_balance`

此外，用戶需要將測試帳號 `acejou27@gmail.com` 的購買記錄清除並恢復為 free 方案。

## What Changes

- **payment-callbacks**: 修正定期定額授權成功處理流程
  - 修正 `handleRecurringCallback` 的資料庫查詢邏輯（重試機制、錯誤處理）
  - 新增付款成功後更新 company 的訂閱資料邏輯：
    - 更新 `subscription_tier` 為購買的方案
    - 更新 `subscription_ends_at` 為下個月同一日（月租型）
    - 更新 `seo_token_balance` 為購買方案的 token 數量
  - 確保每次月租型扣款成功都正確延長到期日
- **資料修正**: 清除測試帳號購買記錄並恢復為 free 方案

## Impact

- 影響的規格: `payment-callbacks`
- 影響的程式碼:
  - `src/app/api/payment/recurring/callback/route.ts`
  - `src/lib/payment/payment-service.ts`
  - `src/lib/payment/services/subscription-activation-service.ts`
  - 資料庫: `companies`, `recurring_mandates`, `payment_orders`, `company_subscriptions`
