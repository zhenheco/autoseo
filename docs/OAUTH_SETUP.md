# Google OAuth 登入設定指南

本文件說明如何在 Supabase 中設定 Google OAuth 登入功能。

## 目錄
- [Google OAuth 設定](#google-oauth-設定)
- [Supabase 設定](#supabase-設定)
- [測試流程](#測試流程)

---

## Google OAuth 設定

### 步驟 1：建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 專案名稱建議：`Auto Pilot SEO`

### 步驟 2：啟用 Google+ API

1. 在左側選單點選「API 和服務」→「已啟用的 API 和服務」
2. 點選「+ 啟用 API 和服務」
3. 搜尋「Google+ API」並啟用

### 步驟 3：建立 OAuth 2.0 憑證

1. 前往「API 和服務」→「憑證」
2. 點選「建立憑證」→「OAuth 2.0 用戶端 ID」
3. 如果是第一次建立，需要先設定「OAuth 同意畫面」：
   - 使用者類型：選擇「外部」
   - 應用程式名稱：`Auto Pilot SEO`
   - 使用者支援電子郵件：您的 email
   - 授權網域：您的網域（例如：`autopilot-seo.com`）
   - 開發人員聯絡資訊：您的 email

4. 建立 OAuth 用戶端 ID：
   - 應用程式類型：「網頁應用程式」
   - 名稱：`Auto Pilot SEO - Web Client`
   - 授權的重新導向 URI：
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     **⚠️ 重要**：請將 `<your-project-ref>` 替換為您的 Supabase 專案 ID

     您可以在 Supabase Dashboard → Settings → API → Project URL 找到

5. 點選「建立」後會獲得：
   - **Client ID**（客戶端 ID）
   - **Client Secret**（客戶端密鑰）

   **請妥善保存這兩個值！**

### 步驟 4：本地開發設定（可選）

如果需要在本地測試，額外加入：
```
http://localhost:54321/auth/v1/callback
```

---

## Supabase 設定

### 步驟 1：進入 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 前往「Authentication」→「Providers」

### 步驟 2：設定 Google Provider

1. 找到「Google」Provider 並點選
2. 啟用「Enable Sign in with Google」
3. 填入您從 Google Cloud Console 取得的憑證：
   - **Client ID**: 貼上 Google OAuth Client ID
   - **Client Secret**: 貼上 Google OAuth Client Secret
4. 設定「Authorized redirect URIs」（Supabase 會自動顯示正確的 URL）
5. 點選「Save」

### 步驟 3：啟用帳號連結（Account Linking）

這個設定可以讓相同 email 的帳號自動連結：

1. 前往「Authentication」→「Settings」
2. 找到「User Signups」區塊
3. 啟用「Enable email confirmations」（建議）
4. 找到「Link accounts with same email」
5. **啟用此選項**

**效果**：當使用者用 `test@gmail.com` 註冊後，再用 Google `test@gmail.com` 登入時，會自動連結為同一個帳號。

### 步驟 4：設定 Site URL

1. 前往「Authentication」→「URL Configuration」
2. 設定 **Site URL**：
   - 開發環境: `http://localhost:3000`
   - 正式環境: `https://your-domain.com`
3. 設定 **Redirect URLs**（允許的重定向 URL）：
   ```
   http://localhost:3000/**
   https://your-domain.com/**
   ```

---

## 環境變數設定

在您的 `.env.local` 檔案中確認以下變數：

```bash
# Supabase（已存在）
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL（已存在）
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 開發環境
# NEXT_PUBLIC_APP_URL=https://your-domain.com  # 正式環境
```

**不需要額外的 Google 環境變數**，因為 Supabase 會處理！

---

## 測試流程

### 1. 測試 Google 登入

1. 啟動開發伺服器：`npm run dev`
2. 前往 `http://localhost:3000/login`
3. 點選「使用 Google 登入」按鈕
4. 選擇您的 Google 帳號
5. 授權後應該會自動：
   - 建立 Supabase 使用者
   - 建立公司（透過資料庫 Trigger）
   - 建立免費訂閱
   - 重定向到 Dashboard

### 2. 檢查資料庫

使用 Supabase SQL Editor 執行：

```sql
-- 檢查使用者
SELECT id, email, raw_app_meta_data->>'provider' as provider
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 檢查是否有公司
SELECT u.email, c.name as company_name, cm.role
FROM auth.users u
LEFT JOIN company_members cm ON cm.user_id = u.id
LEFT JOIN companies c ON c.id = cm.company_id
ORDER BY u.created_at DESC
LIMIT 10;

-- 檢查訂閱
SELECT c.name, s.plan_name, s.status, s.monthly_article_limit
FROM subscriptions s
JOIN companies c ON c.id = s.company_id
ORDER BY s.created_at DESC
LIMIT 10;
```

---

## 常見問題

### Q1: Google 登入後沒有建立公司？
**A**: 檢查資料庫 Trigger 是否正確設定（見 `supabase/migrations/` 資料夾）

### Q2: Email 衝突錯誤？
**A**: 確認 Supabase「Link accounts with same email」已啟用

### Q3: 本地開發無法測試 OAuth？
**A**:
1. 使用 `http://localhost:54321` 而非 `http://localhost:3000`
2. 或使用 ngrok 建立臨時 HTTPS URL

### Q4: Callback 失敗？
**A**: 確認 Google OAuth 設定中的 Callback URL 為：
   `https://<project-ref>.supabase.co/auth/v1/callback`

---

## 安全注意事項

1. ✅ **絕不提交** Client Secret 到 Git
2. ✅ 使用環境變數儲存敏感資訊
3. ✅ 正式環境務必使用 HTTPS
4. ✅ 定期輪換 OAuth Secrets
5. ✅ 限制授權的重定向 URI（不要使用 wildcard）

---

## 相關文件

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 文件](https://developers.google.com/identity/protocols/oauth2)

---

**建立時間**: 2025-11-05
**維護者**: Auto Pilot SEO Team
