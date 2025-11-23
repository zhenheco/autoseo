# Implementation Tasks

## 1. 頂部導航欄調整

- [ ] 1.1 建立全域語系選擇組件 `src/components/common/LanguageSelector.tsx`
  - [ ] 1.1.1 支援 zh-TW, en-US, ja-JP 等語系
  - [ ] 1.1.2 使用 Select 組件實作下拉選單
  - [ ] 1.1.3 整合全域狀態管理（Context 或 localStorage）
- [ ] 1.2 調整 `TokenBalanceDisplay` 組件以適應頂部導航欄
  - [ ] 1.2.1 簡化樣式（移除 card 樣式，使用 inline 顯示）
  - [ ] 1.2.2 縮小字體和間距
  - [ ] 1.2.3 保留「Buy More!」連結
- [ ] 1.3 在 `src/app/(dashboard)/dashboard/layout.tsx` 整合組件
  - [ ] 1.3.1 在搜尋列右側新增 Credit 顯示
  - [ ] 1.3.2 在 Credit 顯示旁新增語系選擇器
  - [ ] 1.3.3 調整間距確保不擁擠
- [ ] 1.4 確保響應式設計
  - [ ] 1.4.1 手機版本（< 768px）隱藏或簡化顯示
  - [ ] 1.4.2 平板版本（768px - 1024px）調整佈局
- [ ] 1.5 測試在不同螢幕尺寸的顯示效果

## 2. 文章列表優化

- [ ] 2.1 更新 `src/app/(dashboard)/dashboard/websites/[id]/page.tsx`
  - [ ] 2.1.1 文章卡片標題：`text-lg` → `text-base`
  - [ ] 2.1.2 卡片內邊距：`CardHeader p-6` → `p-4`，`CardContent p-6` → `p-4 pt-0`
  - [ ] 2.1.3 卡片間距：`space-y-4` → `space-y-2`
  - [ ] 2.1.4 Meta 資訊字體：`text-sm` → `text-xs`
  - [ ] 2.1.5 Meta 資訊圖示：`h-4 w-4` → `h-3 w-3`
- [ ] 2.2 新增排程 Badge 顯示
  - [ ] 2.2.1 在 `getWebsiteArticles` 中 join `article_jobs` 表
  - [ ] 2.2.2 查詢 `scheduled_publish_at` 欄位
  - [ ] 2.2.3 建立 `ScheduleBadge` 組件顯示排程時間
  - [ ] 2.2.4 在卡片右上角渲染 Badge（格式：`🕒 11/20 14:30`）
- [ ] 2.3 測試緊湊佈局的可讀性
- [ ] 2.4 確保響應式設計正常運作

## 3. HTML 編輯功能

- [ ] 3.1 決定編輯器方案
  - [ ] 3.1.1 優先選擇：`react-simple-code-editor` + `prismjs`（輕量）
  - [ ] 3.1.2 備選方案：`@monaco-editor/react` + `dynamic import`（功能完整）
  - [ ] 3.1.3 安裝必要依賴：`pnpm add react-simple-code-editor prismjs`
- [ ] 3.2 建立文章編輯頁面 `src/app/(dashboard)/dashboard/articles/[id]/edit/page.tsx`
  - [ ] 3.2.1 從 `generated_articles` 載入文章資料
  - [ ] 3.2.2 顯示標題和基本資訊（唯讀）
  - [ ] 3.2.3 整合程式碼編輯器組件
  - [ ] 3.2.4 新增「儲存」、「預覽」、「取消」按鈕
- [ ] 3.3 建立 `src/components/articles/HtmlEditor.tsx` 組件
  - [ ] 3.3.1 使用 Client Component (`'use client'`)
  - [ ] 3.3.2 整合 `react-simple-code-editor`
  - [ ] 3.3.3 設定 Prism 語法高亮（HTML）
  - [ ] 3.3.4 新增行號顯示
- [ ] 3.4 實作儲存功能
  - [ ] 3.4.1 建立 API 端點 `PATCH /api/articles/[id]`
  - [ ] 3.4.2 驗證 HTML 基本結構（使用 `cheerio` 或 `htmlparser2`）
  - [ ] 3.4.3 更新 `html_content` 欄位
  - [ ] 3.4.4 重新計算 `word_count` 和 `reading_time`
  - [ ] 3.4.5 更新 `updated_at` 時間戳
- [ ] 3.5 實作預覽功能
  - [ ] 3.5.1 建立預覽對話框組件
  - [ ] 3.5.2 使用 `ArticleHtmlPreview` 組件渲染 HTML
  - [ ] 3.5.3 確保安全性淨化（DOMPurify）
- [ ] 3.6 在文章列表中新增「編輯 HTML」按鈕
  - [ ] 3.6.1 在文章卡片操作按鈕區新增按鈕
  - [ ] 3.6.2 點擊跳轉至編輯頁面

## 4. 發布控制功能

- [ ] 4.1 建立 `src/components/articles/PublishControlDialog.tsx` 組件
  - [ ] 4.1.1 使用 Dialog 組件實作對話框
  - [ ] 4.1.2 新增發布目標選擇（WordPress - 第一階段僅支援此項）
  - [ ] 4.1.3 新增狀態選擇（草稿/待審核/已發布/已排程）
  - [ ] 4.1.4 條件顯示排程時間選擇器（當選擇「已排程」時）
  - [ ] 4.1.5 新增「立即發布」和「設定排程」按鈕
- [ ] 4.2 整合到文章詳情或列表頁面
  - [ ] 4.2.1 在文章卡片新增「發布設定」按鈕
  - [ ] 4.2.2 點擊開啟 PublishControlDialog
  - [ ] 4.2.3 傳遞當前文章的 ID 和狀態
- [ ] 4.3 實作發布 API
  - [ ] 4.3.1 建立 `POST /api/articles/[id]/publish` 端點
  - [ ] 4.3.2 驗證使用者權限
  - [ ] 4.3.3 更新 `wordpress_status` 為 `published`
  - [ ] 4.3.4 更新 `published_at` 為當前時間
  - [ ] 4.3.5 呼叫 WordPress API 發布文章
  - [ ] 4.3.6 儲存 `wordpress_post_url`
- [ ] 4.4 實作排程 API
  - [ ] 4.4.1 建立 `POST /api/articles/[id]/schedule` 端點
  - [ ] 4.4.2 驗證排程時間（必須為未來時間）
  - [ ] 4.4.3 更新 `article_jobs.scheduled_publish_at`
  - [ ] 4.4.4 更新 `article_jobs.status` 為 `scheduled`
  - [ ] 4.4.5 更新 `generated_articles.wordpress_status` 為 `scheduled`
- [ ] 4.5 測試發布流程
  - [ ] 4.5.1 測試立即發布（單篇）
  - [ ] 4.5.2 測試排程發布
  - [ ] 4.5.3 測試錯誤處理（API 失敗、網路錯誤等）

## 5. 測試與驗證

- [ ] 5.1 頂部導航欄測試
  - [ ] 5.1.1 在不同螢幕尺寸測試 Credit 顯示
  - [ ] 5.1.2 測試語系切換功能
  - [ ] 5.1.3 測試響應式佈局
- [ ] 5.2 文章列表測試
  - [ ] 5.2.1 驗證緊湊佈局的可讀性
  - [ ] 5.2.2 測試排程 Badge 顯示
  - [ ] 5.2.3 測試在不同文章數量下的效能
- [ ] 5.3 HTML 編輯器測試
  - [ ] 5.3.1 測試語法高亮
  - [ ] 5.3.2 測試儲存功能
  - [ ] 5.3.3 測試預覽功能
  - [ ] 5.3.4 測試 HTML 驗證（故意輸入錯誤 HTML）
- [ ] 5.4 發布控制測試
  - [ ] 5.4.1 測試狀態選擇
  - [ ] 5.4.2 測試排程設定
  - [ ] 5.4.3 測試立即發布
  - [ ] 5.4.4 測試錯誤處理
- [ ] 5.5 執行 TypeScript 類型檢查：`pnpm run typecheck`
- [ ] 5.6 執行 Lint 檢查：`pnpm run lint`
- [ ] 5.7 執行建置：`pnpm run build`

## 6. 文件更新（可選）

- [ ] 6.1 更新使用者文件（如何編輯 HTML、如何發布）
- [ ] 6.2 更新 API 文件（新端點說明）
- [ ] 6.3 更新元件文件（新組件使用方式）
