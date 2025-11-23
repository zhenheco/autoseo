# Implementation Tasks - Google Drive OAuth Integration

## Phase 1: OAuth 授權腳本（管理員使用）

### Task 1.1: 建立授權腳本

- [x] 建立 `scripts/google-drive-authorize.ts`
- [x] 實作 OAuth URL 生成邏輯
- [x] 實作 authorization code 交換 tokens 邏輯
- [x] 輸出 refresh_token 供管理員複製至環境變數
- [x] 加入錯誤處理（invalid code, network errors）

**驗證**：執行腳本並成功獲取 refresh_token

### Task 1.2: 更新 package.json

- [x] 新增 script：`"google-drive:authorize": "tsx scripts/google-drive-authorize.ts"`
- [x] 確保 `tsx` 已安裝或使用 `ts-node`

**驗證**：`npm run google-drive:authorize` 可正常執行

### Task 1.3: 更新環境變數範例

- [x] 在 `.env.example` 加入以下變數：
  ```
  # Google Drive OAuth (管理員)
  GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
  GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxx
  GOOGLE_DRIVE_REFRESH_TOKEN=1//xxx-refresh-token
  GOOGLE_DRIVE_FOLDER_ID=your-folder-id
  ```
- [x] 在註解中說明如何取得這些值

**驗證**：文件清楚易懂

---

## Phase 2: GoogleDriveClient 改進

### Task 2.1: 簡化 GoogleDriveClient 介面

- [x] 移除 `serviceAccountEmail` 和 `serviceAccountKey` 支援
- [x] 移除 `accessToken` 支援
- [x] 只保留 OAuth refresh token 認證方式
- [x] 更新 `GoogleDriveConfig` interface：
  ```typescript
  interface GoogleDriveOAuthConfig {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    folderId: string;
    redirectUri?: string; // 預設為 localhost:3168
  }
  ```

**驗證**：TypeScript 類型檢查通過

### Task 2.2: 實作 OAuth2Client 初始化

- [x] 在 constructor 中建立 OAuth2Client
- [x] 使用 refresh_token 設定 credentials
- [x] 建立 google.drive v3 API 實例
- [x] 移除舊的 JWT 認證邏輯

**驗證**：能成功連接至 Google Drive API

### Task 2.3: 實作 Token 自動刷新

- [x] 在每個 API 呼叫前檢查 token 是否過期
- [x] 如果即將過期（< 5 分鐘），自動刷新
- [x] 使用 `oauth2Client.refreshAccessToken()` 獲取新 token
- [x] 處理 `invalid_grant` 錯誤（token 被撤銷）
- [x] 實作 exponential backoff 重試邏輯

**驗證**：模擬 token 過期情境，確認自動刷新機制運作

### Task 2.4: 改進錯誤處理

- [x] 包裝所有 API 呼叫為 try-catch
- [x] 針對不同錯誤類型提供清晰訊息：
  - `invalid_grant`: 「授權已撤銷，請重新授權」
  - `quotaExceeded`: 「API 配額超限，請稍後重試」
  - `notFound`: 「檔案或資料夾不存在」
  - Network errors: 「網路錯誤，重試中...」
- [x] 記錄詳細錯誤日誌

**驗證**：測試各種錯誤情境，確認錯誤訊息清晰

---

## Phase 3: 整合至 Image Agent

### Task 3.1: 檢查 Google Drive 配置

- [x] 在 `image-agent.ts` 開頭加入配置檢查函式：

  ```typescript
  function getGoogleDriveConfig(): GoogleDriveOAuthConfig | null {
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!refreshToken || !clientId || !clientSecret || !folderId) {
      return null;
    }

    return { refreshToken, clientId, clientSecret, folderId };
  }
  ```

**驗證**：測試配置檢查邏輯

### Task 3.2: 實作上傳邏輯

- [x] 在 `ImageAgent.execute()` 生成圖片後檢查 Drive 配置
- [x] 如果已配置，初始化 GoogleDriveClient
- [x] 調用 `uploadFromUrl(openaiUrl, filename)` 上傳圖片
- [x] 使用 Google Drive URL 取代 OpenAI URL
- [x] 如果上傳失敗，記錄錯誤並 fallback 至 OpenAI URL

**驗證**：生成文章並確認圖片已上傳至 Google Drive

### Task 3.3: 檔案命名規則

- [x] 實作檔名生成函式：
  ```typescript
  function generateFilename(
    articleId: string,
    type: "hero" | "content",
    index?: number,
  ): string {
    const timestamp = Date.now();
    if (type === "hero") {
      return `article-${articleId}-hero-${timestamp}.jpg`;
    } else {
      return `article-${articleId}-content-${index}-${timestamp}.jpg`;
    }
  }
  ```
- [x] 在上傳前調用此函式生成檔名

**驗證**：檢查 Google Drive 中的檔名是否符合規範

### Task 3.4: 日誌記錄

- [x] 在上傳開始時記錄：`[GoogleDrive] Starting upload: {filename}`
- [x] 在上傳成功時記錄：`[GoogleDrive] Upload successful: {filename} -> {url}`
- [x] 在上傳失敗時記錄：`[GoogleDrive] Upload failed: {filename} - {error}`
- [x] 在配置未設定時記錄：`[GoogleDrive] Not configured, using OpenAI URL`

**驗證**：檢查日誌輸出清晰易讀

---

## Phase 4: 測試與驗證

### Task 4.1: 單元測試

- [x] 為 GoogleDriveClient 撰寫測試：
  - Token 刷新邏輯
  - 錯誤處理邏輯
  - 檔案上傳功能（使用 mock）
- [x] 為 Image Agent 整合撰寫測試：
  - 配置檢查
  - Fallback 邏輯

**驗證**：所有測試通過

### Task 4.2: 整合測試

- [x] 執行完整的文章生成流程
- [x] 確認圖片成功上傳至 Google Drive
- [x] 確認返回的 URL 可公開存取
- [x] 測試 fallback 機制（關閉 Drive 配置）
- [x] 測試錯誤情境（網路錯誤、token 過期）

**驗證**：

- 圖片出現在 Google Drive 指定資料夾
- 直連 URL 可在瀏覽器開啟
- Fallback 機制運作正常

### Task 4.3: 本地建置測試

- [x] 執行 `npm run build` 確認 TypeScript 編譯成功
- [x] 執行 `npm run lint` 確認無 linting 錯誤
- [x] 檢查沒有使用 `any` 類型
- [x] 檢查所有新加的 imports 正確

**驗證**：建置成功，無任何錯誤或警告

---

## Phase 5: 文件與部署

### Task 5.1: 更新文件

- [x] 在 `CLAUDE.md` 或新建 `docs/google-drive-setup.md` 說明：
  - 如何在 Google Cloud Console 設定 OAuth
  - 如何執行授權腳本
  - 如何設定環境變數
  - 常見問題排除

**驗證**：文件清晰完整

### Task 5.2: 準備部署

- [x] 確保生產環境的 `.env` 包含所有必要變數
- [x] 測試生產環境建置：`npm run build`
- [x] 確認 Google Drive folder ID 正確
- [x] 測試 OAuth 授權流程（生產環境 redirect_uri）

**驗證**：生產環境可正常運作

### Task 5.3: 部署驗證

- [x] 部署至 Vercel 或 Cloudflare
- [x] 在生產環境生成測試文章
- [x] 確認圖片上傳至 Google Drive
- [x] 確認 Google Drive URL 可正常存取
- [x] 監控日誌確認無錯誤

**驗證**：生產環境功能正常

---

## Acceptance Criteria

完成標準（所有項目必須 ✅）：

- [x] 管理員可透過命令列腳本完成 OAuth 授權
- [x] Refresh token 安全儲存在環境變數
- [x] GoogleDriveClient 支援 OAuth 認證和自動 token 刷新
- [x] 生成的圖片自動上傳至管理員的 Google Drive
- [x] 圖片使用清晰的檔案命名規則
- [x] 上傳失敗時能 fallback 至 OpenAI URL
- [x] 所有錯誤有清晰的日誌記錄
- [x] TypeScript 類型檢查通過（無 `any`）
- [x] 本地建置和 lint 測試通過
- [x] 整合測試通過（實際上傳圖片至 Drive）
- [x] 文件完整，包含設定步驟和排錯指南
- [x] 生產環境部署成功並驗證通過

---

## Dependencies

- 完成前置作業：在 Google Cloud Console 建立 OAuth Client ID
- 環境變數配置完成
- `googleapis` package 已安裝（✅ 已安裝）

## Estimated Time

- Phase 1: 0.5 天
- Phase 2: 1 天
- Phase 3: 0.5 天
- Phase 4: 0.5 天
- Phase 5: 0.5 天

**Total**: 3 天（與 proposal 預估一致）
