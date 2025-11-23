# Implementation Tasks

## Phase 1: Database Migration (1-2 days)

### Task 1.1: Create Database Migration Script

- [ ] 創建 Supabase migration 檔案
- [ ] 新增 `published_to_website_id` 欄位（nullable, foreign key to websites)
- [ ] 新增 `published_to_website_at` 欄位（timestamp with time zone, nullable）
- [ ] 移除 `website_id` 的 NOT NULL 約束
- [ ] 建立索引 `idx_articles_published_website`
- [ ] **驗證**: 執行 migration 在開發環境，確認 schema 正確

### Task 1.2: Data Migration

- [ ] 撰寫 SQL script 將現有資料遷移
- [ ] 對於已發布文章（`status = 'published'`），複製 `website_id` 到 `published_to_website_id`
- [ ] 設定 `published_to_website_at` 為 `published_at` 或 `created_at`
- [ ] **驗證**: 查詢資料庫確認遷移正確，無資料遺失

### Task 1.3: Update Database Types

- [ ] 執行 `supabase gen types typescript` 生成新的 TypeScript types
- [ ] 更新 `src/types/database.types.ts`
- [ ] **驗證**: TypeScript 編譯無錯誤

## Phase 2: API Updates (2-3 days)

### Task 2.1: Update GET /api/articles Endpoint

- [ ] 修改查詢不篩選 `website_id`（回傳所有文章）
- [ ] 新增 `published_to_website_id` 和 `published_to_website_at` 欄位到回傳資料
- [ ] **驗證**: 呼叫 API 確認回傳正確資料

### Task 2.2: Update PATCH /api/articles/[id] Endpoint

- [ ] 新增 `title` 參數支援（inline 標題編輯）
- [ ] 新增 `published_to_website_id` 和 `published_to_website_at` 參數支援
- [ ] **驗證**: 使用 Postman/curl 測試更新成功

### Task 2.3: Update POST /api/articles/[id]/publish Endpoint

- [ ] 新增 `website_id` 必填參數
- [ ] 更新 `published_to_website_id` 和 `published_to_website_at`
- [ ] 驗證使用者對目標網站的權限（透過 `company_members` 和 `websites` join）
- [ ] **驗證**: 測試發布到不同網站，確認 database 正確更新

### Task 2.4: Create POST /api/articles/batch-publish Endpoint

- [ ] 接受 `article_ids` 陣列和 `website_id` 參數
- [ ] 驗證每篇文章的權限
- [ ] 批次更新 `published_to_website_id` 和 `published_to_website_at`
- [ ] 回傳成功/失敗統計和錯誤訊息
- [ ] **驗證**: 測試批次發布，確認部分成功/部分失敗的情況處理正確

## Phase 3: Component Development (3-4 days)

### Task 3.0: Install Dependencies

- [ ] 安裝核心 UI 組件：`pnpm add allotment dompurify react-simple-code-editor prismjs`
- [ ] 安裝類型定義：`pnpm add -D @types/dompurify @types/prismjs`
- [ ] 安裝狀態管理（可選）：`pnpm add zustand` 或 `pnpm add jotai`
- [ ] 安裝虛擬滾動（可選）：`pnpm add @tanstack/react-virtual`
- [ ] 安裝 server state 管理（可選）：`pnpm add @tanstack/react-query`
- [ ] **驗證**: `pnpm install` 成功，無衝突

### Task 3.1: Create WebsiteSelector Component

- [ ] 實作 `src/components/articles/WebsiteSelector.tsx`
- [ ] 下拉選單顯示使用者有權限的網站（`company_members` join `websites`）
- [ ] 顯示網站名稱和 URL
- [ ] 支援搜尋過濾（可選）
- [ ] **驗證**: Storybook story 或 isolated 測試

### Task 3.2: Create ArticleSplitView Component

- [ ] 安裝 Allotment：`pnpm add allotment`
- [ ] 實作 `src/components/articles/ArticleSplitView.tsx`
- [ ] 使用 Allotment 組件建立左右分欄佈局
- [ ] 配置 Allotment.Pane：
  - 左側 pane：`preferredSize="30%"`, `minSize={300}`, `maxSize={500}`, `snap`
  - 右側 pane：`preferredSize="70%"`
- [ ] 實作 onChange handler 並 debounce（300ms）後儲存到 localStorage
- [ ] 導入 Allotment CSS：`import 'allotment/dist/style.css'`
- [ ] 自訂 CSS 變數調整 sash 樣式（顏色、寬度）
- [ ] Responsive（< 768px 切換為垂直堆疊或使用 Allotment vertical 模式）
- [ ] **驗證**: 測試以下功能：
  - 拖曳調整寬度
  - 雙擊 sash 重置尺寸
  - Snap-to-zero 隱藏/恢復左側 pane
  - localStorage 儲存和恢復
  - Responsive 切換

### Task 3.3: Create InlineHtmlEditor Component

- [ ] 實作 `src/components/articles/InlineHtmlEditor.tsx`
- [ ] Tab navigation（「預覽」和「編輯 HTML」）
- [ ] 預覽 tab：使用 DOMPurify 渲染 HTML
- [ ] 編輯 tab：整合 `react-simple-code-editor` + Prism.js
- [ ] 標題編輯功能（inline input）
- [ ] 儲存按鈕和自動儲存（debounce 1秒到 localStorage）
- [ ] **驗證**: 測試編輯、儲存、預覽切換、auto-save

### Task 3.4: Update PublishControlDialog Component

- [ ] 新增 `websiteId` state
- [ ] 新增 `WebsiteSelector` 到對話框
- [ ] 更新 publish API 呼叫包含 `website_id`
- [ ] 驗證必須選擇網站才能發布
- [ ] **驗證**: 測試發布流程，確認 website 選擇正常運作

### Task 3.5: Create BatchPublishDialog Component

- [ ] 實作 `src/components/articles/BatchPublishDialog.tsx`
- [ ] 顯示選中文章清單（標題）
- [ ] `WebsiteSelector` 和發布狀態選擇
- [ ] 進度指示器（發布中 X/Y）
- [ ] 完成後顯示成功/失敗統計
- [ ] **驗證**: 測試批次發布，確認進度和錯誤處理正確

## Phase 4: Page Refactoring (3-4 days)

### Task 4.1: Refactor /dashboard/articles Page

- [ ] 移除舊的雙欄預覽佈局
- [ ] 整合 `ArticleSplitView` 組件
- [ ] 左側 pane：
  - 文章列表（不篩選 website_id）
  - Checkbox 批次選擇
  - 批次操作 toolbar（當 selectedItems.size > 0）
- [ ] 右側 pane：
  - 整合 `InlineHtmlEditor`
  - 發布按鈕（開啟 `PublishControlDialog`）
- [ ] 處理 URL query parameter `?article=[id]`（deep linking）
- [ ] **驗證**: E2E 測試完整流程（選擇文章 → 編輯 → 儲存 → 發布）

### Task 4.2: Simplify /dashboard/websites/[id] Page

- [ ] 修改查詢條件為 `published_to_website_id = [id]`
- [ ] 移除 `ArticlePublishButton` 組件
- [ ] 移除「編輯 HTML」和「預覽」按鈕
- [ ] 保留「查看發布」連結（WordPress URL）
- [ ] 新增「在文章管理中樞編輯」連結
- [ ] 更新空白狀態提示
- [ ] **驗證**: 測試頁面僅顯示已發布文章，無編輯功能

### Task 4.3: Remove /dashboard/articles/[id]/edit Page

- [ ] 刪除 `src/app/(dashboard)/dashboard/articles/[id]/edit/page.tsx`
- [ ] 新增 redirect 到 `/dashboard/articles?article=[id]&tab=edit`
- [ ] **驗證**: 訪問舊 URL 確認重定向正確

### Task 4.4: Remove /dashboard/articles/[id]/preview Page

- [ ] 刪除 `src/app/(dashboard)/dashboard/articles/[id]/preview/page.tsx`
- [ ] 新增 redirect 到 `/dashboard/articles?article=[id]&tab=preview`
- [ ] **驗證**: 訪問舊 URL 確認重定向正確

## Phase 5: Testing & Polish (2-3 days)

### Task 5.1: E2E Testing

- [ ] 測試完整文章工作流程：
  1. 批次生成文章
  2. 在列表選擇文章
  3. 在右側 pane 預覽
  4. 切換到編輯 tab 修改 HTML
  5. 儲存變更
  6. 選擇網站並發布
  7. 前往 `/dashboard/websites/[id]` 確認歸檔
- [ ] 測試批次發布：
  1. 勾選多篇文章
  2. 批次發布到同一網站
  3. 確認進度和結果正確
- [ ] 測試 edge cases：
  - 無文章時的空白狀態
  - 無選中文章時右側 pane 提示
  - 發布失敗的錯誤處理
  - 網路錯誤的重試機制

### Task 5.2: Performance Optimization

- [ ] 實作虛擬滾動（如文章數 > 100，使用 `react-window`）
- [ ] 優化 DOMPurify 淨化（考慮 Web Worker）
- [ ] debounce 自動儲存設定為 1 秒
- [ ] **驗證**: 使用 Lighthouse 測試效能，確保 Performance score > 90

### Task 5.3: Accessibility Audit

- [ ] 確保 keyboard navigation 正常（Tab / Shift+Tab）
- [ ] 新增 ARIA labels 給 screen readers
- [ ] Focus management（選擇文章後 focus 移至編輯器）
- [ ] **驗證**: 使用 axe DevTools 或 WAVE 檢測 accessibility issues

### Task 5.4: UI/UX Polish

- [ ] 調整 spacing, padding, colors 符合設計系統
- [ ] 新增 loading states（骨架屏或 spinner）
- [ ] 新增 toast notifications（成功/失敗訊息）
- [ ] 新增 empty states 插圖和引導文字
- [ ] **驗證**: 設計師審查 UI/UX

## Phase 6: Documentation & Deployment (1 day)

### Task 6.1: Update Documentation

- [ ] 更新 README.md 說明新的文章工作流程
- [ ] 撰寫 API 文件（新增的 batch-publish endpoint）
- [ ] 更新使用者手冊（如有）

### Task 6.2: Deploy to Staging

- [ ] 部署到 staging 環境
- [ ] 執行 database migration
- [ ] 進行 smoke testing
- [ ] **驗證**: Staging 環境功能正常運作

### Task 6.3: Production Deployment

- [ ] 執行 production database migration
- [ ] 部署到 production
- [ ] 監控錯誤日誌和效能指標
- [ ] **驗證**: Production 環境穩定，無重大錯誤

### Task 6.4: Rollback Plan

- [ ] 準備 rollback migration script（還原 database schema）
- [ ] 準備 feature flag 切換回舊版 UI（如需要）
- [ ] 文件化 rollback 步驟

---

## Estimated Timeline

- **Phase 1**: 1-2 days
- **Phase 2**: 2-3 days
- **Phase 3**: 3-4 days
- **Phase 4**: 3-4 days
- **Phase 5**: 2-3 days
- **Phase 6**: 1 day

**Total**: 12-17 days (約 2.5-3.5 週)

## Dependencies

- Phase 2 依賴 Phase 1（database migration 必須先完成）
- Phase 4 依賴 Phase 3（components 必須先開發完成）
- Phase 5 和 Phase 6 依賴 Phase 4（頁面重構完成後才能測試和部署）

## Parallelization Opportunities

- Task 2.4（batch-publish API）可與 Task 3.1-3.3（components）並行開發
- Task 4.3 和 4.4（移除舊頁面）可與 Task 4.2（簡化網站頁面）並行

## Risk Mitigation

- **Database Migration 風險**：在 staging 環境先執行完整測試
- **資料遺失風險**：migration 前備份 production database
- **使用者習慣改變**：提供 in-app 引導和文件說明新流程
- **效能問題**：Phase 5.2 專門處理效能優化，必要時可延後上線
