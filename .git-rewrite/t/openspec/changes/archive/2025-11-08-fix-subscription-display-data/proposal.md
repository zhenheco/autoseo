# Fix Subscription Display Data

## Why

目前訂閱頁面和 Dashboard 顯示的 Token 餘額、到期日、方案資訊存在多個錯誤：

1. **免費方案顯示錯誤的到期日**：免費方案應該沒有到期日（一次性 10k tokens），但頁面顯示了 2025/12/4
2. **Token 餘額數據不一致**：Dashboard 和訂閱頁面顯示 20k tokens，但免費方案應該是 10k（從資料庫查詢）
3. **硬編碼數據問題**：前端頁面使用硬編碼值或引用錯誤欄位，而非從資料庫 `company_subscriptions` 表動態讀取
4. **文章管理頁面餘額錯誤**：同樣顯示錯誤的 20k 餘額

這些問題導致使用者看到不正確的訂閱資訊，影響用戶體驗和信任度。

## What Changes

- 統一從 `company_subscriptions` 表讀取所有訂閱和 Token 相關數據
- 修正免費方案的 Token 配額顯示邏輯（應為一次性 10k，無到期日）
- 移除所有硬編碼的 Token 數值和會員資格資訊
- 確保 Dashboard、訂閱頁面、文章管理頁面的數據一致性
- 正確區分付費方案（每月重置）和免費方案（一次性）的顯示邏輯

## Impact

- 受影響的規格：新增 `subscription-display` 規格
- 受影響的程式碼：
  - `src/app/(dashboard)/dashboard/page.tsx` - Dashboard Token 顯示
  - `src/app/(dashboard)/dashboard/subscription/page.tsx` - 訂閱頁面
  - `src/components/billing/TokenBalanceDisplay.tsx` - Token 餘額組件
  - `src/app/api/token-balance/route.ts` - Token 餘額 API
  - `src/app/(dashboard)/dashboard/articles/page.tsx` - 文章管理頁面（可能）
  - `src/components/dashboard/TokenBalanceCard.tsx` - Dashboard Token 卡片（可能）
