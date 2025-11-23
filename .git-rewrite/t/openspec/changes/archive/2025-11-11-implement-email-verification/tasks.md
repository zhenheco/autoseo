# 實作任務清單

## 分析階段

- [x] 分析 404 錯誤的根本原因
- [x] 檢查 Supabase 官方文件確認正確實作方式
- [x] 確認專案是否使用 i18n 路由結構
- [x] 查看現有的 auth 相關路由和 middleware
- [x] 檢查 Email Template 配置

## 實作階段

### 核心功能

- [x] 建立 `/auth/confirm` route handler
- [x] 實作 `verifyOtp()` 邏輯處理 email verification
- [x] 實作錯誤處理和重定向邏輯
- [x] 支援多種 OTP 類型（email, recovery, magiclink 等）
- [x] 實作 `next` 參數支援自訂重定向目標

### 配置更新

- [x] 更新 `src/lib/auth.ts` 中的 emailRedirectTo
- [x] 更新 `src/app/(auth)/register/page.tsx` 中的 emailRedirectTo
- [x] 更新 `src/app/api/auth/resend-verification/route.ts` 中的 emailRedirectTo

### 路徑修正

- [x] 移除 `/zh/` 前綴（第一次修正）
- [x] 確認專案無 i18n 路由結構
- [x] 修正所有重定向路徑為正確的無語言前綴路徑

## 文件階段

- [x] 建立 `docs/EMAIL_VERIFICATION_GUIDE.md` - 完整實作指南
- [x] 建立 `docs/EMAIL_TROUBLESHOOTING.md` - 疑難排解指南
- [x] 建立 `TEST_EMAIL_VERIFICATION.md` - 測試步驟文件
- [x] 提供可直接貼上的 Supabase Email Templates

### Email Templates

- [x] Confirm Signup Template
- [x] Magic Link Template
- [x] Reset Password Template
- [x] Change Email Address Template

## 測試階段

### 本地測試

- [x] 確認 route handler 檔案存在
- [x] 執行 `npm run build` 驗證無錯誤
- [x] 檢查 build 輸出包含 `/auth/confirm` 路由
- [x] TypeScript 類型檢查通過

### 生產環境測試

- [x] Git commit 並推送到遠端
- [x] 等待 Vercel 自動部署
- [x] 使用 curl 測試路由是否正確部署
- [x] 驗證重定向路徑正確（無 404）
- [x] 確認錯誤訊息正確顯示

### 問題修正

- [x] 診斷 `/zh/login` 404 問題
- [x] 使用 Chrome DevTools 分析網路請求
- [x] 修正重定向路徑為 `/login` 和 `/dashboard`
- [x] 重新部署並驗證修正成功

## 部署階段

- [x] 第一次部署：建立 route handler 和更新 emailRedirectTo
- [x] 第二次部署：修正重定向路徑錯誤
- [x] 驗證生產環境正常運作（HTTP 307 而非 404）
- [x] 確認重定向目標路徑正確（`/login` 而非 `/zh/login`）

## 驗證階段

- [x] 路由存在性驗證：`curl -I /auth/confirm` 返回 307
- [x] 重定向邏輯驗證：Token 無效時重定向到 `/login`
- [x] 錯誤訊息驗證：顯示正確的錯誤描述
- [x] Build 輸出驗證：確認路由包含在 build 中

## 文件更新

- [x] 建立完整的實作指南（中文）
- [x] 建立疑難排解文件
- [x] 提供可直接貼上的 Email Templates
- [x] 建立測試步驟文件
- [x] 記錄所有已知問題和解決方案

## 後續追蹤

- [x] 監控驗證信發送成功率
- [x] 追蹤使用者驗證完成率
- [x] 考慮配置自訂 SMTP（提高送達率）
- [x] 優化 Email Template 視覺設計
