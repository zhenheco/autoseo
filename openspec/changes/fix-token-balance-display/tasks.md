# 實作任務列表

## 階段 1：診斷和資料修正（優先）

### 1.1 診斷 ace@zhenhe-co.com 帳號狀態
- [ ] 執行診斷腳本：`psql $DATABASE_URL -f scripts/diagnose-ace-account.sql`
- [ ] 檢查以下項目：
  - [ ] auth.users 記錄是否存在
  - [ ] company_members 記錄是否存在且 status = 'active'
  - [ ] companies 記錄是否存在
  - [ ] company_subscriptions 記錄是否存在且 status = 'active'
  - [ ] Token 餘額是否正確（purchased_token_balance = 10000）
  - [ ] RLS 政策是否阻擋查詢
- [ ] 記錄所有發現的問題

### 1.2 診斷免費方案 Token 配額問題
- [ ] 查詢資料庫確認所有免費方案的實際配額
  ```sql
  SELECT c.name, cs.monthly_token_quota, cs.purchased_token_balance, cs.monthly_quota_balance
  FROM companies c
  JOIN company_subscriptions cs ON c.id = cs.company_id
  WHERE c.subscription_tier = 'free' AND cs.status = 'active';
  ```
- [ ] 確認是否有公司的 `purchased_token_balance` 為 20,000 而非 10,000
- [ ] 記錄需要修正的公司 ID

### 1.3 修正 ace@zhenhe-co.com 帳號資料（如果需要）
- [ ] 根據診斷結果，決定是否需要：
  - [ ] 重新執行重置腳本：`scripts/complete-reset-ace-fixed.sql`
  - [ ] 手動修正缺失的記錄
  - [ ] 修正 Token 餘額
- [ ] 再次執行診斷腳本驗證修正結果

### 1.4 建立資料庫遷移腳本修正免費方案配額
- [ ] 建立遷移檔案：`supabase/migrations/20251108000000_fix_free_plan_token_balance.sql`
- [ ] 修正所有免費方案的 `purchased_token_balance` 為 10,000
- [ ] 執行遷移並驗證結果

## 階段 2：修正 API 和計算邏輯

### 2.1 修正 `/api/token-balance` API
- [ ] 確保免費方案判斷邏輯正確：`monthly_token_quota === 0`
- [ ] 修正 `total` 計算：
  - 免費方案：`total = purchased`
  - 付費方案：`total = monthlyQuota + purchased`
- [ ] 加入方案資訊查詢（`subscription_plans` 表）
- [ ] 加入單元測試：
  - 測試免費方案回傳正確餘額
  - 測試付費方案回傳正確餘額

### 2.2 修正購買流程錯誤處理
- [ ] 在 `src/app/api/payment/recurring/create/route.ts` 加入詳細錯誤日誌
- [ ] 記錄 `companyId` 和查詢條件
- [ ] 回傳更具體的錯誤代碼和訊息
- [ ] 加入購買前驗證：
  - 驗證用戶登入狀態
  - 驗證 company_members 記錄
  - 驗證 companies 記錄
  - 驗證 subscription_plans 記錄

## 階段 3：修正前端顯示組件

### 3.1 修正 TokenBalanceDisplay 組件
- [ ] 移除所有硬編碼的 Token 數量
- [ ] 統一使用 `/api/token-balance` API 取得資料
- [ ] 確保免費方案顯示邏輯正確：
  - 顯示「一次性 Token 餘額」
  - 不顯示「月配額」和「配額重置日」
- [ ] 測試組件在不同方案下的顯示

### 3.2 修正 TokenBalanceCard 組件
- [ ] 移除硬編碼文字（如「一次性 Token 餘額」）
- [ ] 根據 API 回傳的 `subscription.tier` 動態顯示
- [ ] 確保使用率計算正確：
  ```typescript
  usagePercentage = (monthlyTokenQuota - monthlyQuota) / monthlyTokenQuota * 100
  ```
- [ ] 測試低餘額警告（< 5000）和嚴重警告（< 2000）

### 3.3 修正 Dashboard 頁面
- [ ] 移除直接查詢 `company_subscriptions` 的邏輯
- [ ] 統一使用 `TokenBalanceCard` 組件（已透過 API 取得資料）
- [ ] 驗證頁面顯示正確的 Token 餘額

### 3.4 修正訂閱頁面 (`/dashboard/subscription`)
- [ ] 確保「目前方案」區塊正確顯示：
  - 免費方案：只顯示 Token 餘額和「永不過期」
  - 付費方案：顯示月配額、購買 tokens、配額重置日
- [ ] 移除所有硬編碼的 Token 數量
- [ ] 測試在不同方案下的顯示

## 階段 4：測試和驗證

### 4.1 單元測試
- [ ] 測試 `/api/token-balance` API：
  - 免費方案回傳正確資料
  - 付費方案回傳正確資料
  - 無訂閱時回傳 404
- [ ] 測試 Token 計算邏輯
- [ ] 測試錯誤處理邏輯

### 4.2 整合測試
- [ ] 建立測試公司（免費方案）
  - 驗證 Dashboard 顯示 10,000 tokens
  - 驗證訂閱頁面顯示正確資料
  - 驗證「一次性 Token 餘額」標籤
- [ ] 建立測試公司（STARTER 方案）
  - 驗證 Dashboard 顯示正確的總餘額和使用率
  - 驗證訂閱頁面顯示月配額和配額重置日
- [ ] 測試購買流程：
  - 驗證不會出現「找不到公司資料」錯誤
  - 驗證錯誤訊息清楚且有幫助

### 4.3 使用者驗收測試
- [ ] 登入免費方案帳號
  - 檢查 Dashboard Token 餘額為 10,000
  - 檢查訂閱頁面顯示「免費方案」和「永不過期」
- [ ] 登入付費方案帳號
  - 檢查 Dashboard 顯示正確的月配額和購買 tokens
  - 檢查使用率進度條正確
  - 檢查配額重置日正確
- [ ] 測試購買方案流程
  - 確認不會出現「找不到公司資料」錯誤
  - 確認可以成功建立訂單

## 階段 5：文件和部署

### 5.1 更新文件
- [ ] 更新 `SUBSCRIPTION_UPDATE_DIAGNOSIS.md`（如果存在）
- [ ] 記錄此次修正的問題和解決方案
- [ ] 更新 API 文件（如果存在）

### 5.2 部署前檢查
- [ ] 執行 `npm run lint`
- [ ] 執行 `npm run typecheck`
- [ ] 執行 `npm run build`
- [ ] 本地測試所有修正

### 5.3 部署
- [ ] 在 staging 環境測試
- [ ] 部署到 production
- [ ] 監控錯誤日誌
- [ ] 驗證用戶回報的問題已解決

## 相依性和優先順序

**高優先級**（立即執行）：
1. 階段 1（診斷和資料修正）
2. 階段 2.1（修正 API）
3. 階段 3（修正前端顯示）

**中優先級**（次要）：
4. 階段 2.2（錯誤處理）
5. 階段 4（測試）

**低優先級**（可選）：
6. 階段 5（文件和部署）

## 平行任務

可以平行執行的任務：
- 階段 2.1 和階段 2.2（API 修正和錯誤處理）
- 階段 3.1、3.2、3.3、3.4（不同組件的修正）
- 階段 4.1、4.2（單元測試和整合測試）
