# 實作任務清單

## 1. 資料庫結構確認
- [ ] 1.1 確認 companies 表有 subscription_tier, subscription_ends_at, seo_token_balance 欄位
- [ ] 1.2 確認 recurring_mandates 表有 company_id, plan_id 欄位
- [ ] 1.3 確認 subscription_plans 表結構（用於查詢方案詳情和 token 配額）

## 2. 修正 handleRecurringCallback 查詢邏輯
- [ ] 2.1 修改 payment-service.ts 的 handleRecurringCallback 方法
- [ ] 2.2 使用 company_id 而非 mandate_no 查詢 recurring_mandates
- [ ] 2.3 改用 `.maybeSingle()` 取代 `.single()` 避免 PGRST116 錯誤
- [ ] 2.4 實作 5 次重試機制（每次間隔 1 秒）
- [ ] 2.5 每次重試記錄詳細日誌

## 3. 實作訂閱資料更新邏輯
- [ ] 3.1 授權成功後查詢 subscription_plans 取得方案詳情
- [ ] 3.2 更新 companies.subscription_tier 為購買的方案類型
- [ ] 3.3 計算並更新 companies.subscription_ends_at（月租: +1 月，年租: +1 年）
- [ ] 3.4 更新 companies.seo_token_balance 加上方案的 token 配額
- [ ] 3.5 記錄更新成功日誌

## 4. 實作每月自動扣款更新邏輯
- [ ] 4.1 在 NotifyURL 處理每月扣款成功通知
- [ ] 4.2 更新 recurring_mandates.next_payment_date 為下個月同一日
- [ ] 4.3 更新 companies.subscription_ends_at 延長一個月
- [ ] 4.4 新增月租 token 配額到 companies.seo_token_balance
- [ ] 4.5 記錄扣款週期資訊

## 5. 實作測試帳號重置功能
- [ ] 5.1 建立清除測試帳號資料的 SQL 腳本或 API endpoint
- [ ] 5.2 清除 acejou27@gmail.com 的所有 payment_orders 記錄
- [ ] 5.3 清除 acejou27@gmail.com 的所有 recurring_mandates 記錄
- [ ] 5.4 清除 acejou27@gmail.com 的所有 company_subscriptions 記錄
- [ ] 5.5 將 companies 表重置為 free tier (subscription_tier="free", seo_token_balance=10000)
- [ ] 5.6 驗證重置成功

## 6. 測試驗證
- [ ] 6.1 測試授權成功流程（確認資料庫查詢成功）
- [ ] 6.2 測試訂閱資料正確更新（tier, ends_at, token_balance）
- [ ] 6.3 測試每月自動扣款流程（確認到期日和 token 正確延長）
- [ ] 6.4 測試重試機制（模擬資料庫延遲）
- [ ] 6.5 測試測試帳號重置功能
- [ ] 6.6 檢查所有相關日誌輸出

## 7. 代碼審查和部署
- [ ] 7.1 執行 lint 和 typecheck
- [ ] 7.2 審查所有變更程式碼
- [ ] 7.3 更新相關文件和註解
- [ ] 7.4 部署到測試環境驗證
- [ ] 7.5 部署到生產環境
