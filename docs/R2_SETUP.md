# Cloudflare R2 儲存設定指南

## 為什麼使用 R2？

Cloudflare R2 是一個 S3 相容的物件儲存服務，相較於 Google Drive 有以下優勢：

### R2 優勢

- ✅ **零出站費用** - 免費的資料傳輸
- ✅ **無 CORS 限制** - 圖片可直接嵌入網頁
- ✅ **10GB 免費儲存** - 每月免費額度
- ✅ **CDN 加速** - Cloudflare 全球網路
- ✅ **公開 URL 存取** - 直接的 HTTP 存取
- ✅ **穩定可靠** - 企業級基礎設施

### Google Drive 問題

- ❌ CORS 跨域限制導致圖片破損
- ❌ 需要 Google 認證才能存取
- ❌ URL 會觸發下載而非直接顯示
- ❌ URL 不穩定，可能隨政策變更
- ❌ 速度較慢，無 CDN 加速

## 快速開始

### 1. 建立 Cloudflare R2 Bucket

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 選擇 **R2 Object Storage**
3. 點擊 **Create bucket**
4. 輸入 Bucket 名稱（例如：`article-images`）
5. 選擇區域（建議選擇離你最近的區域）
6. 點擊 **Create bucket**

### 2. 啟用公開存取

1. 進入剛建立的 Bucket
2. 前往 **Settings** 標籤
3. 在 **Public access** 區域點擊 **Allow Access**
4. 記下 **Public bucket URL**（格式：`https://pub-{account-id}.r2.dev`）

### 3. 建立 API Token

1. 在 Cloudflare Dashboard 中，前往 **R2** → **Manage R2 API Tokens**
2. 點擊 **Create API token**
3. 設定權限：
   - **Token name**: `article-image-upload`
   - **Permissions**: 選擇 **Object Read & Write**
   - **Apply to buckets**: 選擇你的 bucket
4. 點擊 **Create API Token**
5. **重要**：複製並安全保存以下資訊：
   - Access Key ID
   - Secret Access Key
   - Account ID

⚠️ **警告**：Secret Access Key 只會顯示一次，請立即複製並妥善保存！

### 4. 配置環境變數

在 `.env.local` 文件中新增以下環境變數：

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=你的帳號ID
R2_ACCESS_KEY_ID=你的Access_Key_ID
R2_SECRET_ACCESS_KEY=你的Secret_Access_Key
R2_BUCKET_NAME=你的Bucket名稱
```

範例：

```bash
R2_ACCOUNT_ID=a1b2c3d4e5f6g7h8i9j0
R2_ACCESS_KEY_ID=1234567890abcdef1234567890abcdef
R2_SECRET_ACCESS_KEY=abcdef1234567890abcdef1234567890abcdef1234567890
R2_BUCKET_NAME=article-images
```

### 5. 測試 R2 連接

執行測試腳本確認設定正確：

```bash
npx tsx scripts/test-r2-upload.ts
```

成功的輸出應該如下：

```
=== R2 上傳測試 ===

1. 檢查環境變數配置...
✅ 環境變數配置完整

2. 初始化 R2 客戶端...
✅ R2 客戶端初始化成功

3. 準備測試圖片...
4. 上傳測試圖片到 R2...
✅ 圖片上傳成功！

上傳結果:
   URL: https://pub-{account-id}.r2.dev/images/1234567890-test-image.png
   File Key: images/1234567890-test-image.png
   Size: 68 bytes

5. 測試取得簽署 URL...
✅ 簽署 URL 生成成功

=== ✅ R2 測試完成 ===
```

### 6. 驗證圖片可存取

在瀏覽器中開啟測試腳本輸出的 URL，確認圖片可以正常顯示。

## 使用說明

### ImageAgent 自動整合

✅ **已完全整合**：系統已將 R2 作為唯一圖片儲存方案，移除 Google Drive 依賴。

1. **生成文章時**，ImageAgent 會自動：
   - 使用 OpenAI 生成圖片
   - 將圖片壓縮為 JPEG 格式（quality: 85%）
   - **上傳到 R2 bucket**（不再使用 Google Drive）
   - 在資料庫中儲存 R2 公開 URL

2. **前端顯示時**，直接使用 R2 URL：
   ```html
   <img
     src="https://pub-{account-id}.r2.dev/images/article-hero-{timestamp}.jpg"
   />
   ```

### 圖片壓縮策略

為了優化儲存空間和載入速度，系統會自動：

- **格式轉換**：PNG → JPEG
- **品質壓縮**：85% quality（平衡品質和檔案大小）
- **尺寸限制**：最大寬度 1920px，最大高度 1920px
- **壓縮比率**：通常可減少 60-80% 檔案大小

範例輸出：

```
[ImageAgent] ✅ Compressed: 2.5 MB → 450 KB (82% reduction)
[ImageAgent] ☁️ Uploaded featured image to R2: images/article-hero-1234567890.jpg
```

### Fallback 機制

如果 R2 未配置或上傳失敗，系統會自動 fallback：

1. Console 輸出警告訊息：`[ImageAgent] Failed to upload to R2, using original URL: {error}`
2. 使用 OpenAI 原始 URL（臨時 URL，60 分鐘有效）
3. 繼續文章生成流程，不中斷

**不再支援 Google Drive fallback**：專案已完全移除 Google Drive 整合。

## 成本估算

Cloudflare R2 免費方案：

- **儲存空間**：10 GB/月
- **Class A 操作**（寫入）：100 萬次/月
- **Class B 操作**（讀取）：1000 萬次/月
- **出站流量**：無限制（完全免費）

### 實際使用估算

假設每篇文章 4 張圖片，每張壓縮後 500 KB：

- **每篇文章儲存**: 2 MB
- **免費額度可存**: 5000 篇文章
- **每月寫入操作**: 4 次/篇（通常不會超過 100 萬次）
- **每月讀取操作**: 取決於文章瀏覽量（通常不會超過 1000 萬次）

✅ **結論**：對於大多數使用情境，R2 完全免費！

## 進階配置

### 自訂 CDN 網域

你可以為 R2 bucket 設定自訂網域：

1. 在 R2 bucket 設定中，找到 **Custom Domains**
2. 點擊 **Connect Domain**
3. 輸入你的網域（例如：`images.yourdomain.com`）
4. 按照指示完成 DNS 設定

設定完成後，圖片 URL 會變成：

```
https://images.yourdomain.com/images/article-hero-1234567890.jpg
```

### 設定快取策略

在上傳圖片時，R2Client 已經設定了最佳化的快取策略：

```typescript
CacheControl: "public, max-age=31536000"; // 1 年
```

這表示：

- 圖片會被瀏覽器快取 1 年
- CDN 也會快取圖片
- 減少重複請求，提升載入速度

### 批次操作

如果需要批次上傳或管理圖片，可以使用 AWS CLI 工具：

```bash
# 安裝 AWS CLI
brew install awscli

# 配置 R2
aws configure
# 輸入 R2_ACCESS_KEY_ID
# 輸入 R2_SECRET_ACCESS_KEY
# Region: auto
# Output format: json

# 列出所有檔案
aws s3 ls s3://your-bucket-name --endpoint-url https://{account-id}.r2.cloudflarestorage.com

# 批次上傳
aws s3 sync ./local-images s3://your-bucket-name/images --endpoint-url https://{account-id}.r2.cloudflarestorage.com
```

## 故障排除

### 問題 0: macOS 本地開發 SSL 兼容性問題

**錯誤**：`write EPROTO ... SSL routines:ssl3_read_bytes:sslv3 alert handshake failure`

**原因**：macOS 使用 LibreSSL 而非標準 OpenSSL，與 AWS SDK 存在兼容性問題

**影響範圍**：

- ❌ 僅影響 macOS 本地開發環境
- ✅ **不影響生產環境** (Vercel 使用 Linux + OpenSSL)
- ✅ ImageAgent 在生產環境中可以正常上傳到 R2

**解決方案**：

#### 方案 1：暫時跳過 R2 配置（推薦用於本地開發）

在本地開發時，ImageAgent 會自動使用 OpenAI 原始 URL 作為 fallback：

```bash
# 不設定 R2 環境變數，或者註解掉
# R2_ACCOUNT_ID=...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET_NAME=...
```

系統會顯示警告並繼續使用 OpenAI URL：

```
[R2] Not configured, using OpenAI URL
```

#### 方案 2：使用 Docker 進行本地開發測試

使用 Linux 容器可以避免 LibreSSL 問題：

```bash
# 建立 Dockerfile.dev
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# 使用 docker-compose
docker-compose up dev
```

#### 方案 3：等待 Vercel 部署後驗證

最簡單的方法是直接部署到 Vercel 驗證 R2 功能：

1. 在 Vercel Dashboard 設定所有 R2 環境變數
2. 部署專案
3. 在生產環境測試文章生成
4. 檢查圖片 URL 是否為 R2 域名

**驗證方法**：

檢查生產環境的文章圖片 URL：

```bash
# 應該是 R2 域名
https://pub-{account-id}.r2.dev/images/article-hero-*.jpg

# 而非 OpenAI 臨時 URL
https://oaidalleapiprodscus.blob.core.windows.net/...
```

### 問題 1: 環境變數缺失

**錯誤**：`缺少 R2 配置環境變數`

**解決**：

1. 確認 `.env.local` 文件存在
2. 檢查所有必要環境變數都已設定
3. 重新啟動開發伺服器

### 問題 2: 上傳失敗

**錯誤**：`Failed to upload to R2: Access Denied`

**解決**：

1. 確認 API Token 權限包含 **Object Read & Write**
2. 確認 Token 適用於正確的 Bucket
3. 檢查 `R2_ACCOUNT_ID` 是否正確

### 問題 3: 圖片無法顯示

**錯誤**：圖片 URL 返回 403 或 404

**解決**：

1. 確認 Bucket 已啟用 **Public Access**
2. 檢查圖片檔案是否確實上傳成功
3. 確認 URL 格式正確：`https://pub-{account-id}.r2.dev/{file-key}`

### 問題 4: CORS 錯誤（極少發生）

如果遇到 CORS 錯誤，可以在 Bucket 設定中配置 CORS 政策：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

## 監控與管理

### 查看使用量

1. 前往 Cloudflare Dashboard → **R2**
2. 選擇你的 bucket
3. 查看 **Metrics** 標籤
4. 可以看到：
   - 儲存空間使用量
   - 請求數量
   - 出站流量

### 設定警報

你可以在 Cloudflare 中設定用量警報：

1. 前往 **Notifications**
2. 建立新的警報
3. 選擇 **R2 usage threshold**
4. 設定閾值和通知方式

## 從 Google Drive 遷移

如果你目前使用 Google Drive，遷移到 R2 非常簡單：

1. **設定 R2 環境變數**（參考上述步驟）
2. **測試 R2 連接**（執行測試腳本）
3. **生成新文章**會自動使用 R2
4. **舊文章**的圖片仍使用 Google Drive URL

如果需要批次遷移舊文章的圖片，請參考 `scripts/migrate-images-to-r2.ts`（待建立）。

## 支援與資源

- [Cloudflare R2 官方文件](https://developers.cloudflare.com/r2/)
- [R2 定價](https://developers.cloudflare.com/r2/pricing/)
- [AWS S3 SDK 文件](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)

如有問題，請提交 Issue 到專案 GitHub repository。
