# Google Drive OAuth Integration - Design Document

## Architecture Overview

```
使用者 → 前端按鈕 → OAuth 授權 → Callback API → 儲存 Tokens → 使用 GoogleDriveClient
```

## Components

### 1. OAuth 授權流程

#### 1.1 前端觸發授權

- **位置**：`src/app/(dashboard)/dashboard/settings/page.tsx`
- **按鈕**：「連接 Google Drive」
- **行為**：導向 `/api/google-drive/auth/authorize`

#### 1.2 授權 API

- **Endpoint**：`/api/google-drive/auth/authorize`
- **方法**：GET
- **功能**：
  1. 生成 OAuth state（CSRF 保護）
  2. 將 state 存入 session 或資料庫
  3. 重定向至 Google OAuth URL
  4. Scopes: `https://www.googleapis.com/auth/drive.file`

#### 1.3 Callback API

- **Endpoint**：`/api/google-drive/auth/callback`
- **方法**：GET
- **參數**：`code`, `state`
- **功能**：
  1. 驗證 state（防 CSRF）
  2. 使用 code 交換 tokens
  3. 加密 refresh_token
  4. 儲存至資料庫
  5. 重定向回設定頁面

### 2. Token 管理

#### 2.1 資料庫 Schema

```sql
-- 新增欄位至 companies 表
ALTER TABLE companies
ADD COLUMN google_drive_refresh_token TEXT,
ADD COLUMN google_drive_token_expires_at TIMESTAMPTZ,
ADD COLUMN google_drive_connected_at TIMESTAMPTZ;
```

#### 2.2 加密方式

- **演算法**：AES-256-GCM
- **Key 來源**：環境變數 `ENCRYPTION_KEY`
- **函式位置**：`src/lib/crypto/encryption.ts`

```typescript
export async function encryptToken(token: string): Promise<string> {
  // 使用 Node.js crypto 模組實作 AES-256-GCM
}

export async function decryptToken(encrypted: string): Promise<string> {
  // 解密 token
}
```

#### 2.3 Token 刷新

- **觸發時機**：access_token 過期前 5 分鐘
- **方法**：在 GoogleDriveClient 中自動檢查並刷新
- **錯誤處理**：如果刷新失敗，標記連接為失效，通知使用者重新授權

### 3. GoogleDriveClient 改進

#### 3.1 新增 OAuth 支援

```typescript
export interface GoogleDriveOAuthConfig {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  folderId: string;
}

export class GoogleDriveClient {
  private drive: any;
  private oauth2Client: OAuth2Client;
  private folderId: string;

  constructor(config: GoogleDriveOAuthConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/google-drive/auth/callback`,
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth: this.oauth2Client });
    this.folderId = config.folderId;
  }

  // 自動刷新 token
  private async ensureValidToken(): Promise<void> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
  }

  // 現有的 uploadImage, uploadFromUrl, deleteFile 方法
  // 在每個方法開始時調用 ensureValidToken()
}
```

#### 3.2 資料夾自動建立

- **預設資料夾名稱**：「Auto Pilot SEO Images」
- **建立時機**：首次上傳圖片時
- **方法**：
  1. 檢查資料夾是否存在（查詢資料庫已存的 folderId）
  2. 如不存在，建立資料夾
  3. 將 folderId 存入資料庫

### 4. 整合至 Image Agent

#### 4.1 檢查連接狀態

```typescript
// src/lib/agents/image-agent.ts
export class ImageAgent extends BaseAgent<ImageAgentInput, ImageAgentOutput> {
  async execute(input: ImageAgentInput): Promise<ImageAgentOutput> {
    // 生成圖片
    const imageUrl = await this.generateImage(input.prompt);

    // 檢查是否已連接 Google Drive
    const driveConfig = await this.getGoogleDriveConfig(input.companyId);

    if (driveConfig) {
      try {
        const driveClient = new GoogleDriveClient(driveConfig);
        const driveResult = await driveClient.uploadFromUrl(imageUrl, filename);

        return {
          imageUrl: driveResult.url, // 使用 Drive URL
          driveFileId: driveResult.fileId,
          storage: "google-drive",
        };
      } catch (error) {
        console.error("Drive upload failed:", error);
        // Fallback: 使用原始 URL
      }
    }

    return {
      imageUrl,
      storage: "openai",
    };
  }
}
```

### 5. 錯誤處理

#### 5.1 授權失敗

- **原因**：使用者拒絕授權
- **處理**：顯示友善的錯誤訊息，引導重試

#### 5.2 Token 過期

- **原因**：refresh_token 被撤銷
- **處理**：
  1. 標記連接為失效
  2. 在設定頁面顯示「需要重新連接」
  3. 提供重新授權按鈕

#### 5.3 上傳失敗

- **原因**：網路錯誤、Drive API 限制
- **處理**：
  1. 記錄錯誤日誌
  2. Fallback 至 OpenAI 生成的 URL
  3. 不阻塞文章生成流程

#### 5.4 配額超限

- **原因**：Google Drive API 配額耗盡
- **處理**：
  1. 檢測 429 錯誤
  2. 實作 exponential backoff 重試
  3. 如仍失敗，使用 fallback

## Security Considerations

### Token 保護

1. **加密儲存**：refresh_token 必須加密後才存入資料庫
2. **HTTPS**：生產環境強制使用 HTTPS
3. **State 驗證**：防止 CSRF 攻擊
4. **Scope 最小化**：只請求必要的 `drive.file` scope

### 環境變數

```bash
# .env.local
GOOGLE_DRIVE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxx
ENCRYPTION_KEY=generate-a-32-byte-random-key
```

## Database Migration

```sql
-- Migration: add-google-drive-oauth.sql
BEGIN;

-- 新增 Google Drive OAuth 欄位
ALTER TABLE companies
ADD COLUMN google_drive_refresh_token TEXT,
ADD COLUMN google_drive_token_expires_at TIMESTAMPTZ,
ADD COLUMN google_drive_connected_at TIMESTAMPTZ,
ADD COLUMN google_drive_folder_id TEXT;

-- 建立索引加速查詢
CREATE INDEX idx_companies_drive_connected
ON companies(google_drive_connected_at)
WHERE google_drive_refresh_token IS NOT NULL;

COMMIT;
```

## API Routes Summary

| Route                              | Method | Auth | Description            |
| ---------------------------------- | ------ | ---- | ---------------------- |
| `/api/google-drive/auth/authorize` | GET    | ✅   | 觸發 OAuth 授權流程    |
| `/api/google-drive/auth/callback`  | GET    | ✅   | 處理 OAuth callback    |
| `/api/google-drive/disconnect`     | POST   | ✅   | 中斷 Google Drive 連接 |
| `/api/google-drive/status`         | GET    | ✅   | 檢查連接狀態           |

## Testing Strategy

### Unit Tests

- Token 加密/解密
- OAuth URL 生成
- Token 刷新邏輯

### Integration Tests

- 完整 OAuth 流程（使用 test account）
- 圖片上傳流程
- 錯誤情境（token 過期、API 失敗）

### Manual Testing Checklist

- [ ] 授權流程完整無誤
- [ ] Tokens 正確儲存和加密
- [ ] 圖片成功上傳至 Drive
- [ ] Token 自動刷新機制運作
- [ ] 錯誤訊息清晰易懂
- [ ] 中斷連接功能正常

## Performance Considerations

1. **Token 刷新**：使用 in-memory cache 減少資料庫查詢
2. **並行上傳**：支援批量生成文章時的並行上傳
3. **Retry 策略**：使用 exponential backoff 避免過度重試

## Future Enhancements

- 支援資料夾選擇器
- 支援 Shared Drive
- 批量上傳歷史圖片
- 圖片管理介面（檢視、刪除已上傳的圖片）
