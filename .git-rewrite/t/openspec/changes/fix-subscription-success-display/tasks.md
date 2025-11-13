# Tasks: 修正訂閱成功但顯示失敗的問題

## 前置調查
- [x] 閱讀並分析 `SubscriptionStatusChecker.tsx` 邏輯
- [x] 閱讀並分析 `payment-service.ts` 的 `handleRecurringCallback` 方法
- [x] 閱讀並分析 `recurring/callback/route.ts` 的成功/失敗路徑
- [x] 確認問題根本原因：業務邏輯失敗導致返回錯誤狀態

## 核心修正
- [ ] **修改 `src/lib/payment/payment-service.ts:776-784`**
  - 移除因業務邏輯失敗而返回 `success: false` 的邏輯
  - 改為總是返回 `success: true`，業務邏輯錯誤放入 `warnings` 陣列
  - 保留詳細的警告日誌記錄

- [ ] **修改 `src/app/api/payment/recurring/callback/route.ts:172-232`**
  - 加入處理 `handleResult.warnings` 的邏輯
  - 在控制台記錄警告但不影響成功狀態
  - 確保即使有警告也返回 `payment=success`

## 測試驗證
- [ ] **本地測試：模擬業務邏輯失敗**
  - 暫時注入錯誤到 `company_subscriptions` 創建步驟
  - 確認前端顯示「訂閱成功」而非「訂閱失敗」
  - 確認控制台記錄警告訊息

- [ ] **本地測試：正常流程**
  - 執行完整的訂閱流程（無錯誤注入）
  - 確認所有步驟成功
  - 確認前端顯示「訂閱成功」
  - 確認無警告訊息

- [ ] **建置測試**
  - 執行 `npm run build` 確認無 TypeScript 錯誤
  - 執行 `npm run lint` 確認無 lint 錯誤

## 額外改進（可選）
- [ ] **加入訂閱成功郵件功能**
  - 在 `src/lib/email.ts` 加入 `sendSubscriptionSuccessEmail` 函式
  - 設計郵件模板（包含方案名稱、Token 數量、下次扣款日期）
  - 在 `handleRecurringCallback` 成功時調用郵件發送

- [ ] **加入補償機制（未來功能）**
  - 設計背景任務定期檢查有警告的授權記錄
  - 自動重試失敗的業務邏輯步驟
  - 修復資料不一致問題

## 文件更新
- [ ] 更新 `ISSUELOG.md` 記錄此問題和解決方案
- [ ] 更新相關 OpenSpec 文件

## 部署
- [ ] Commit 變更並推送
- [ ] 等待 Vercel 建置完成
- [ ] 在生產環境測試訂閱流程
- [ ] 監控日誌確認無異常

## 驗收標準
✅ 當授權成功但部分業務邏輯失敗時：
  - 前端顯示「訂閱成功」訊息（綠色）
  - 用戶 3 秒後自動重定向到訂閱頁面
  - 控制台記錄警告但不影響用戶體驗
  - 授權記錄正確保存在資料庫

✅ 當授權成功且所有業務邏輯成功時：
  - 前端顯示「訂閱成功」訊息
  - 所有資料正確更新（委託、訂單、訂閱、Token）
  - 無警告訊息

✅ 當關鍵錯誤發生時（如找不到委託記錄）：
  - 前端顯示「訂閱失敗」訊息（紅色）
  - 提供清楚的錯誤訊息
  - 建議用戶聯繫客服
