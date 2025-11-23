# Proposal: 強化文章管理使用者體驗

## Why

目前文章管理系統存在以下關鍵問題影響使用者體驗：

1. **HTML 連結顯示問題**：文章預覽中的內外部連結無法正確顯示或點擊
2. **文章狀態管理混亂**：選定標題後會創建排程文章（一直顯示未完成），但寫好後又新增了另一個完成的排程文章，造成重複和狀態不一致
3. **缺乏批次操作功能**：無法批次選擇多篇文章並發佈到不同網站
4. **缺乏內容複製功能**：預覽文章時無法快速複製內容以發佈到其他平台

## What Changes

### 1. 修復 HTML 連結渲染問題

- 優化 DOMPurify 配置，確保 `<a>` 標籤及其屬性（`href`, `target`, `rel`）正確保留
- 使用 `useMemo` 優化 HTML 內容清理性能
- 確保內外部連結都能正確顯示和點擊

### 2. 修正文章狀態管理邏輯

- 修改批次生成 API，更新現有 article_job 而非創建新的
- 實作冪等性檢查，避免重複創建文章
- 確保文章狀態正確反映生成進度（pending → processing → completed）
- **保留並落實語系（targetLanguage）和字數（wordCount）設定**
- **移除圖片數量選擇**（系統自動為每個 H2 標題配圖）

### 3. 實作批次選擇與排程發佈功能

- 在文章列表每列新增 checkbox，支援單選和全選（Select All）
- 新增批次操作工具列，包含：
  - 排程時間選擇器（日期時間選擇）
  - 排程條件下拉選單（立即發佈、指定時間、間隔發佈等）
  - SCHEDULE ALL 按鈕（批次排程所有勾選文章）
  - RESET SCHEDULE 按鈕（清除排程設定）
- 實作多網站選擇器組件
- 新增批次發佈 API endpoint
- 支援一次發佈到多個目標網站
- 顯示文章狀態指示器（已完成、待發佈、已排程）
- 在每列顯示排程日期（如果已設定）

### 4. 實作即時編輯功能

- 在文章預覽區域整合富文本編輯器
- 提供完整的文字編輯工具列：
  - Save As 下拉選單（儲存為草稿、儲存並發佈等）
  - 復原/重做功能
  - 標題格式選擇（H1-H4）
  - 文字樣式（粗體、斜體、底線）
  - 文字對齊（左、中、右、分散對齊）
  - 其他格式選項
- 即時儲存編輯內容到資料庫
- 顯示字數統計

### 5. 新增單篇發佈功能

- 在文章預覽底部新增 WordPress 發佈按鈕
- 支援選擇發佈狀態（草稿、已發佈、排程）
- 顯示發佈日期和「GO TO POST」連結
- 支援發佈到多個平台（WordPress、其他 CMS）

### 6. 新增文章複製功能

- 在文章預覽右上角新增「複製」按鈕
- 支援複製 HTML 格式（保留格式）
- 提供複製成功的視覺反饋

## Impact

### 受影響的 Specs

- `article-management` - 核心文章管理功能

### 受影響的程式碼

- `src/components/article/ArticleHtmlPreview.tsx` - HTML 預覽組件
- `src/app/(dashboard)/dashboard/articles/page.tsx` - 文章列表頁面
- `src/app/api/articles/generate-batch/route.ts` - 批次生成 API
- `src/app/api/articles/publish-batch/route.ts` - 新增批次發佈 API
- `src/components/articles/ArticleSelectionToolbar.tsx` - 新增批次選擇工具列
- `src/components/articles/WebsiteSelector.tsx` - 新增網站選擇器

### 資料庫變更

- 可能需要在 `article_jobs` 表新增唯一性約束，防止重複創建
- 可能需要新增 `article_publications` 表記錄發佈歷史

## Technical Considerations

### HTML 連結修復

參考業界最佳實踐（LogRocket, DEV Community）：

- 使用 `useMemo` 包裹 DOMPurify.sanitize
- 確保 ALLOWED_ATTR 包含所有必要的連結屬性
- 添加適當的 CSS 樣式確保連結可點擊

### 狀態管理改進

- 使用 slug 或 title+keyword 作為唯一性檢查
- 實作 upsert 邏輯（存在則更新，不存在則創建）
- 添加適當的資料庫索引提升查詢性能

### 批次操作設計

- 使用 React state 管理勾選狀態
- 實作樂觀更新提升使用者體驗
- 添加錯誤處理和重試機制

### 複製功能實作

- 使用 Clipboard API（`navigator.clipboard.writeText`）
- 提供降級方案（document.execCommand）支援舊瀏覽器
- 使用 Toast 通知複製結果
