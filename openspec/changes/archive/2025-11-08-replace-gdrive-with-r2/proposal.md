# 以 Cloudflare R2 完全替代 Google Drive 圖片儲存

## Why

**成本優勢**

- Google Drive API 有配額限制和潛在費用
- R2 提供零 egress 費用（下載不收費）
- R2 免費額度：10 GB 儲存 + 100萬次寫入/月 + 1000萬次讀取/月

**架構簡化**

- 移除 googleapis 依賴（減少 bundle size）
- 統一儲存服務（與未來 Cloudflare 遷移計畫一致）
- 更少的環境變數配置

**效能提升**

- R2 全球邊緣網路，延遲更低
- 直接使用 AWS S3 相容 API，更穩定
- 無需 OAuth 認證流程

## What Changes

1. ✅ **ImageAgent 完全使用 R2**
   - 移除 Google Drive 上傳邏輯
   - 使用 R2Client 替代 GoogleDriveClient
   - 保持相同的壓縮和處理流程

2. ✅ **清理依賴**
   - 移除 googleapis 套件
   - 刪除 Google Drive 相關環境變數
   - 移除未使用的程式碼

3. ✅ **確保向後相容**
   - 現有文章的 Google Drive 圖片 URL 保持可用
   - 只影響新生成的圖片
   - 無需遷移舊資料

## Impact

### 受影響的檔案

1. **ImageAgent** (`src/lib/agents/image-agent.ts`)
   - 替換 `GoogleDriveClient` 為 `R2Client`
   - 更新上傳邏輯
   - 調整錯誤處理

2. **依賴** (`package.json`)
   - 移除 `googleapis` 套件

3. **環境變數** (`.env.example`)
   - 移除 Google Drive 相關變數
   - 確保 R2 變數完整

4. **文件**
   - 更新 R2_SETUP.md
   - 標記 GOOGLE_DRIVE_SETUP.md 為過時

### 不受影響

- 現有文章的 Google Drive 圖片連結
- 資料庫 schema
- 其他 Agents
- API endpoints

## 技術方案

### 修改前（Google Drive）

```typescript
const driveConfig = getGoogleDriveConfig();
if (driveConfig) {
  const driveClient = new GoogleDriveClient(driveConfig);
  const uploaded = await driveClient.uploadFromUrl(dataUrl, filename);
  finalUrl = uploaded.url;
}
```

### 修改後（R2）

```typescript
const r2Config = getR2Config();
if (r2Config) {
  const r2Client = new R2Client(r2Config);
  const base64Data = processed.buffer.toString("base64");
  const uploaded = await r2Client.uploadImage(
    base64Data,
    filename,
    "image/jpeg",
  );
  finalUrl = uploaded.url;
}
```

## 風險與緩解

### 風險 1: R2 服務中斷

**緩解**:

- R2 SLA 99.9%，高於 Google Drive
- 實作錯誤處理，失敗時返回原始 URL
- 監控上傳成功率

### 風險 2: 舊文章 Google Drive 連結失效

**緩解**:

- 本次變更不影響現有連結
- Google Drive 檔案保持不變
- 未來可選擇性批次遷移

### 風險 3: 環境變數缺失

**緩解**:

- 更新 .env.example 明確標示
- 在部署檢查清單中加入 R2 配置驗證
- 實作環境變數驗證工具

## 時程規劃

| 階段     | 工作內容               | 預估時間     |
| -------- | ---------------------- | ------------ |
| 1        | 修改 ImageAgent        | 30 分鐘      |
| 2        | 移除 Google Drive 依賴 | 15 分鐘      |
| 3        | 更新環境變數和文件     | 15 分鐘      |
| 4        | 測試和驗證             | 30 分鐘      |
| **總計** |                        | **1.5 小時** |

## 成功指標

1. ✅ ImageAgent 生成的圖片上傳到 R2
2. ✅ 圖片 URL 格式正確且可訪問
3. ✅ 無 googleapis 依賴
4. ✅ 環境變數配置簡化
5. ✅ 本地和生產環境測試通過

## 參考資源

- [Cloudflare R2 文檔](https://developers.cloudflare.com/r2/)
- [AWS S3 API 相容性](https://developers.cloudflare.com/r2/api/s3/)
- 現有 R2Client 實作：`src/lib/storage/r2-client.ts`
