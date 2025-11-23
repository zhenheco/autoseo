# Implementation Tasks

## 1. 檢視現有實作

- [x] 1.1 檢查 Dashboard Token 顯示邏輯 (`src/app/(dashboard)/dashboard/page.tsx`)
- [x] 1.2 檢查訂閱頁面數據來源 (`src/app/(dashboard)/dashboard/subscription/page.tsx`)
- [x] 1.3 檢查 TokenBalanceDisplay 組件 (`src/components/billing/TokenBalanceDisplay.tsx`)
- [x] 1.4 檢查 Token Balance API (`src/app/api/token-balance/route.ts`)
- [x] 1.5 檢查文章管理頁面 Token 顯示 (`src/app/(dashboard)/dashboard/articles/page.tsx`)
- [x] 1.6 檢查資料庫 schema (`src/types/database.types.ts` 中的 `company_subscriptions`)

## 2. 修正 Token Balance API

- [x] 2.1 確保 `/api/token-balance` 正確查詢 `company_subscriptions` 表
- [x] 2.2 修正免費方案的數據回傳邏輯（monthly_token_quota = 0 時）
- [x] 2.3 確保 API 回傳正確的配額資訊（monthlyQuota, purchased, total）
- [x] 2.4 為免費方案正確設定 `currentPeriodEnd` 為 null

## 3. 修正訂閱頁面顯示

- [x] 3.1 移除硬編碼的 Token 數值
- [x] 3.2 使用資料庫查詢結果顯示月配額
- [x] 3.3 免費方案不顯示「配額重置日」
- [x] 3.4 正確計算和顯示 Token 餘額（區分免費和付費）
- [x] 3.5 測試訂閱頁面在不同方案下的顯示

## 4. 修正 Dashboard 顯示

- [x] 4.1 確保 Dashboard 從 `company_subscriptions` 讀取數據
- [x] 4.2 修正 TokenBalanceCard 組件的數據來源
- [x] 4.3 移除硬編碼的 Token 餘額
- [x] 4.4 測試 Dashboard 在免費和付費方案下的顯示

## 5. 修正 TokenBalanceDisplay 組件

- [x] 5.1 確保組件從 `/api/token-balance` 正確讀取數據
- [x] 5.2 修正免費方案的顯示邏輯（不顯示配額重置日）
- [x] 5.3 正確處理 `isFree` 狀態和相關 UI
- [x] 5.4 確保月配額和購買 Token 的計算邏輯正確

## 6. 修正文章管理頁面

- [x] 6.1 檢查文章管理頁面是否有 Token 餘額顯示
- [x] 6.2 如有，確保使用與其他頁面相同的數據來源
- [x] 6.3 移除任何硬編碼的 Token 數值

## 7. 資料庫數據驗證

- [x] 7.1 檢查 ace@zhenhe-co.com 公司的 `company_subscriptions` 記錄
- [x] 7.2 確認免費方案的 `monthly_token_quota` 為 0
- [x] 7.3 確認 `purchased_token_balance` 為 10000（或正確數值）
- [x] 7.4 確認 `current_period_end` 為 null（免費方案）

## 8. 整合測試

- [x] 8.1 使用 ace@zhenhe-co.com 帳號測試所有頁面
- [x] 8.2 驗證 Dashboard 顯示 10k Token 餘額
- [x] 8.3 驗證訂閱頁面顯示正確資訊且無到期日
- [x] 8.4 驗證文章管理頁面顯示正確餘額
- [x] 8.5 驗證付費方案帳號的顯示（如有）

## 9. 程式碼清理

- [x] 9.1 移除所有硬編碼的 Token 數值
- [x] 9.2 移除未使用的變數和導入
- [x] 9.3 確保 TypeScript 類型正確
- [x] 9.4 執行 `npm run lint` 和 `npm run typecheck`

## 10. 文件更新

- [x] 10.1 更新相關程式碼註解
- [x] 10.2 如需要，更新 API 文件
- [x] 10.3 記錄修改重點和注意事項
