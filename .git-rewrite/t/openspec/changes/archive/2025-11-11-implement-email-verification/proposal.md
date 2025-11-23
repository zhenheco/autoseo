# 實作 Email Verification 功能

## 問題描述

使用者註冊後收到驗證信，但點擊驗證連結時出現 **404 錯誤**，導致無法完成信箱驗證。

### 驗證信 URL 格式（問題）

```
https://seo.zhenhe-dm.com/auth/callback?token_hash=pkce_xxx&type=email
```

### 問題現象

1. **驗證連結 404**：點擊驗證信中的連結後顯示 404 錯誤頁面
2. **缺少 Route Handler**：專案缺少處理 email verification callback 的路由
3. **重定向路徑錯誤**：初期實作使用了不存在的 `/zh/` 語言前綴

## 根本原因分析

1. **缺少 Auth Callback Route**：專案未建立 `/auth/confirm` route handler
2. **Email Template 配置錯誤**：Supabase Email Template 使用預設的 `{{ .ConfirmationURL }}`
3. **i18n 路由誤用**：初期實作誤以為專案使用 i18n 路由（`/zh/`, `/en/`），但實際上專案並無此結構

## 解決方案

### 1. 建立 Auth Confirm Route Handler

**檔案**：`src/app/auth/confirm/route.ts`

**功能**：

- 接收 email verification callback
- 驗證 `token_hash` 和 `type` 參數
- 呼叫 `supabase.auth.verifyOtp()` 完成驗證
- 處理成功/失敗情況的重定向
- 支援多種 OTP 類型（email、recovery、magiclink 等）

### 2. 更新 emailRedirectTo 設定

修改以下檔案中的 `emailRedirectTo` 參數：

- `src/lib/auth.ts` - signUp 函式
- `src/app/(auth)/register/page.tsx` - 註冊表單
- `src/app/api/auth/resend-verification/route.ts` - 重發驗證信 API

從：`/auth/callback` → 改為：`/auth/confirm`

### 3. 修正重定向路徑

移除不存在的語言前綴：

- `/zh/login` → `/login`
- `/zh/dashboard` → `/dashboard`

### 4. 更新 Supabase Email Template

修改 **Confirm signup** 範本：

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

## 技術實作細節

### verifyOtp vs exchangeCodeForSession

使用 `verifyOtp()` 而非 `exchangeCodeForSession()`：

- `verifyOtp()`: 專門用於 email verification、password recovery
- `exchangeCodeForSession()`: 用於 OAuth 和 PKCE flow

### Token 類型支援

支援以下 OTP 類型：

- `email`: 註冊驗證
- `recovery`: 密碼重設
- `magiclink`: 魔術連結登入
- `email_change`: 更改信箱
- `invite`: 團隊邀請

### 安全考量

1. **Token 有效期限**：5 分鐘
2. **單次使用**：Token 驗證後立即失效
3. **HTTPS Only**：生產環境強制使用 HTTPS
4. **錯誤處理**：完整的錯誤訊息和重定向邏輯

## 影響範圍

### 新增檔案

- `src/app/auth/confirm/route.ts` - Email verification route handler
- `docs/EMAIL_VERIFICATION_GUIDE.md` - 完整實作指南
- `docs/EMAIL_TROUBLESHOOTING.md` - 疑難排解文件
- `TEST_EMAIL_VERIFICATION.md` - 測試步驟

### 修改檔案

- `src/lib/auth.ts` - 更新 emailRedirectTo
- `src/app/(auth)/register/page.tsx` - 更新 emailRedirectTo
- `src/app/api/auth/resend-verification/route.ts` - 更新 emailRedirectTo

### Supabase Dashboard 設定

- Authentication → Email Templates → Confirm signup
- Authentication → Email Templates → Magic Link
- Authentication → Email Templates → Reset Password
- Authentication → Email Templates → Change Email Address

## 驗收標準

1. ✅ 註冊後收到驗證信，連結格式正確（`/auth/confirm`）
2. ✅ 點擊驗證連結不再出現 404
3. ✅ Token 有效時自動登入並重定向到 dashboard
4. ✅ Token 過期時顯示錯誤訊息並提供重發選項
5. ✅ 所有 Email Templates 使用統一的 `/auth/confirm` 路由
6. ✅ Build 成功且無 TypeScript 錯誤
7. ✅ 生產環境部署成功並正常運作

## 相關文件

- [Supabase Auth - Server-Side Rendering](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Auth - Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- 專案內部文件：`docs/EMAIL_VERIFICATION_GUIDE.md`
- 疑難排解：`docs/EMAIL_TROUBLESHOOTING.md`

## 測試記錄

### 本地測試

- ✅ Route handler 正確建立
- ✅ Build 無錯誤
- ✅ TypeScript 類型檢查通過

### 生產環境測試

- ✅ 路由正確部署（返回 307 而非 404）
- ✅ 重定向路徑正確（`/login` 和 `/dashboard`）
- ✅ Token 過期時正確顯示錯誤訊息

## 後續優化建議

1. **自訂 SMTP**：配置 Gmail/SendGrid/AWS SES 提高送達率
2. **Email 樣式優化**：美化驗證信的視覺設計
3. **多語言支援**：未來若實作 i18n，需更新重定向邏輯
4. **監控和告警**：追蹤驗證信發送成功率和驗證完成率
