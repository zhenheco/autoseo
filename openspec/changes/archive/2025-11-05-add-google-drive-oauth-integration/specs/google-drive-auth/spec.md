# Google Drive 認證能力規格

## ADDED Requirements

### Requirement: OAuth Authorization Flow

The system MUST initiate Google OAuth 2.0 authorization flow when user clicks "Connect Google Drive" button.

#### Scenario: 使用者從設定頁面啟動授權

**Given** 使用者已登入並位於設定頁面
**When** 使用者點擊「連接 Google Drive」按鈕
**Then** 系統產生一個唯一的 OAuth state 參數
**And** 將 state 參數與使用者 session 關聯並儲存
**And** 重定向使用者至 Google OAuth 授權頁面，包含以下參數：
  - `client_id`: 從環境變數讀取
  - `redirect_uri`: `{NEXT_PUBLIC_APP_URL}/api/google-drive/auth/callback`
  - `response_type`: `code`
  - `scope`: `https://www.googleapis.com/auth/drive.file`
  - `access_type`: `offline`
  - `prompt`: `consent`
  - `state`: 前面產生的 state 參數

#### Scenario: 已連接的使用者嘗試重新授權

**Given** 使用者已經連接過 Google Drive
**When** 使用者點擊「重新連接 Google Drive」按鈕
**Then** 系統執行與首次授權相同的流程
**And** 舊的 tokens 會在新 tokens 成功儲存後被覆蓋

### Requirement: OAuth Callback Handling

The system MUST securely handle OAuth callback when user completes authorization and is redirected back.

#### Scenario: 成功授權的 callback

**Given** 使用者已在 Google OAuth 頁面同意授權
**When** Google 重定向使用者至 `/api/google-drive/auth/callback?code=xxx&state=yyy`
**Then** 系統驗證 state 參數與 session 中儲存的 state 相符
**And** 使用 authorization code 向 Google 交換 access_token 和 refresh_token
**And** 加密 refresh_token
**And** 將加密後的 refresh_token 儲存至 `companies.google_drive_refresh_token`
**And** 將當前時間儲存至 `companies.google_drive_connected_at`
**And** 重定向使用者回設定頁面並顯示成功訊息

#### Scenario: State 參數不匹配（CSRF 攻擊防護）

**Given** 使用者被重定向至 callback URL
**When** URL 中的 state 參數與 session 中的 state 不匹配
**Then** 系統拒絕此請求
**And** 返回 400 錯誤：「Invalid state parameter」
**And** 不執行任何 token 交換或儲存操作

#### Scenario: 使用者拒絕授權

**Given** 使用者在 Google OAuth 頁面點擊「拒絕」
**When** Google 重定向使用者至 callback URL，包含 `error=access_denied`
**Then** 系統不執行 token 交換
**And** 重定向使用者回設定頁面並顯示訊息：「授權已取消」

#### Scenario: Authorization code 交換失敗

**Given** 使用者完成授權並被重定向
**When** 系統使用 authorization code 向 Google 交換 tokens 時發生錯誤
**Then** 系統記錄錯誤詳情
**And** 重定向使用者回設定頁面並顯示錯誤訊息：「連接失敗，請重試」

### Requirement: Token Encryption and Storage

The system MUST securely store Google Drive refresh tokens.

#### Scenario: 加密 refresh token

**Given** 系統成功獲取 refresh_token
**When** 準備儲存 token 至資料庫
**Then** 使用 AES-256-GCM 演算法加密 token
**And** 使用環境變數 `ENCRYPTION_KEY` 作為加密金鑰
**And** 產生隨機 IV（Initialization Vector）
**And** 將加密後的 token（包含 IV）儲存至資料庫

#### Scenario: 解密 refresh token

**Given** 需要使用 Google Drive API
**When** 從資料庫讀取 `google_drive_refresh_token`
**Then** 使用相同的 `ENCRYPTION_KEY` 解密 token
**And** 提取 IV 並正確解密資料
**And** 返回原始的 refresh_token 字串

#### Scenario: 加密金鑰未設定

**Given** 環境變數 `ENCRYPTION_KEY` 未設定
**When** 系統嘗試加密或解密 token
**Then** 拋出錯誤：「Encryption key not configured」
**And** 不執行加密或解密操作

### Requirement: Connection Status Check

The system MUST provide API for frontend to check Google Drive connection status.

#### Scenario: 檢查已連接的狀態

**Given** 使用者已成功連接 Google Drive
**When** 前端調用 `/api/google-drive/status`
**Then** 返回 200 狀態碼和 JSON：
```json
{
  "connected": true,
  "connectedAt": "2025-01-15T10:30:00Z"
}
```

#### Scenario: 檢查未連接的狀態

**Given** 使用者尚未連接 Google Drive
**When** 前端調用 `/api/google-drive/status`
**Then** 返回 200 狀態碼和 JSON：
```json
{
  "connected": false
}
```

#### Scenario: 未登入使用者嘗試檢查狀態

**Given** 使用者未登入
**When** 嘗試調用 `/api/google-drive/status`
**Then** 返回 401 錯誤：「Unauthorized」

### Requirement: Disconnect Functionality

The system MUST allow users to disconnect from Google Drive.

#### Scenario: 使用者中斷連接

**Given** 使用者已連接 Google Drive
**When** 使用者點擊「中斷連接」按鈕
**And** 前端調用 `POST /api/google-drive/disconnect`
**Then** 系統清除資料庫中的以下欄位：
  - `google_drive_refresh_token`
  - `google_drive_token_expires_at`
  - `google_drive_connected_at`
  - `google_drive_folder_id`
**And** 返回 200 狀態碼和成功訊息
**And** 前端更新連接狀態為未連接

#### Scenario: 未連接的使用者嘗試中斷連接

**Given** 使用者尚未連接 Google Drive
**When** 使用者調用 `/api/google-drive/disconnect`
**Then** 返回 400 錯誤：「Not connected to Google Drive」

### Requirement: Token Auto-Refresh

The system MUST automatically refresh access tokens before expiration.

#### Scenario: 檢測到 access_token 即將過期

**Given** GoogleDriveClient 被初始化
**When** 調用任何 API 方法前檢查 token 過期時間
**And** 發現距離過期時間少於 5 分鐘
**Then** 使用 refresh_token 向 Google 請求新的 access_token
**And** 更新 OAuth2Client 的 credentials
**And** 繼續執行原本的 API 操作

#### Scenario: Refresh token 被撤銷

**Given** 使用者在 Google 帳號設定中撤銷了授權
**When** 系統嘗試使用 refresh_token 刷新 access_token
**And** Google 返回 `invalid_grant` 錯誤
**Then** 系統標記連接為失效
**And** 清除資料庫中的 tokens
**And** 記錄錯誤日誌
**And** 拋出錯誤：「Google Drive authorization revoked」

#### Scenario: 網路錯誤導致刷新失敗

**Given** 系統嘗試刷新 access_token
**When** 網路請求失敗（timeout, network error）
**Then** 系統重試 3 次，使用 exponential backoff
**And** 如果 3 次都失敗，拋出錯誤
**And** 不清除 refresh_token（可能是暫時性錯誤）

### Requirement: Environment Variables Configuration

The system MUST read Google OAuth configuration from environment variables.

#### Scenario: 正確配置的環境變數

**Given** 環境變數設定如下：
```
GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxx
ENCRYPTION_KEY=a-32-byte-random-key-here
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```
**When** 系統初始化 OAuth 流程
**Then** 正確讀取所有必要的配置值
**And** 成功建立 OAuth2Client 實例

#### Scenario: 缺少必要的環境變數

**Given** 環境變數 `GOOGLE_DRIVE_CLIENT_ID` 或 `GOOGLE_DRIVE_CLIENT_SECRET` 未設定
**When** 系統嘗試初始化 OAuth 流程
**Then** 拋出錯誤：「Google Drive OAuth credentials not configured」
**And** 在設定頁面顯示管理員通知

### Requirement: Database Schema

The database MUST include necessary fields to store OAuth tokens.

#### Scenario: 執行資料庫 migration

**Given** 尚未執行 Google Drive OAuth migration
**When** 執行 migration 腳本
**Then** `companies` 表新增以下欄位：
  - `google_drive_refresh_token TEXT` - 加密的 refresh token
  - `google_drive_token_expires_at TIMESTAMPTZ` - token 過期時間
  - `google_drive_connected_at TIMESTAMPTZ` - 連接時間戳記
  - `google_drive_folder_id TEXT` - Drive 資料夾 ID
**And** 建立索引 `idx_companies_drive_connected` 加速查詢

#### Scenario: 查詢已連接 Google Drive 的公司

**Given** 資料庫中有多個公司記錄
**When** 查詢 `WHERE google_drive_refresh_token IS NOT NULL`
**Then** 返回所有已連接 Google Drive 的公司
**And** 查詢使用索引 `idx_companies_drive_connected` 提升效能
