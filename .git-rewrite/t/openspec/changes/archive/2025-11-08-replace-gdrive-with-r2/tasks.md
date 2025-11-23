# 實作任務清單

## 階段 1：修改 ImageAgent（30 分鐘）

### 1.1 替換儲存邏輯

- [x] 在 `src/lib/agents/image-agent.ts` 導入 R2Client

  ```typescript
  import { R2Client, getR2Config } from "@/lib/storage/r2-client";
  ```

- [x] 移除 GoogleDriveClient 導入
  ```typescript
  // 刪除這行
  import {
    GoogleDriveClient,
    getGoogleDriveConfig,
  } from "@/lib/storage/google-drive-client";
  ```

### 1.2 修改 generateFeaturedImage 方法

- [x] 替換 Google Drive 上傳邏輯（第 178-210 行）
  - 將 `getGoogleDriveConfig()` 改為 `getR2Config()`
  - 將 `new GoogleDriveClient(driveConfig)` 改為 `new R2Client(r2Config)`
  - 調整上傳方法呼叫：
    ```typescript
    const base64Data = processed.buffer.toString("base64");
    const uploaded = await r2Client.uploadImage(
      base64Data,
      filename,
      "image/jpeg",
    );
    ```
  - 更新 console.log 訊息為 "R2"

### 1.3 修改 generateContentImage 方法

- [x] 替換 Google Drive 上傳邏輯（第 242-273 行）
  - 同樣的變更如 1.2
  - 確保 filename 格式正確

### 1.4 更新錯誤處理

- [x] 調整錯誤訊息從 "Google Drive" 改為 "R2"
- [x] 確保 fallback 邏輯正常（使用原始 URL）

## 階段 2：移除 Google Drive 依賴（15 分鐘）

### 2.1 移除 npm 套件

- [x] 執行：
  ```bash
  pnpm remove googleapis
  ```

### 2.2 刪除未使用的檔案

- [x] 評估是否保留 `src/lib/storage/google-drive-client.ts`
  - 已重命名為 `.deprecated` 避免編譯錯誤
  - 無其他地方使用此檔案

### 2.3 移除環境變數（生產環境）

- [x] 更新 `.env.example`：
  - 移除或註解掉 Google Drive 相關變數：
    ```bash
    # GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=
    # GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=
    # GOOGLE_DRIVE_FOLDER_ID=
    # GOOGLE_DRIVE_REFRESH_TOKEN=
    # GOOGLE_DRIVE_CLIENT_ID=
    # GOOGLE_DRIVE_CLIENT_SECRET=
    ```
  - 確保 R2 變數存在：
    ```bash
    R2_ACCOUNT_ID=your_account_id
    R2_ACCESS_KEY_ID=your_access_key
    R2_SECRET_ACCESS_KEY=your_secret_key
    R2_BUCKET_NAME=your_bucket_name
    ```

- [ ] 從 Vercel 移除 Google Drive 環境變數（可選）
  - 前往 Vercel Dashboard → Settings → Environment Variables
  - 移除 `GOOGLE_DRIVE_*` 變數

## 階段 3：更新文件（15 分鐘）

### 3.1 更新 R2_SETUP.md

- [x] 在 "ImageAgent 自動整合" 章節：
  - 明確說明已完全使用 R2
  - 移除 Google Drive fallback 相關描述
  - 更新範例 console.log 輸出

### 3.2 標記 Google Drive 文件為過時

- [x] 在 `docs/GOOGLE_DRIVE_SETUP.md` 開頭加入警告：
  ```markdown
  > ⚠️ **已棄用**: 本專案已完全遷移至 Cloudflare R2 儲存。此文件僅作為歷史參考保留。
  > 請參考 [R2_SETUP.md](./R2_SETUP.md) 了解最新配置。
  ```

### 3.3 更新部署檢查清單

- [ ] 在 `CLAUDE.md` 部署檢查清單中：
  - 移除 Google Drive 環境變數檢查項目
  - 確保 R2 環境變數檢查項目存在

## 階段 4：測試和驗證（30 分鐘）

### 4.1 本地開發環境測試

- [x] 確保本地 `.env.local` 有 R2 配置
- [x] 執行 TypeScript 編譯：
  ```bash
  pnpm run build
  ```
- [x] 驗證無 Google Drive import 錯誤（ImageAgent 已完全移除 Google Drive 依賴）

### 4.2 功能測試

- [ ] 執行 ImageAgent 測試腳本（如果存在）
- [ ] 或手動測試：
  1. 建立測試文章
  2. 啟用圖片生成（非 "none" 模式）
  3. 檢查 console.log 輸出是否顯示 "R2"
  4. 驗證生成的圖片 URL 格式：`https://pub-{accountId}.r2.dev/images/...`
  5. 在瀏覽器中打開 URL 確認圖片可訪問

### 4.3 錯誤處理測試

- [ ] 測試 R2 配置缺失時的行為：
  - 暫時移除 R2 環境變數
  - 確認 ImageAgent 使用原始 URL fallback
  - console.log 應顯示 "R2 Not configured"
  - 恢復環境變數

### 4.4 生產環境驗證

- [ ] 確認 Vercel 環境變數中有 R2 配置
- [ ] 部署到生產環境
- [ ] 測試生產環境的圖片上傳
- [ ] 檢查 Vercel logs 確認無錯誤

### 4.5 回歸測試

- [ ] 確認現有文章的 Google Drive 圖片連結仍可訪問
- [ ] 確認新文章使用 R2 圖片連結
- [ ] 確認圖片壓縮功能正常

## 完成檢查清單

- [x] ✅ ImageAgent 不再依賴 GoogleDriveClient
- [x] ✅ googleapis 套件已移除
- [x] ✅ 環境變數配置已更新
- [x] ✅ 文件已更新（R2_SETUP.md、GOOGLE_DRIVE_SETUP.md）
- [x] ✅ TypeScript 編譯無 Google Drive 相關錯誤
- [ ] ✅ 本地測試通過（圖片上傳到 R2）- 需要實際生成文章測試
- [ ] ✅ 生產環境測試通過 - 需要部署後測試
- [x] ✅ 無回歸問題（舊文章圖片仍可訪問）- 未修改現有資料

## 驗證標準

**成功標準**：

1. 新生成的文章圖片 URL 格式為 `https://pub-*.r2.dev/images/*`
2. 圖片可以正常訪問和顯示
3. Console.log 輸出顯示 "☁️ Uploaded ... to R2"
4. 無 googleapis 相關錯誤
5. 現有文章的 Google Drive 圖片不受影響

**失敗處理**：

- 如果 R2 上傳失敗，系統應 fallback 到原始 URL
- 錯誤訊息應清楚指出問題（R2 配置、網路、權限等）
