# Restructure Article Workflow

## Why

目前文章管理流程存在以下問題：

1. **功能分散**：`/dashboard/websites/[id]` 頁面包含發布、編輯 HTML、預覽功能，但這些應該屬於文章管理的核心功能
2. **工作流程不清晰**：使用者無法清楚了解文章從創建、編輯、發布到歸檔的完整流程
3. **缺乏中央管理**：`/dashboard/articles` 頁面僅作為預覽，無法進行實際的編輯和發布操作
4. **網站歸檔混亂**：文章在創建時就綁定網站，而非在發布時才分配

## What Changes

重新設計文章管理工作流程，將 `/dashboard/articles` 打造為文章管理的核心中樞：

### 核心理念

- **集中式文章管理**：所有文章的創建、編輯、預覽、發布都在 `/dashboard/articles` 進行
- **後期網站分配**：文章創建時不綁定網站，在發布時才選擇目標網站
- **分離式預覽編輯**：採用左側列表 + 右側預覽/編輯的 split-pane 佈局
- **網站歸檔功能**：`/dashboard/websites/[id]` 僅顯示已發布到該網站的文章，作為歸檔查看

### 工作流程

1. **創建文章** → `/dashboard/articles` 使用「新增文章」按鈕批次生成
2. **編輯文章** → 在 `/dashboard/articles` 右側 pane 直接編輯 HTML
3. **預覽文章** → 右側 pane 即時渲染 HTML 預覽
4. **發布文章** → 選擇目標網站和發布設定（單篇或批次）
5. **查看歸檔** → `/dashboard/websites/[id]` 顯示已發布到該網站的文章

## Affected Components

### Modified Pages

- `/dashboard/articles` - 成為核心文章管理中樞
- `/dashboard/websites/[id]` - 簡化為網站文章歸檔查看頁面

### Removed Pages

- `/dashboard/articles/[id]/edit` - 編輯功能整合到主頁面右側 pane
- `/dashboard/articles/[id]/preview` - 預覽功能整合到主頁面右側 pane

### New Components

- `ArticleSplitView` - 左右分欄佈局組件
- `InlineHtmlEditor` - 右側 pane 的 HTML 編輯器
- `WebsiteSelector` - 發布時的網站選擇器

## Success Criteria

- [ ] `/dashboard/articles` 可以在右側 pane 預覽和編輯 HTML
- [ ] 可以單篇或批次發布文章到指定網站
- [ ] `/dashboard/websites/[id]` 僅顯示已發布文章（唯讀）
- [ ] 文章創建時不綁定網站，database schema 支援此變更
- [ ] 移除 `/dashboard/articles/[id]/edit` 和 `/dashboard/articles/[id]/preview` 路由

## Out of Scope

- WordPress 整合以外的發布目標
- 文章版本控制
- 協作編輯功能
- 文章搜尋和篩選（保留現有功能）
