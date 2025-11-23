# google-drive-upload Specification

## Purpose

Defines requirements for image storage in ImageAgent, transitioning from Google Drive to Cloudflare R2 for cost optimization and architectural simplification.

## MODIFIED Requirements

### Requirement: 圖片儲存服務選擇

ImageAgent MUST use Cloudflare R2 as the exclusive image storage service.

#### Scenario: 使用 R2 上傳精選圖片

**Given** R2 環境變數已正確配置：

```
R2_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=xyz789
R2_SECRET_ACCESS_KEY=secret
R2_BUCKET_NAME=my-images
```

**When** ImageAgent 生成精選圖片並完成壓縮
**Then** 初始化 R2Client：

```typescript
const r2Config = getR2Config();
const r2Client = new R2Client(r2Config);
```

**And** 呼叫 `r2Client.uploadImage(base64Data, filename, 'image/jpeg')`
**And** 取得 R2 公開 URL：`https://pub-{accountId}.r2.dev/images/{filename}`
**And** 設定 `finalUrl` 為 R2 URL
**And** Console 輸出：`[ImageAgent] ☁️ Uploaded featured image to R2: {fileKey}`

#### Scenario: 使用 R2 上傳內容圖片

**Given** R2 配置已設定
**And** 正在生成第 N 張內容圖片
**When** ImageAgent 完成內容圖片壓縮
**Then** 呼叫 `r2Client.uploadImage()` 上傳至 R2
**And** 檔名格式為：`article-content-{index+1}-{timestamp}.jpg`
**And** 設定 `finalUrl` 為 R2 URL
**And** Console 輸出：`[ImageAgent] ☁️ Uploaded content image {index+1} to R2: {fileKey}`

#### Scenario: R2 配置缺失時的 Fallback

**Given** R2 環境變數未設定或不完整
**When** ImageAgent 嘗試取得 R2 配置
**Then** `getR2Config()` 返回 `null`
**And** Console 輸出：`[R2] Not configured, using OpenAI URL`
**And** 使用原始 OpenAI 圖片 URL（不上傳）
**And** 不拋出錯誤（graceful degradation）

#### Scenario: R2 上傳失敗時的錯誤處理

**Given** R2 配置正確但網路或權限錯誤
**When** `r2Client.uploadImage()` 拋出異常
**Then** 捕獲錯誤並記錄警告：

```typescript
console.warn(
  "[ImageAgent] Failed to upload to R2, using original URL:",
  error.message,
);
```

**And** 使用原始 OpenAI URL 作為 fallback
**And** 繼續執行（不中斷文章生成）

## REMOVED Requirements

### Requirement: Google Drive 上傳（已移除）

~~ImageAgent 使用 Google Drive 儲存圖片~~（已完全移除）

#### Scenario: ~~使用 Google Drive 上傳~~ （已刪除）

**此需求已被移除**，所有 Google Drive 相關邏輯已被 R2 替代。

## ADDED Requirements

### Requirement: R2 圖片壓縮和上傳流程

ImageAgent MUST compress images before uploading to R2 to optimize storage and bandwidth.

#### Scenario: 壓縮後上傳到 R2

**Given** 已生成原始圖片（OpenAI base64 format）
**When** 準備上傳到 R2
**Then** 先呼叫 `processBase64Image()` 壓縮圖片：

```typescript
const processed = await processBase64Image(result.url, {
  format: "jpeg",
  quality: 85,
  maxWidth: 1920,
  maxHeight: 1920,
});
```

**And** 計算壓縮比例並記錄：

```typescript
const compressionRatio = calculateCompressionRatio(
  originalSize,
  processed.size,
);
console.log(
  `[ImageAgent] ✅ Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(processed.size)} (${compressionRatio}% reduction)`,
);
```

**And** 轉換為 base64 後上傳：

```typescript
const base64Data = processed.buffer.toString("base64");
await r2Client.uploadImage(base64Data, filename, "image/jpeg");
```

#### Scenario: R2 URL 格式驗證

**Given** 圖片已成功上傳到 R2
**When** R2Client 返回 URL
**Then** URL 格式必須為：`https://pub-{accountId}.r2.dev/images/{fileKey}`
**And** `fileKey` 包含時間戳和原始檔名
**And** URL 可直接訪問（公開讀取權限）

### Requirement: 移除 Google Drive 依賴

The system MUST completely remove googleapis dependencies and all related code.

#### Scenario: ImageAgent 不再導入 GoogleDriveClient

**Given** 正在檢查 `src/lib/agents/image-agent.ts`
**When** 檢視 import 區塊
**Then** 不存在以下導入：

```typescript
import {
  GoogleDriveClient,
  getGoogleDriveConfig,
} from "@/lib/storage/google-drive-client";
```

**And** 只存在 R2 相關導入：

```typescript
import { R2Client, getR2Config } from "@/lib/storage/r2-client";
```

#### Scenario: package.json 已移除 googleapis

**Given** 正在檢查專案依賴
**When** 執行 `pnpm list googleapis`
**Then** 返回錯誤：套件未安裝
**And** `package.json` 的 `dependencies` 不包含 `googleapis`

#### Scenario: 環境變數範例已更新

**Given** 正在檢查 `.env.example`
**When** 搜尋 Google Drive 相關變數
**Then** 所有 `GOOGLE_DRIVE_*` 變數已被註解或移除
**And** R2 變數完整存在：

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```
