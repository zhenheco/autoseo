# google-drive-upload Specification

## Purpose

TBD - created by archiving change add-google-drive-oauth-integration. Update Purpose after archive.

## Requirements

### Requirement: Admin OAuth Token Configuration

The system MUST use admin Google Drive OAuth token for all upload operations.

#### Scenario: 從環境變數讀取 refresh token

**Given** 環境變數設定如下：

```
GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_DRIVE_REFRESH_TOKEN=1//xxx-refresh-token
GOOGLE_DRIVE_FOLDER_ID=1bui3yaSLGaBEftFQBt_X2qCmBt3OoYYy
```

**When** 系統初始化 GoogleDriveClient
**Then** 使用環境變數中的 refresh_token 建立 OAuth2Client
**And** 設定 redirect_uri 為 `http://localhost:3168/api/google-drive/auth/callback`（本地開發）
**And** 成功連接至 Google Drive API

#### Scenario: Refresh token 未設定

**Given** 環境變數 `GOOGLE_DRIVE_REFRESH_TOKEN` 未設定或為空
**When** 嘗試初始化 GoogleDriveClient
**Then** 記錄警告日誌：「Google Drive not configured, skipping upload」
**And** 回退至使用 OpenAI 圖片 URL（不上傳至 Drive）
**And** 不拋出錯誤（graceful degradation）

### Requirement: GoogleDriveClient Initialization

The system MUST properly initialize GoogleDriveClient with OAuth authentication support.

#### Scenario: 使用 OAuth refresh token 初始化

**Given** 已配置 `GOOGLE_DRIVE_REFRESH_TOKEN`
**When** 建立 GoogleDriveClient 實例
**Then** 建立 OAuth2Client，設定 credentials：

```typescript
{
  refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
}
```

**And** 建立 google.drive v3 API 實例
**And** 儲存 folderId 供後續使用

#### Scenario: 移除 Service Account 支援（簡化）

**Given** 舊版 GoogleDriveClient 支援 Service Account
**When** 重構 GoogleDriveClient
**Then** 移除 `serviceAccountEmail` 和 `serviceAccountKey` 參數
**And** 只保留 OAuth refresh token 認證方式
**And** 簡化 constructor 參數為：

```typescript
interface GoogleDriveOAuthConfig {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  folderId: string;
}
```

### Requirement: Image Upload

The system MUST support uploading images to admin Google Drive.

#### Scenario: 從 URL 上傳圖片

**Given** 有一個 OpenAI 生成的圖片 URL：`https://oaidalleapiprodscus.blob.core.windows.net/private/...`
**When** 調用 `driveClient.uploadFromUrl(imageUrl, 'article-123-hero.jpg')`
**Then** 下載圖片並轉換為 Buffer
**And** 調用 `uploadImage()` 上傳至 Google Drive
**And** 設定檔案 metadata：

- `name`: `article-123-hero.jpg`
- `parents`: `[GOOGLE_DRIVE_FOLDER_ID]`
  **And** 設定檔案權限為 `reader` / `anyone`（公開讀取）
  **And** 返回圖片的直連 URL：`https://drive.google.com/uc?export=view&id={fileId}`

#### Scenario: 從 Buffer 上傳圖片

**Given** 有一個圖片 Buffer 和檔名
**When** 調用 `driveClient.uploadImage(buffer, 'image.jpg', 'image/jpeg')`
**Then** 使用 Readable stream 包裝 Buffer
**And** 調用 Google Drive API `files.create`
**And** 上傳至指定的 folderId
**And** 返回 `{ url: string, fileId: string }`

#### Scenario: 上傳失敗（網路錯誤）

**Given** 網路不穩定或 Google API 暫時無法使用
**When** 嘗試上傳圖片
**Then** 記錄錯誤日誌
**And** 重試 3 次，使用 exponential backoff（1s, 2s, 4s）
**And** 如果 3 次都失敗，拋出錯誤：「Failed to upload image to Google Drive」

#### Scenario: 上傳成功後設定公開權限

**Given** 圖片已成功上傳至 Google Drive
**When** 調用 `drive.permissions.create`
**Then** 設定權限：

```typescript
{
  role: 'reader',
  type: 'anyone'
}
```

**And** 確保圖片可以通過直連 URL 公開存取
**And** 不需要登入即可查看

### Requirement: Token Auto-Refresh

The system MUST automatically refresh access tokens upon expiration.

#### Scenario: Access token 自動刷新

**Given** OAuth2Client 使用 refresh_token 初始化
**When** 調用 Google Drive API 時 access_token 已過期
**Then** googleapis 自動使用 refresh_token 獲取新的 access_token
**And** 更新 OAuth2Client 的 credentials
**And** 重試原本的 API 請求
**And** 成功完成上傳

#### Scenario: Refresh token 失效

**Given** 管理員在 Google 帳號中撤銷了授權
**When** 系統嘗試刷新 access_token
**And** Google 返回 `invalid_grant` 錯誤
**Then** 記錄錯誤：「Google Drive authorization revoked. Please re-authorize.」
**And** 拋出錯誤
**And** 後續上傳請求都會失敗直到重新授權

### Requirement: Image Agent Integration

The system MUST automatically upload images to Google Drive when article images are generated.

#### Scenario: 生成圖片並上傳至 Drive

**Given** Image Agent 成功生成圖片並獲得 OpenAI URL
**And** Google Drive 已正確配置
**When** 檢查環境變數 `GOOGLE_DRIVE_REFRESH_TOKEN` 存在
**Then** 初始化 GoogleDriveClient
**And** 調用 `uploadFromUrl(openaiUrl, filename)`
**And** 返回 Google Drive 的直連 URL
**And** 將此 URL 用於文章中

#### Scenario: Google Drive 未配置時的 fallback

**Given** 環境變數 `GOOGLE_DRIVE_REFRESH_TOKEN` 未設定
**When** Image Agent 生成圖片後檢查 Drive 配置
**Then** 記錄訊息：「Google Drive not configured, using OpenAI URL」
**And** 直接使用 OpenAI 圖片 URL
**And** 不嘗試上傳至 Drive
**And** 文章生成流程正常完成

#### Scenario: Drive 上傳失敗時的 fallback

**Given** Google Drive 已配置但上傳失敗
**When** Image Agent 嘗試上傳並捕獲錯誤
**Then** 記錄錯誤詳情
**And** 回退至使用 OpenAI 圖片 URL
**And** 不阻塞文章生成流程
**And** 返回成功結果（使用原始 URL）

### Requirement: Folder Management

The system MUST upload all images to the specified Google Drive folder.

#### Scenario: 使用環境變數中的資料夾 ID

**Given** 環境變數 `GOOGLE_DRIVE_FOLDER_ID=1bui3yaSLGaBEftFQBt_X2qCmBt3OoYYy`
**When** 上傳圖片至 Google Drive
**Then** 所有圖片都上傳至此資料夾
**And** 不建立新資料夾
**And** 使用預先配置的資料夾 ID

#### Scenario: 資料夾 ID 未設定

**Given** 環境變數 `GOOGLE_DRIVE_FOLDER_ID` 未設定
**When** 嘗試初始化 GoogleDriveClient
**Then** 拋出錯誤：「GOOGLE_DRIVE_FOLDER_ID not configured」
**And** 不執行上傳操作

### Requirement: File Naming Conventions

The system MUST use clear file naming conventions.

#### Scenario: 文章主圖命名

**Given** 為文章 ID `123` 生成主圖
**When** 上傳圖片至 Google Drive
**Then** 檔名格式為：`article-{articleId}-hero-{timestamp}.jpg`
**Example**: `article-123-hero-1705305600000.jpg`

#### Scenario: 內容圖片命名

**Given** 為文章 ID `123` 生成第 2 張內容圖片
**When** 上傳圖片至 Google Drive
**Then** 檔名格式為：`article-{articleId}-content-{index}-{timestamp}.jpg`
**Example**: `article-123-content-2-1705305600000.jpg`

### Requirement: Error Handling and Logging

The system MUST comprehensively handle all possible error scenarios.

#### Scenario: 記錄上傳開始

**Given** 開始上傳圖片至 Google Drive
**When** 調用 `uploadFromUrl`
**Then** 記錄日誌：`[GoogleDrive] Starting upload: {filename}`

#### Scenario: 記錄上傳成功

**Given** 圖片成功上傳
**When** 獲得 Drive 直連 URL
**Then** 記錄日誌：`[GoogleDrive] Upload successful: {filename} -> {url}`

#### Scenario: 記錄上傳失敗

**Given** 上傳過程中發生錯誤
**When** 捕獲錯誤
**Then** 記錄錯誤：`[GoogleDrive] Upload failed: {filename} - {error.message}`
**And** 不阻塞主要流程

### Requirement: Initial Authorization Flow

The admin MUST be able to complete initial OAuth authorization via command line tool.

#### Scenario: 執行授權腳本

**Given** 尚未獲取 refresh_token
**When** 管理員執行 `npm run google-drive:authorize`
**Then** 腳本輸出 OAuth 授權 URL
**And** 提示管理員在瀏覽器中開啟此 URL
**And** 等待管理員完成授權並複製 authorization code

#### Scenario: 交換 authorization code

**Given** 管理員在瀏覽器完成授權並獲得 code
**When** 管理員將 code 貼入終端
**Then** 腳本使用 code 交換 tokens
**And** 獲取 refresh_token
**And** 輸出 refresh_token 到終端
**And** 提示管理員將其加入 `.env.local`

#### Scenario: 授權腳本錯誤處理

**Given** 管理員輸入了無效的 authorization code
**When** 腳本嘗試交換 tokens
**Then** Google 返回錯誤：`invalid_grant`
**And** 腳本顯示錯誤訊息：「Invalid authorization code, please try again」
**And** 提示重新開始授權流程
