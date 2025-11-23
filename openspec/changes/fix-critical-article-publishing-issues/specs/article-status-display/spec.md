# 文章狀態視覺顯示

## MODIFIED Requirements

### Requirement: 文章狀態圖示

系統 MUST 為不同狀態的文章顯示清晰可辨的視覺指示器。

#### Scenario: 顯示已發布狀態

**Given** 文章的 `status` 為 'published' 或 `wordpress_status` 為 'publish'
**When** 在文章列表中渲染狀態圖示
**Then** 應該顯示：

- 紅色圓點 (bg-red-500, w-2 h-2 rounded-full)
- 紅色文字「已發布」(text-red-600)

#### Scenario: 顯示排程狀態

**Given** 文章有 `scheduled_at` 且時間在未來
**When** 在文章列表中渲染狀態圖示
**Then** 應該顯示：

- 黃色圓點 (bg-yellow-500)
- 黃色文字「已排程」(text-yellow-600)

#### Scenario: 顯示草稿狀態

**Given** 文章的 `status` 為 'draft' 且未發布
**When** 在文章列表中渲染狀態圖示
**Then** 應該顯示：

- 灰色圓點 (bg-gray-400)
- 灰色文字「草稿」(text-gray-600)

### Requirement: 狀態資料查詢

文章列表查詢 MUST 包含狀態相關欄位。

#### Scenario: 查詢文章列表

**Given** 用戶訪問文章列表頁面
**When** 從資料庫查詢文章
**Then** SELECT 語句必須包含：

- `status`
- `wordpress_status`
- `published_at`
- `scheduled_at`（如果欄位存在）

## 實作細節

### 修改檔案

- `src/components/articles/ArticleStatusIcon.tsx`
  - 添加 `wordpressStatus` prop
  - 優先檢查 WordPress 發布狀態
  - 更新紅色圓點樣式

- `src/app/(dashboard)/dashboard/articles/page.tsx`
  - 傳遞 `wordpress_status` 到 ArticleStatusIcon
  - 確保查詢包含必要欄位

### UI 樣式

使用 Tailwind CSS 顏色：

- 已發布：`bg-red-500`, `text-red-600`
- 排程：`bg-yellow-500`, `text-yellow-600`
- 草稿：`bg-gray-400`, `text-gray-600`

### 可訪問性

- 圓點大小：`w-2 h-2`（8px）
- 圓點與文字間距：`gap-1`（4px）
- 文字大小：`text-xs`（12px）
