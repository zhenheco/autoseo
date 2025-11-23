# Implementation Tasks

## 1. Database Setup

- [ ] 1.1 在 Supabase Dashboard → SQL Editor 執行 SQL 腳本創建 `get_user_by_email` RPC 函數
- [ ] 1.2 驗證函數權限設定（只允許 service_role 執行）

## 2. Backend Implementation

- [ ] 2.1 修改 `src/app/(auth)/signup/actions.ts`：使用 RPC 函數取代 `listUsers()`
- [ ] 2.2 在 try block 中直接檢查用戶狀態並返回正確參數（verified/unverified）
- [ ] 2.3 移除 `translateErrorMessage` 函數
- [ ] 2.4 簡化 catch block，只處理真實錯誤

## 3. Code Quality

- [ ] 3.1 執行 `npm run build` 確認無類型錯誤
- [ ] 3.2 執行 `npm run lint` 檢查代碼品質
- [ ] 3.3 添加必要的錯誤日誌和調試信息

## 4. Testing

- [ ] 4.1 測試已驗證用戶註冊（應顯示「前往登入」）
- [ ] 4.2 測試未驗證用戶註冊（應顯示「重發驗證信」）
- [ ] 4.3 測試新用戶註冊（應顯示「註冊成功」）
- [ ] 4.4 測試載入狀態（應顯示「註冊中...」）
- [ ] 4.5 測試錯誤情況（網路錯誤、資料庫錯誤等）

## 5. Deployment

- [ ] 5.1 提交代碼並推送到 Vercel
- [ ] 5.2 等待 Vercel 建置完成
- [ ] 5.3 在生產環境驗證所有測試案例
- [ ] 5.4 監控錯誤日誌確認無迴歸問題

## 6. Documentation

- [ ] 6.1 更新 `docs/SIGNUP_DIAGNOSIS.md` 標記問題已解決
- [ ] 6.2 記錄解決方案和驗證結果
