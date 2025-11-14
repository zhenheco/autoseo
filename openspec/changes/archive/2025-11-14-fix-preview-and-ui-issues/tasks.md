# Tasks

## 階段一：修正文章預覽顯示（含安全性強化）

### 1.1 安裝 HTML 淨化函式庫

- [x] 安裝 isomorphic-dompurify
  - 執行 `npm install isomorphic-dompurify`
  - 執行 `npm install --save-dev @types/dompurify`
  - 驗證套件安裝成功

### 1.2 實作 HTML 淨化服務（伺服器端）

- [x] 建立 HTML 淨化工具
  - 建立 `src/lib/security/html-sanitizer.ts`（已存在並擴充）
  - 實作 `sanitizeArticleHtml(rawHTML: string): string` 函數
  - 配置 DOMPurify 允許的標籤清單
  - 配置 DOMPurify 允許的屬性清單
  - 移除所有事件處理器（onclick, onerror 等）
  - 移除所有 `<script>` 標籤
  - 移除 `data-*` 屬性（除非明確允許）

- [ ] 新增 HTML 淨化單元測試（可選，未在此次變更範圍）
  - 建立 `src/lib/security/__tests__/html-sanitizer.test.ts`
  - 測試移除 `<script>` 標籤
  - 測試移除事件處理器屬性
  - 測試保留安全的 HTML 標籤和屬性
  - 測試圖片 `src` 屬性淨化

### 1.3 實作圖片來源驗證

- [x] 建立圖片來源驗證器
  - 建立 `src/lib/security/image-validator.ts`
  - 定義 `TRUSTED_IMAGE_SOURCES` 常數（包含 Google Drive、自有網域）
  - 實作 `validateImageURL(url: string): boolean` 函數
  - 驗證圖片 URL 協議（只允許 https）
  - 驗證圖片URL 域名（只允許信任的來源）
  - 拒絕 `javascript:` 等不安全協議

- [ ] 新增圖片驗證單元測試（可選，未在此次變更範圍）
  - 測試 Google Drive URL 通過驗證
  - 測試不安全協議被拒絕
  - 測試未知域名被拒絕

### 1.4 修改預覽頁面實作客戶端淨化

- [x] 重構預覽頁面為 Client Component
  - 建立 `src/components/article/ArticleHtmlPreview.tsx` 客戶端組件
  - 使用 `'use client'` 指令
  - 匯入 `isomorphic-dompurify`
  - 匯入 `useMemo` hook from React

- [x] 實作客戶端 HTML 淨化
  - 使用 `useMemo(() => sanitizeArticleHtml(htmlContent), [htmlContent])`
  - 快取淨化後的 HTML，避免重複淨化
  - 使用 `dangerouslySetInnerHTML={{ __html: sanitizedHTML }}` 渲染
  - 在預覽頁面整合 `ArticleHtmlPreview` 組件
  - 已處理 `html_content` 存在性檢查

- [ ] 調整 Markdown 原始碼顯示（可選，未在此次變更範圍）
  - Markdown 原始碼保持現狀，已標註為「次要資訊」

### 1.5 實作 Content Security Policy（CSP）

- [x] 新增 CSP 設定到 Next.js
  - 修改 `next.config.js`（專案使用 .js 而非 .ts）
  - 新增 `headers()` 函數配置 CSP
  - 設定 `default-src 'self'`
  - 設定 `script-src 'self' 'unsafe-inline' 'unsafe-eval'`（開發環境需要）
  - 設定 `style-src 'self' 'unsafe-inline'`
  - 設定 `img-src 'self' https://drive.google.com https://*.googleusercontent.com https://*.supabase.co blob: data:`
  - 設定 `object-src 'none'`
  - 設定 `base-uri 'self'`
  - 設定 `frame-ancestors 'none'`
  - 設定 `form-action 'self'`
  - 設定 `upgrade-insecure-requests`

- [x] 新增額外安全 headers
  - 新增 `X-Content-Type-Options: nosniff`
  - 新增 `X-Frame-Options: DENY`
  - 新增 `Referrer-Policy: strict-origin-when-cross-origin`
  - 同時更新 `images.remotePatterns` 允許 Google Drive 和 googleusercontent.com

### 1.6 驗證預覽功能

- [ ] 測試 HTML 渲染
  - 建立測試文章並檢查預覽頁面
  - 驗證 HTML 內容正確渲染
  - 驗證樣式和排版正常

- [ ] 測試圖片顯示
  - 測試 Google Drive 圖片載入
  - 測試特色圖片顯示（lines 102-124）
  - 測試內文圖片嵌入
  - 驗證圖片響應式佈局

- [ ] 測試安全性
  - 嘗試注入 `<script>` 標籤，確認被移除
  - 嘗試注入事件處理器，確認被移除
  - 檢查瀏覽器開發者工具的 CSP 警告
  - 測試不同瀏覽器（Chrome、Safari、Firefox）

## 階段二：移除批次清除進行中任務功能

### 2.1 移除前端 UI

- [x] 從文章列表頁面移除批次清除按鈕
  - 開啟 `src/app/(dashboard)/dashboard/articles/page.tsx`
  - 搜尋「清除進行中」或 "clear pending" 相關文字
  - 移除按鈕 UI 組件（Button component）
  - 移除按鈕的父容器中的按鈕（保留 ArticleGenerationButtonsWrapper）

### 2.2 移除前端邏輯

- [x] 清理事件處理和狀態
  - 移除 `handleClearJobs` 事件處理函數
  - 移除相關狀態變數（無，該功能未使用額外狀態）
  - 移除 success/error toast 通知相關代碼（使用內建 alert，已移除）
  - 清理不再使用的 imports（無需清理）

### 2.3 刪除後端 API

- [x] 刪除批次清除 API 路由
  - 已刪除 `src/app/api/articles/jobs/clear/` 目錄
  - 確認沒有其他地方調用此 API

### 2.4 清理相關代碼

- [x] 移除類型定義和註解
  - 無額外類型定義需要清理
  - 相關代碼已完全移除

## 階段三：修復 Token 餘額扣款功能（實作冪等性）

**註記**: 此階段的任務已決定分離至獨立的 OpenSpec 變更中實作，因為：
1. Token 扣款功能需要複雜的資料庫 schema 和 migration
2. 需要實作 PostgreSQL 儲存程序（stored procedure）
3. 涉及冪等性設計和重試邏輯
4. 需要完整的測試和對帳機制
5. 風險較高，應獨立處理和驗證

以下任務僅作為參考，實際實作將在新的 OpenSpec 變更中進行。

### 3.1 建立資料庫 schema

- [ ] 建立 Token 扣款記錄表
  - 建立 migration 檔案 `supabase/migrations/YYYYMMDD_token_deduction_records.sql`
  - 定義 `token_deduction_records` 表 schema：
    - `id` UUID PRIMARY KEY
    - `idempotency_key` TEXT UNIQUE NOT NULL
    - `company_id` UUID NOT NULL
    - `article_id` UUID NULL
    - `amount` INTEGER NOT NULL
    - `status` TEXT NOT NULL (pending/completed/failed/compensated)
    - `balance_before` INTEGER NOT NULL
    - `balance_after` INTEGER NULL
    - `error_message` TEXT NULL
    - `retry_count` INTEGER DEFAULT 0
    - `created_at` TIMESTAMP NOT NULL
    - `completed_at` TIMESTAMP NULL
  - 建立索引：`CREATE UNIQUE INDEX idx_idempotency_key ON token_deduction_records(idempotency_key)`
  - 執行 migration

- [ ] 建立原子扣款儲存程序
  - 建立 `deduct_tokens_atomic` PostgreSQL function
  - 使用 `SELECT ... FOR UPDATE` 鎖定訂閱記錄
  - 檢查餘額是否足夠
  - 更新 `monthly_quota_balance` 和 `purchased_token_balance`
  - 插入 `token_usage_logs` 記錄
  - 更新 `token_deduction_records.status`
  - 確保所有操作在同一個事務中

### 3.2 實作冪等性 Token 計費服務

- [ ] 建立冪等性計費服務類別
  - 建立或修改 `src/lib/billing/token-billing-service.ts`
  - 實作 `deductTokensIdempotent()` 方法
  - 使用 article_job_id 作為 idempotency_key
  - 檢查是否已存在相同 idempotency_key 的記錄
  - 處理 completed/pending/failed 三種狀態
  - 建立 pending 記錄後再執行扣款

- [ ] 實作重試邏輯
  - 建立 `retryWithBackoff()` 輔助函數
  - 實作指數退避策略（1s, 2s, 4s）
  - 最多重試 3 次
  - 區分可重試和不可重試的錯誤
  - 記錄重試次數到 `retry_count` 欄位

### 3.3 整合文章生成流程

- [ ] 修改文章生成 API
  - 修改 `src/app/api/articles/generate/route.ts`
  - 在建立 article_job 時生成 idempotency_key
  - 將 idempotency_key 傳遞給 GitHub Actions

- [ ] 修改 GitHub Actions worker
  - 修改 `.github/workflows/process-article-jobs.yml` 或相關 script
  - 在文章生成成功後調用 `deductTokensIdempotent()`
  - 傳遞 article_job_id 作為 idempotency_key
  - 傳遞實際使用的 Token 數量
  - 處理扣款失敗的情況（記錄錯誤但不影響文章保存）

### 3.4 實作餘額不足處理

- [ ] 前置檢查 Token 餘額
  - 在建立 article_job 前檢查餘額
  - 使用 `TokenCalculator.estimateArticleTokens()` 預估需求
  - 如果餘額不足，返回 HTTP 402 Payment Required
  - 提供清楚的錯誤訊息

- [ ] 前端錯誤處理
  - 修改前端文章生成按鈕處理邏輯
  - 顯示友善的錯誤提示「Token 餘額不足，請升級方案或購買 Token」
  - 提供升級連結或購買 Token 連結

### 3.5 實作對帳機制

- [ ] 建立對帳 script
  - 建立 `scripts/reconcile-token-deductions.ts`
  - 查找所有 `status = 'pending'` 且超過 1 小時的記錄
  - 檢查對應文章是否存在
  - 文章存在 → 重試扣款
  - 文章不存在 → 標記為 failed
  - 記錄對帳結果

- [ ] 設定定期對帳任務
  - 選擇實作方式：
    - 方案 A：Vercel Cron Jobs（如果使用 Pro 計劃）
    - 方案 B：GitHub Actions Scheduled Workflow
  - 設定每小時執行一次
  - 設定錯誤通知（寄信或 Slack）

### 3.6 更新 Dashboard 顯示

- [ ] 確保即時更新
  - 檢查 `src/components/dashboard/TokenBalanceCard.tsx`
  - 檢查 `src/components/billing/TokenBalanceDisplay.tsx`
  - 使用 SWR 或 React Query 實作即時更新
  - 測試餘額變化是否即時反映

## 階段四：測試驗證

### 4.1 預覽功能測試

- [ ] 功能測試
  - 建立測試文章並檢查預覽頁面
  - 驗證 HTML 內容正確渲染
  - 驗證圖片載入和顯示
  - 測試特色圖片和內文圖片
  - 測試 Markdown 原始碼摺疊/展開

- [ ] 安全性測試
  - 嘗試在文章中注入 `<script>alert('XSS')</script>`
  - 嘗試注入 `<img src=x onerror=alert('XSS')>`
  - 驗證 CSP 是否阻止內聯 script
  - 檢查瀏覽器控制台的 CSP 報告

- [ ] 跨瀏覽器測試
  - 測試 Chrome
  - 測試 Safari
  - 測試 Firefox
  - 測試 Edge

### 4.2 批次清除移除驗證

- [ ] UI 驗證
  - 確認文章列表頁面沒有清除按鈕
  - 確認沒有相關 UI 元素殘留
  - 檢查控制台無 JavaScript 錯誤

- [ ] API 驗證
  - 嘗試訪問 `/api/articles/jobs/clear`
  - 確認返回 404 Not Found
  - 或確認路由完全不存在

- [ ] Code review
  - 檢查所有相關代碼已移除
  - 確認沒有 dead code 殘留
  - 確認 TypeScript 沒有未使用的 imports

### 4.3 Token 扣款功能測試

- [ ] 正常流程測試
  - 測試餘額充足時的文章生成
  - 驗證 Token 正確扣除
  - 驗證餘額更新顯示
  - 驗證 `token_usage_logs` 記錄寫入

- [ ] 錯誤處理測試
  - 測試餘額不足時的錯誤訊息
  - 驗證無法建立 article_job
  - 驗證前端顯示友善錯誤
  - 測試升級連結可點擊

- [ ] 冪等性測試
  - 使用相同 idempotency_key 重複調用扣款 API
  - 驗證只扣款一次
  - 驗證返回先前的結果
  - 測試 pending 狀態的處理

- [ ] 重試測試
  - 模擬暫時性資料庫錯誤
  - 驗證重試邏輯運作
  - 驗證最多重試 3 次
  - 驗證永久性錯誤不重試

- [ ] 對帳測試
  - 建立卡住的 pending 記錄（手動設定 created_at）
  - 執行對帳 script
  - 驗證卡住記錄被處理
  - 驗證對帳結果記錄

### 4.4 效能測試

- [ ] 預覽頁面效能
  - 測試大型文章（10,000+ 字）的載入時間
  - 驗證 HTML 淨化不影響效能
  - 驗證 `useMemo` 快取生效

- [ ] 扣款效能
  - 測試併發扣款請求（10+ 同時請求）
  - 驗證資料庫鎖定機制運作
  - 驗證沒有死鎖或競態條件

### 4.5 整合測試

- [ ] 端到端測試
  - 測試完整文章生成流程
  - 驗證所有步驟正常運作
  - 檢查錯誤日誌無異常
  - 驗證沒有破壞其他功能

- [ ] 回歸測試
  - 測試文章列表頁面
  - 測試文章詳情頁面
  - 測試 Dashboard
  - 測試設定頁面

## 階段五：文件更新

### 5.1 使用者文件

- [ ] 更新使用手冊
  - 說明預覽功能的使用方式
  - 更新 Token 計費說明
  - 說明餘額不足時的處理方式

### 5.2 開發者文件

- [ ] 更新技術文件
  - 記錄 HTML 淨化邏輯和安全性考量
  - 記錄 Token 扣款流程和冪等性設計
  - 更新 API 文件（移除批次清除 API）
  - 記錄對帳機制和錯誤處理

### 5.3 更新 CHANGELOG

- [ ] 記錄變更
  - 新增：HTML 預覽淨化機制（XSS 防護）
  - 新增：Content Security Policy headers
  - 移除：批次清除進行中任務功能
  - 修復：Token 餘額扣款功能
  - 新增：冪等性 Token 扣款機制
  - 新增：Token 扣款對帳機制
