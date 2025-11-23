# Proposal: Improve Article Management UI

## Why

當前文章管理介面在以下方面需要改進：

1. Credit 餘額和語系選擇分散在不同位置，使用者需要多次移動視線
2. 文章列表資訊密度低，無法在有限空間內顯示足夠資訊
3. HTML 內容無法直接編輯，必須重新生成才能修改
4. 缺少單篇文章的發布控制（發布目標、狀態）
5. 排程資訊未在文章列表中顯示

## What Changes

- **頂部導航欄改進**：將現有的 `TokenBalanceDisplay` 組件整合至頂部導航欄，與新建的語系選擇器並列
- **文章列表優化**：縮小字體和間距（`text-lg` → `text-base`，`p-6` → `p-4`），提高資訊密度
- **HTML 編輯功能**：新增輕量級程式碼編輯器（優先考慮 `react-simple-code-editor` + Prism.js，或按需載入的 Monaco Editor）
- **發布控制**：新增發布設定對話框（狀態選擇、排程時間），使用現有的 `wordpress_status` 和 `scheduled_publish_at` 欄位
- **排程顯示**：在文章卡片右上角顯示排程 Badge（當 `article_jobs.scheduled_publish_at` 有值時）

## Impact

- **受影響的 specs**:
  - `article-management` (新建)

- **受影響的程式碼**:
  - `src/app/(dashboard)/dashboard/layout.tsx` - 整合 Credit 顯示和語系選擇
  - `src/app/(dashboard)/dashboard/websites/[id]/page.tsx` - 文章列表樣式優化、排程顯示
  - `src/app/(dashboard)/dashboard/articles/[id]/edit/page.tsx` - 新建 HTML 編輯頁面
  - `src/components/articles/PublishControlDialog.tsx` - 新建發布控制組件
  - `src/components/articles/LanguageSelector.tsx` - 新建全域語系選擇組件
  - `src/components/billing/TokenBalanceDisplay.tsx` - 調整以適應頂部導航欄

- **API 端點**:
  - `PATCH /api/articles/[id]` - 更新文章內容（HTML、字數、閱讀時間）
  - `POST /api/articles/[id]/publish` - 發布文章到 WordPress
  - `POST /api/articles/[id]/schedule` - 設定排程發布

- **資料庫變更**:
  - **無需新增欄位**，現有結構已足夠：
    - `generated_articles.html_content` - 儲存 HTML
    - `generated_articles.wordpress_status` - 發布狀態（可擴展為支援其他平台）
    - `article_jobs.scheduled_publish_at` - 排程發布時間
    - `article_jobs.auto_publish` - 自動發布旗標
