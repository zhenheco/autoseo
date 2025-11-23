# Google Drive OAuth 設定指南

本指南說明如何設定 Google Drive OAuth 認證，讓系統能自動將 AI 生成的圖片上傳至你的 Google Drive。

## 前置準備

- Google 帳號
- Google Cloud Console 存取權限
- Google Drive 資料夾（用於存放圖片）

## 步驟 1：建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊左上角的專案下拉選單
3. 點擊「新增專案」
4. 輸入專案名稱（例如：Auto Pilot SEO）
5. 點擊「建立」

## 步驟 2：啟用 Google Drive API

1. 在 Google Cloud Console 中，選擇你剛建立的專案
2. 前往「API 和服務」→「程式庫」
3. 搜尋「Google Drive API」
4. 點擊進入，然後點擊「啟用」

## 步驟 3：建立 OAuth 2.0 Client ID

1. 前往「API 和服務」→「憑證」
2. 點擊「建立憑證」→「OAuth 用戶端 ID」
3. 如果首次建立，需要先「設定同意畫面」：
   - 選擇「外部」用戶類型（或內部，如果是 Google Workspace）
   - 填寫應用程式名稱：`Auto Pilot SEO`
   - 填寫用戶支援電子郵件（你的 Gmail）
   - 其他欄位可選填
   - 點擊「儲存並繼續」
   - 在「範圍」頁面，點擊「新增或移除範圍」，搜尋並選擇：
     - `https://www.googleapis.com/auth/drive.file`（Drive API - 建立和管理自己的檔案）
   - 點擊「儲存並繼續」
   - 在「測試使用者」頁面，新增你的 Gmail 帳號
   - 點擊「儲存並繼續」
4. 回到「憑證」頁面，再次點擊「建立憑證」→「OAuth 用戶端 ID」
5. 選擇應用程式類型：「網頁應用程式」
6. 設定名稱：`Auto Pilot SEO OAuth`
7. 在「已授權的重新導向 URI」中新增：
   - **本地開發**：`http://localhost:3168/api/google-drive/auth/callback`
   - **生產環境**：`https://yourdomain.com/api/google-drive/auth/callback`
8. 點擊「建立」
9. **重要**：記下「用戶端 ID」和「用戶端密碼」

## 步驟 4：建立 Google Drive 資料夾

1. 前往 [Google Drive](https://drive.google.com/)
2. 建立新資料夾，例如「Auto Pilot SEO Images」
3. 開啟資料夾，從 URL 複製資料夾 ID
   - 例如：`https://drive.google.com/drive/folders/1bui3yaSLGaBEftFQBt_X2qCmBt3OoYYy`
   - 資料夾 ID 就是最後一段：`1bui3yaSLGaBEftFQBt_X2qCmBt3OoYYy`

## 步驟 5：設定環境變數

在專案根目錄的 `.env.local` 檔案中加入以下環境變數：

```bash
# Google Drive OAuth (管理員)
GOOGLE_DRIVE_CLIENT_ID=你的-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-你的-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=留空，稍後取得
GOOGLE_DRIVE_FOLDER_ID=你的資料夾ID
```

## 步驟 6：執行授權腳本

在終端執行以下命令：

```bash
npm run google-drive:authorize
```

腳本會輸出 OAuth 授權 URL，例如：

```
🔐 Google Drive OAuth Authorization

Step 1: Open this URL in your browser:
https://accounts.google.com/o/oauth2/v2/auth?...

Step 2: Authorize the application
Step 3: Copy the authorization code from the URL
        (the "code" parameter after being redirected)

Paste the authorization code here:
```

**操作步驟**：

1. 複製輸出的 URL
2. 在瀏覽器中開啟此 URL
3. 使用你的 Google 帳號登入
4. 授權應用程式存取你的 Google Drive
5. 授權後，你會被重定向至 `http://localhost:3168/api/google-drive/auth/callback?code=...`
6. **複製 URL 中的 `code` 參數值**（從 `code=` 後面到 `&` 之前的所有字元）
7. 將 code 貼回終端並按 Enter

如果成功，腳本會輸出 refresh_token：

```
✅ Success! Tokens received.

Add this to your .env.local file:

GOOGLE_DRIVE_REFRESH_TOKEN=1//xxx-your-refresh-token-here

⚠️  IMPORTANT: Never commit this token to git!
```

## 步驟 7：更新 `.env.local`

將獲得的 refresh_token 加入 `.env.local`：

```bash
GOOGLE_DRIVE_REFRESH_TOKEN=1//xxx-your-refresh-token-here
```

## 步驟 8：測試設定

重啟開發伺服器：

```bash
npm run dev
```

生成一篇測試文章並檢查 Google Drive 資料夾，應該會看到上傳的圖片。

## 常見問題排除

### 問題 1：授權後沒有顯示 `code` 參數

**原因**：重定向 URI 配置錯誤

**解決**：

1. 檢查 Google Cloud Console 中的「已授權的重新導向 URI」
2. 確認本地開發使用 `http://localhost:3168/api/google-drive/auth/callback`
3. 重新執行授權腳本

### 問題 2：`No refresh_token received`

**原因**：你已經授權過此應用程式

**解決**：

1. 前往 [Google 帳號權限](https://myaccount.google.com/permissions)
2. 找到「Auto Pilot SEO」並撤銷存取權限
3. 重新執行授權腳本
4. 確保在授權頁面看到「強制重新同意」（`prompt=consent` 參數）

### 問題 3：上傳失敗，顯示 `invalid_grant`

**原因**：refresh_token 已被撤銷或過期

**解決**：

1. 重新執行授權腳本取得新的 refresh_token
2. 更新 `.env.local` 中的 `GOOGLE_DRIVE_REFRESH_TOKEN`
3. 重啟開發伺服器

### 問題 4：圖片上傳成功但無法公開存取

**原因**：權限設定失敗

**解決**：

1. 檢查 Google Cloud Console → API 和服務 → 憑證
2. 確認 OAuth 2.0 Client ID 的範圍包含 `drive.file`
3. 檢查 Google Drive 資料夾是否有正確的權限設定

### 問題 5：本地測試成功，但生產環境失敗

**原因**：生產環境的重定向 URI 未配置

**解決**：

1. 在 Google Cloud Console 的「已授權的重新導向 URI」中新增生產環境 URL
2. 使用生產環境的 URL 重新執行授權腳本
3. 更新生產環境的 `.env` 檔案

## 安全注意事項

1. **永不提交 refresh_token 至 Git**
   - 確保 `.env.local` 在 `.gitignore` 中
   - 使用環境變數管理敏感資訊

2. **限制 API 範圍**
   - 只請求 `drive.file` scope（僅存取系統創建的檔案）
   - 不請求完整 Drive 存取權限

3. **定期檢查授權**
   - 定期前往 Google 帳號權限檢查授權狀態
   - 如有異常，立即撤銷並重新授權

4. **生產環境部署**
   - 使用 Vercel 環境變數或 Cloudflare Secrets
   - 不在程式碼中硬編碼任何敏感資訊

## 移除 Google Drive 整合

如果不再需要 Google Drive 上傳功能：

1. 從 `.env.local` 移除所有 `GOOGLE_DRIVE_*` 環境變數
2. 系統會自動 fallback 至使用 OpenAI 圖片 URL
3. 可選：前往 Google 帳號權限撤銷「Auto Pilot SEO」的存取權限

## 參考資源

- [Google Drive API 文件](https://developers.google.com/drive/api/guides/about-sdk)
- [Google OAuth 2.0 指南](https://developers.google.com/identity/protocols/oauth2)
- [googleapis Node.js 套件](https://github.com/googleapis/google-api-nodejs-client)
