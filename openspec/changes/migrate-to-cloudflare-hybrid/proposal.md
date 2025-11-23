# 遷移至 Cloudflare 複合式架構（Pages 為主）

## 概述

將專案從 Vercel 遷移至 Cloudflare 複合式架構，整合 **Pages（主要部署）**、D1、R2、KV 和 Hyperdrive，實現更低成本、更高效能的部署方案。

**⚠️ 重要決策：使用 Pages 而非 Workers**

- 專案建置後 middleware.js 達 630KB，加上其他檔案超過 Workers 1MB 限制
- Pages Functions 每個路由獨立 25MB 限制，可容納大型專案
- 使用 `@cloudflare/next-on-pages` 替代 `@opennextjs/cloudflare`

## 動機

**成本優勢**

- Vercel Hobby 限制嚴格（100GB 頻寬/月）
- Google Drive API 儲存圖片產生額外費用
- Cloudflare 免費額度更慷慨且可擴展

**效能提升**

- Hyperdrive 加速資料庫連線（減少延遲 50%+）
- R2 零 egress 費用（vs S3/Google Drive）
- KV + D1 多層快取策略
- 全球邊緣運算

**架構優化**

- Pages Functions 避免 Workers 1MB 大小限制
- 每個路由獨立打包（不累積超限）
- 減少對單一服務依賴
- 更好的可觀測性和除錯

**技術可行性**

- 專案已驗證：之前嘗試 Workers 部署時超過容量限制
- Pages Functions 支援 Node.js 相容性（googleapis, sharp 可用）
- 每個 Function 25MB 限制 >> Workers 1MB 限制

## 目標架構

```
┌─────────────────────────────────────────────────┐
│              使用者請求                          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────┐
│         Cloudflare DNS & CDN                   │
└────────────────┬───────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Pages (主要部署)                    │
│  - Next.js SSR (透過 next-on-pages)            │
│  - 靜態資源 (HTML/CSS/JS/Images)                │
│  - Pages Functions (API routes, 每個 25MB)    │
│  - 自動程式碼分割（避免單一檔案過大）             │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┼────────┬────────┐
        │        │        │        │
        ▼        ▼        ▼        ▼
   ┌────────┐ ┌────┐ ┌────┐ ┌──────────┐
   │   KV   │  │   D1   │  │   R2   │
   │ 快取   │  │ 輕量DB │  │ 檔案   │
   └────────┘  └────────┘  └────────┘
                     │
                     ▼
              ┌────────────┐
              │ Hyperdrive │
              │  連線池    │
              └──────┬─────┘
                     │
                     ▼
              ┌────────────┐
              │  Supabase  │
              │ PostgreSQL │
              └────────────┘
```

## 服務分工

### 1. Cloudflare Pages（主要部署）

**用途**：所有 Next.js SSR、靜態資源和 API
**處理**：

- Next.js SSR（透過 `@cloudflare/next-on-pages`）
- 所有 API routes（每個獨立 Function，25MB 限制）
- 靜態 HTML、CSS、JavaScript
- 圖片、字型等資源
- Middleware 和路由

**免費額度**：

- 無限請求
- 無限頻寬
- 500 次建置/月
- 每個 Function 25MB（vs Workers 1MB）

**技術細節**：

- 使用 `@cloudflare/next-on-pages` 而非 `@opennextjs/cloudflare`
- 自動將每個 route 打包為獨立 Function
- 支援完整 Node.js 相容性（googleapis, sharp 等）
- 避免 Workers 1MB 總體限制問題

### 2. Cloudflare R2

**用途**：物件儲存（替代 Google Drive）
**處理**：

- 使用者上傳圖片
- AI 生成的圖片
- 文章附件
- 備份檔案

**免費額度**：

- 10 GB 儲存
- 100 萬次 Class A 操作/月（寫入）
- 1000 萬次 Class B 操作/月（讀取）

**成本優勢**：

- 零 egress 費用（下載不收費）
- 替代 Google Drive API，省去 API 呼叫費用

### 4. Cloudflare Workers KV

**用途**：鍵值快取
**處理**：

- API 響應快取
- Session 儲存
- 速率限制計數器
- 臨時資料

**免費額度**：

- 1 GB 儲存
- 100,000 次讀取/日
- 1,000 次寫入/日

### 5. Cloudflare D1

**用途**：輕量 SQLite 資料庫
**處理**：

- 高頻查詢快取（網站列表、使用者設定）
- Analytics 資料
- 臨時查詢結果
- 降低 Supabase 負載

**免費額度**：

- 500 MB 儲存
- 500 萬行讀取/月
- 10 萬行寫入/月

### 6. Cloudflare Hyperdrive

**用途**：資料庫連線加速
**處理**：

- 加速 Supabase PostgreSQL 連線
- 連線池管理
- 減少延遲和資料庫負載

**免費額度**：

- 500 萬次查詢/月
- 1,000 個並發連線

**效能提升**：

- 減少 50%+ 資料庫延遲
- 全球邊緣快取查詢結果
- 自動連線池管理

## 遷移策略

### 階段 1：基礎部署（必須）

1. Workers + OpenNext 配置
2. Pages 靜態資源部署
3. 環境變數遷移
4. CI/CD GitHub Actions

**驗收標準**：

- 網站可正常訪問
- SSR 正常運作
- API endpoints 正常

### 階段 2：儲存遷移（R2）

1. 建立 R2 bucket
2. 遷移 Google Drive 圖片上傳邏輯
3. 實作 R2 上傳/下載 API
4. 測試圖片管理功能

**驗收標準**：

- 圖片上傳到 R2 成功
- 圖片可透過 URL 訪問
- 刪除功能正常

### 階段 3：快取層（KV + D1）

1. 設定 KV namespace
2. 建立 D1 資料庫和 schema
3. 實作快取邏輯（網站列表、使用者設定）
4. 監控快取命中率

**驗收標準**：

- KV 快取 API 響應
- D1 快取高頻查詢
- 快取失效機制正常

### 階段 4：資料庫加速（Hyperdrive）

1. 建立 Hyperdrive 配置
2. 連接 Supabase PostgreSQL
3. 更新資料庫連線邏輯
4. 監控效能改善

**驗收標準**：

- 資料庫查詢延遲降低
- 連線池正常運作
- 無連線錯誤

## 成本對比

| 項目     | Vercel + Google Drive   | Cloudflare 複合方案 | 節省             |
| -------- | ----------------------- | ------------------- | ---------------- |
| 部署平台 | Vercel Hobby $0（有限） | Workers + Pages $0  | ✅ 更高額度      |
| 圖片儲存 | Google Drive API 費用   | R2 免費 10GB        | 💰 省 $5-20/月   |
| 快取     | 無                      | KV + D1 免費        | ⚡ 新功能        |
| 資料庫   | Supabase 直連           | Hyperdrive 加速     | 🚀 效能提升      |
| 頻寬     | 100GB/月限制            | 無限                | ✅ 無限制        |
| **總計** | **受限且有額外費用**    | **全免費且更強大**  | **每月省 $5-50** |

## 風險與緩解

### 風險 1：OpenNext 與 Next.js 相容性

**緩解**：

- OpenNext 已支援 Next.js 14/15
- 專案已有 `open-next.config.ts` 配置
- 本地測試 `npm run preview:cf` 驗證

### 風險 2：Workers CPU 時間限制

**緩解**：

- AI 生成等重任務保留在 Workers
- 輕量操作移到 Pages Functions
- 使用 D1/KV 快取減少運算

### 風險 3：資料遷移（Google Drive → R2）

**緩解**：

- 階段性遷移，保留 Google Drive 作為備援
- 先遷移新上傳，再批次遷移舊資料
- 實作雙寫機制確保資料完整

### 風險 4：學習曲線

**緩解**：

- Cloudflare 文檔完善
- 社群活躍（Discord, GitHub）
- 逐步啟用服務，降低複雜度

## 時程規劃

| 階段 | 工作內容                 | 預估時間 | 優先級 |
| ---- | ------------------------ | -------- | ------ |
| 1    | Workers + Pages 基礎部署 | 2-3 天   | 🔴 高  |
| 2    | R2 儲存遷移              | 1-2 天   | 🟡 中  |
| 3    | KV + D1 快取層           | 2-3 天   | 🟢 低  |
| 4    | Hyperdrive 資料庫加速    | 1 天     | 🟢 低  |
| 5    | 監控和優化               | 持續     | 🟡 中  |

**總計**：6-9 天完成完整遷移

## 成功指標

1. **可用性**：99.9% uptime（透過 Cloudflare 監控）
2. **效能**：
   - 頁面載入時間 < 2 秒
   - API 響應時間 < 500ms
   - 資料庫查詢延遲降低 50%+
3. **成本**：
   - 每月費用降至 $0（免費額度內）
   - 無超額費用
4. **使用者體驗**：
   - 無功能退化
   - 圖片載入速度提升
   - 無停機時間

## 參考資源

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [OpenNext Cloudflare 整合](https://opennext.js.org/cloudflare)
- [Hyperdrive 指南](https://developers.cloudflare.com/hyperdrive/)
- [R2 物件儲存](https://developers.cloudflare.com/r2/)
- [D1 資料庫](https://developers.cloudflare.com/d1/)
