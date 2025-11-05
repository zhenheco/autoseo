# Google Drive 圖片儲存設定指南

本專案已完整整合 Google Drive 圖片儲存功能。當未直接發布到 WordPress 時，所有生成的圖片將自動上傳到 Google Drive 並獲得永久 URL。

## 系統架構

### 現有實作
- ✅ **Google Drive Client**: `/src/lib/storage/google-drive-client.ts` - 完整的上傳和權限管理
- ✅ **Image Agent 整合**: `/src/lib/agents/image-agent.ts` - 自動偵測並上傳圖片
- ✅ **環境變數檢測**: 自動判斷是否啟用 Google Drive 儲存

### 工作流程
```
圖片生成 (OpenRouter API)
    ↓
取得臨時 URL
    ↓
偵測 GOOGLE_DRIVE_FOLDER_ID 環境變數
    ↓ (如果存在)
下載圖片 → 上傳到 Google Drive → 設定公開權限
    ↓
回傳永久 Google Drive URL
    ↓
儲存到 generated_articles 資料表
```

## 設定步驟

### 方案一：OAuth2 存取權杖（推薦用於開發/測試）

#### 1. 啟用 Google Drive API
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 進入「API 和服務」→「程式庫」
4. 搜尋「Google Drive API」並啟用

#### 2. 建立 OAuth 2.0 憑證
1. 進入「API 和服務」→「憑證」
2. 點選「建立憑證」→「OAuth 用戶端 ID」
3. 應用程式類型選擇「網頁應用程式」
4. 授權重新導向 URI 新增：
   ```
   https://developers.google.com/oauthplayground
   ```
5. 儲存並記下「用戶端 ID」和「用戶端密鑰」

#### 3. 取得存取權杖
1. 前往 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. 點選右上角齒輪圖示 → 勾選「Use your own OAuth credentials」
3. 輸入步驟 2 取得的用戶端 ID 和用戶端密鑰
4. 在左側 Step 1 選擇：
   ```
   Drive API v3
   └── https://www.googleapis.com/auth/drive.file
   ```
5. 點選「Authorize APIs」並登入 Google 帳戶
6. 在 Step 2 點選「Exchange authorization code for tokens」
7. 複製「Access token」（這是短期權杖，稍後會換成 Refresh Token）
8. **重要**：複製「Refresh token」（永久使用）

#### 4. 建立 Google Drive 資料夾
1. 前往 [Google Drive](https://drive.google.com/)
2. 建立新資料夾（例如：「SEO Article Images」）
3. 進入資料夾，從 URL 複製資料夾 ID：
   ```
   https://drive.google.com/drive/folders/1abc...xyz
                                          ↑ 這部分就是 FOLDER_ID
   ```

#### 5. 設定 Vercel 環境變數
1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇專案 → Settings → Environment Variables
3. 新增以下變數：

```bash
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz
GOOGLE_DRIVE_ACCESS_TOKEN=ya29.a0...（從 Playground 取得的 Access Token）
```

**注意**：Access Token 會過期，建議改用 Service Account（方案二）

---

### 方案二：Service Account（推薦用於生產環境）

#### 1. 建立 Service Account
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇專案 → 「IAM 與管理」→「服務帳戶」
3. 點選「建立服務帳戶」
4. 輸入名稱（例如：「seo-article-uploader」）
5. 角色選擇「基本」→「編輯者」（或自訂更嚴格的權限）
6. 完成建立

#### 2. 產生 JSON 金鑰
1. 在服務帳戶列表中，點選剛建立的帳戶
2. 切換到「金鑰」分頁
3. 點選「新增金鑰」→「建立新的金鑰」
4. 選擇「JSON」格式
5. 下載 JSON 檔案（格式如下）：

```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "seo-article-uploader@your-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

#### 3. 共享 Google Drive 資料夾
1. 前往 Google Drive 建立或選擇目標資料夾
2. 右鍵點選資料夾 → 「共用」
3. 輸入服務帳戶的電子郵件地址（從 JSON 的 `client_email` 欄位複製）：
   ```
   seo-article-uploader@your-project.iam.gserviceaccount.com
   ```
4. 權限設為「編輯者」
5. 取消勾選「通知使用者」
6. 點選「共用」

#### 4. 設定 Vercel 環境變數

##### 方法 A：使用完整 JSON（簡單但較不安全）
```bash
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz
GOOGLE_APPLICATION_CREDENTIALS='{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "seo-article-uploader@your-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  ...
}'
```

##### 方法 B：分離欄位（推薦）
```bash
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=seo-article-uploader@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**注意**：`private_key` 中的換行符號 `\n` 在環境變數中需要保留

---

## 程式碼說明

### GoogleDriveClient 類別
位置：`/src/lib/storage/google-drive-client.ts`

#### 初始化方式

**使用 Access Token**：
```typescript
const client = new GoogleDriveClient({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
});
```

**使用 Service Account**：
```typescript
const client = new GoogleDriveClient({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  serviceAccountEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
  serviceAccountKey: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY,
});
```

#### 主要方法

**上傳圖片從 URL**：
```typescript
const result = await client.uploadFromUrl(
  'https://temp-url.com/image.jpg',
  'featured-1234567890.jpg'
);

console.log(result.url);     // https://drive.google.com/uc?export=view&id=xxx
console.log(result.fileId);  // 1abc...xyz
```

**上傳圖片從 Buffer**：
```typescript
const buffer = await fs.readFile('image.jpg');
const result = await client.uploadImage(
  buffer,
  'content-1234567890.jpg',
  'image/jpeg'
);
```

### ImageAgent 整合
位置：`/src/lib/agents/image-agent.ts`

#### 自動上傳邏輯
```typescript
// 生成圖片後
const result = await this.generateImage(prompt, options);
let finalUrl = result.url;  // 臨時 URL

// 自動偵測並上傳
if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
  try {
    const driveClient = new GoogleDriveClient({
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
      accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
    });

    const filename = `featured-${Date.now()}.jpg`;
    const uploaded = await driveClient.uploadFromUrl(result.url, filename);
    finalUrl = uploaded.url;  // 永久 Google Drive URL

    console.log('[ImageAgent] Uploaded to Google Drive:', uploaded.fileId);
  } catch (error) {
    console.warn('[ImageAgent] Upload failed, using original URL:', error);
    // 降級使用臨時 URL
  }
}

return {
  url: finalUrl,  // 儲存到資料庫
  // ... 其他屬性
};
```

---

## 驗證設定

### 1. 檢查環境變數
```bash
# Vercel CLI
vercel env ls

# 或在 Vercel Dashboard 查看
# Settings → Environment Variables
```

### 2. 觸發測試
1. 前往應用程式的文章生成頁面
2. 建立測試文章（選擇包含圖片生成）
3. 等待生成完成

### 3. 查看日誌
```bash
# Vercel 即時日誌
vercel logs --follow

# 或使用 Vercel Dashboard
# Deployments → 選擇最新部署 → Functions → 查看日誌
```

### 4. 確認成功標誌
日誌中應出現：
```
[ImageAgent] Uploaded featured image to Google Drive: 1abc...xyz
[ImageAgent] Uploaded content image to Google Drive: 1def...xyz
```

### 5. 驗證 Google Drive
1. 前往你的 Google Drive 資料夾
2. 應該看到新上傳的圖片檔案
3. 檔名格式：`featured-1234567890.jpg` 或 `content-1234567890.jpg`

### 6. 檢查資料庫
查詢 `generated_articles` 表格：
```sql
SELECT
  title,
  featured_image_url,
  content_images
FROM generated_articles
ORDER BY created_at DESC
LIMIT 1;
```

URL 應為 Google Drive 格式：
```
https://drive.google.com/uc?export=view&id=1abc...xyz
```

---

## 常見問題

### Q1: 為什麼圖片上傳失敗？
**檢查清單**：
- [ ] Google Drive API 已啟用
- [ ] 環境變數已正確設定在 Vercel
- [ ] Service Account 有資料夾的編輯權限
- [ ] `GOOGLE_DRIVE_FOLDER_ID` 正確（從 URL 複製）
- [ ] `private_key` 包含完整的 `-----BEGIN/END PRIVATE KEY-----`

### Q2: Access Token 過期怎麼辦？
**解決方案**：
1. 改用 Refresh Token 自動更新（需修改程式碼）
2. 或直接改用 Service Account（推薦）

### Q3: 如何遷移現有的臨時 URL 圖片？
**腳本範例**：
```typescript
// scripts/migrate-images-to-drive.ts
import { createClient } from '@/lib/supabase/server';
import { GoogleDriveClient } from '@/lib/storage/google-drive-client';

async function migrateImages() {
  const supabase = await createClient();
  const driveClient = new GoogleDriveClient({
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
    // ... 憑證
  });

  const { data: articles } = await supabase
    .from('generated_articles')
    .select('id, featured_image_url')
    .not('featured_image_url', 'like', '%drive.google.com%');

  for (const article of articles || []) {
    try {
      const filename = `migrated-${article.id}-${Date.now()}.jpg`;
      const result = await driveClient.uploadFromUrl(
        article.featured_image_url,
        filename
      );

      await supabase
        .from('generated_articles')
        .update({ featured_image_url: result.url })
        .eq('id', article.id);

      console.log(`✅ Migrated: ${article.id}`);
    } catch (error) {
      console.error(`❌ Failed: ${article.id}`, error);
    }
  }
}
```

### Q4: 如何設定圖片權限？
**目前設定**：自動設為公開讀取（`role: 'reader', type: 'anyone'`）

**修改為私人**：
修改 `/src/lib/storage/google-drive-client.ts` 的 `uploadImage` 方法，移除：
```typescript
await this.drive.permissions.create({
  fileId: response.data.id,
  requestBody: {
    role: 'reader',
    type: 'anyone',
  },
});
```

---

## 安全建議

1. **絕對不要提交**：
   - Service Account JSON 檔案
   - Access Token
   - Private Key

2. **使用 `.gitignore`**：
   ```
   # Google Drive 憑證
   google-credentials.json
   .env.local
   ```

3. **限制 Service Account 權限**：
   - 僅授予必要的 Google Drive 存取權限
   - 不要使用擁有者或管理員權限

4. **定期輪替金鑰**：
   - 每 90 天輪替 Service Account 金鑰
   - 刪除舊的、未使用的金鑰

5. **監控使用量**：
   - 定期檢查 Google Cloud Console 的 API 使用量
   - 設定配額警報

---

## 支援與除錯

### 啟用詳細日誌
修改 `/src/lib/storage/google-drive-client.ts`：
```typescript
export class GoogleDriveClient {
  private debug = true;  // 改為 true

  private log(...args: any[]) {
    if (this.debug) {
      console.log('[GoogleDriveClient]', ...args);
    }
  }
}
```

### 聯絡資訊
如有問題，請查看：
- Google Drive API 文件：https://developers.google.com/drive/api/v3/about-sdk
- googleapis Node.js 文件：https://github.com/googleapis/google-api-nodejs-client

---

**設定完成後，所有生成的圖片將自動上傳到 Google Drive 並獲得永久 URL！**
