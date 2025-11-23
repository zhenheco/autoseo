# Design Document: Restructure Article Workflow

## Architecture Overview

### Current State

```
/dashboard/articles (page.tsx)
├── Left pane: Article list with checkbox
├── Right pane: HTML preview (read-only)
└── Actions: Delete, Copy HTML

/dashboard/articles/[id]/edit (page.tsx)
└── Dedicated HTML editor page

/dashboard/articles/[id]/preview (page.tsx)
└── Dedicated preview page

/dashboard/websites/[id] (page.tsx)
├── Article list for specific website
└── Actions: Publish, Edit HTML, Preview, View Published
```

### Target State

```
/dashboard/articles (page.tsx)
├── Left pane: Article list (30% width)
│   ├── Article cards with meta info
│   ├── Status badges
│   └── Batch selection checkboxes
├── Right pane: Split editor/preview (70% width)
│   ├── Tab 1: HTML Preview (渲染後的 HTML)
│   ├── Tab 2: HTML Editor (可編輯的原始 HTML)
│   └── Actions toolbar:
│       ├── Save button
│       ├── Publish button (single)
│       └── Website selector
└── Batch actions toolbar:
    ├── Batch publish button
    └── Website selector for batch

/dashboard/websites/[id] (page.tsx)
├── Website stats card
├── Published articles list (read-only)
│   ├── Title, excerpt, keywords
│   ├── Publish date, word count
│   └── Link to WordPress post
└── No edit/publish actions
```

## UI/UX Design

### Split-Pane Layout (參考 Sanity CMS, Craft CMS)

#### Desktop Layout (> 768px)

##### Left Pane (30% width)

- **固定寬度**：最小 300px，最大 500px
- **可調整**：拖曳中間分隔線調整寬度
- **內容**：
  - 文章卡片（compact 模式）
  - 標題 (text-sm)
  - 狀態 badge
  - 日期、字數、閱讀時間 (text-[10px])
  - Checkbox（批次選擇）
- **操作**：
  - 點擊卡片 → 右側 pane 載入該文章
  - 勾選 checkbox → 啟用批次操作

##### Right Pane (70% width)

- **Tab Navigation**：
  - 「預覽」tab（預設）
  - 「編輯 HTML」tab
- **預覽 Tab**：
  - 渲染後的 HTML（使用 DOMPurify 淨化）
  - 樣式與實際發布一致
  - 唯讀模式
- **編輯 Tab**：
  - HTML 原始碼編輯器（react-simple-code-editor + Prism.js）
  - 語法高亮
  - 實時驗證 HTML 結構
- **Toolbar**（置頂固定）：
  - 文章標題（可編輯）
  - 儲存按鈕
  - 發布按鈕 → 開啟 PublishControlDialog
    - 選擇目標網站
    - 設定發布狀態（draft/publish/scheduled）
    - 排程時間（如需要）

#### Mobile/Tablet Layout (< 768px)

- **使用 Allotment vertical 模式**：`<Allotment vertical>`
- **上方 Pane**：文章列表（可收合）
  - 預設高度 40vh
  - 可拖曳調整高度
  - Snap-to-zero 完全隱藏列表，專注於編輯
- **下方 Pane**：預覽/編輯器（佔據主要空間）
  - 最小高度 60vh
  - 全寬顯示
- **替代方案**：使用 Tabs 切換「列表」和「編輯器」兩個 view
  - 適合非常小的螢幕（< 640px）
  - 避免同時顯示造成擁擠

### Batch Operations Toolbar

- **顯示時機**：當 `selectedItems.size > 0` 時顯示
- **位置**：左側 pane 頂部
- **內容**：
  - 已選取 X 篇文章
  - 批次發布按鈕 → 開啟 BatchPublishDialog
    - 選擇目標網站（同一網站）
    - 設定發布狀態
  - 取消選取按鈕

## Data Model Changes

### Database Schema Updates

#### `generated_articles` Table

```sql
-- 移除 website_id 的 NOT NULL 約束
ALTER TABLE generated_articles
ALTER COLUMN website_id DROP NOT NULL;

-- 新增欄位追蹤發布資訊
ALTER TABLE generated_articles
ADD COLUMN published_to_website_id uuid REFERENCES websites(id),
ADD COLUMN published_to_website_at timestamp with time zone;

-- 建立索引加速查詢
CREATE INDEX idx_articles_published_website
ON generated_articles(published_to_website_id)
WHERE published_to_website_id IS NOT NULL;
```

**欄位說明**：

- `website_id`：原本創建時綁定的網站（保留以維持向後相容，允許 NULL）
- `published_to_website_id`：實際發布到的網站 ID
- `published_to_website_at`：發布時間戳記

### API Endpoints

#### Modified Endpoints

```typescript
// GET /api/articles
// 回傳所有文章（不篩選 website_id）
// 新增 published_to_website_id 欄位

// PATCH /api/articles/[id]
// 新增 published_to_website_id 參數
interface UpdateArticleRequest {
  html_content?: string;
  title?: string;
  published_to_website_id?: string;
  published_to_website_at?: string;
}

// POST /api/articles/[id]/publish
// 新增 website_id 參數選擇發布目標
interface PublishRequest {
  target: "wordpress";
  website_id: string; // 新增：選擇目標網站
  status: "draft" | "publish" | "scheduled";
  scheduled_time?: string;
}
```

#### New Endpoints

```typescript
// POST /api/articles/batch-publish
interface BatchPublishRequest {
  article_ids: string[];
  website_id: string;
  target: "wordpress";
  status: "draft" | "publish" | "scheduled";
}
```

## Component Architecture

### New Components

#### `ArticleSplitView.tsx`

```typescript
import { Allotment } from "allotment";
import "allotment/dist/style.css";

interface ArticleSplitViewProps {
  articles: Article[];
  selectedArticle: Article | null;
  onSelectArticle: (article: Article) => void;
  onUpdateArticle: (id: string, updates: Partial<Article>) => Promise<void>;
}
```

- 使用 **Allotment** 組件（VS Code 衍生的專業級 split-pane）
- 管理左右 pane 的佈局和響應式切換
- 處理分隔線（sash）拖曳調整寬度
- 協調左右 pane 的狀態同步

**Allotment 配置**：

```typescript
<Allotment
  defaultSizes={[300, 700]} // 初始化：左側 300px，右側 700px
  onChange={(sizes) => {
    // Debounce 並儲存到 localStorage
    debouncedSave('article-pane-sizes', sizes)
  }}
>
  <Allotment.Pane
    preferredSize="30%"
    minSize={300}
    maxSize={500}
    snap // 啟用 snap-to-zero（拖曳到最小時自動隱藏）
  >
    {/* 左側文章列表 */}
  </Allotment.Pane>

  <Allotment.Pane preferredSize="70%">
    {/* 右側預覽/編輯器 */}
  </Allotment.Pane>
</Allotment>
```

**關鍵功能**：

- **雙擊 sash 重置尺寸**：自動回到 `preferredSize` 設定
- **Snap-to-zero**：拖曳到最小尺寸時自動完全隱藏 pane
- **百分比 + 像素混合**：`preferredSize` 支援 "30%" 或 "300px"
- **onChange debounce**：避免過度寫入 localStorage（建議 300ms）
- **CSS 自訂主題**：透過 CSS 變數調整 sash 顏色和寬度

**CSS 自訂範例**（`styles/allotment-custom.css`）：

```css
.split-view-container {
  /* Sash (分隔線) 顏色 */
  --sash-color: hsl(var(--border));
  --sash-hover-color: hsl(var(--primary));

  /* Sash 寬度（預設 4px） */
  --sash-size: 6px;
}

/* Hover 時的樣式 */
.split-view-container .split-sash:hover {
  background-color: var(--sash-hover-color);
}

/* 隱藏模式下的 sash 樣式提示 */
.split-view-container .split-sash.collapsed::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: hsl(var(--primary));
  border-radius: 1px;
}
```

#### `InlineHtmlEditor.tsx`

```typescript
interface InlineHtmlEditorProps {
  article: Article | null;
  onSave: (html: string, title: string) => Promise<void>;
  onPublish: (article: Article) => void;
}
```

- 整合 HTML 編輯器和預覽
- Tab navigation
- Toolbar actions

#### `WebsiteSelector.tsx`

```typescript
interface WebsiteSelectorProps {
  value: string | null;
  onChange: (websiteId: string) => void;
  onlyUserWebsites?: boolean;
}
```

- 下拉選單選擇網站
- 顯示網站名稱和 URL
- 支援搜尋過濾

#### `BatchPublishDialog.tsx`

```typescript
interface BatchPublishDialogProps {
  articleIds: string[];
  onPublishSuccess: () => void;
}
```

- 批次發布設定對話框
- 選擇目標網站
- 設定統一的發布狀態

### Modified Components

#### `PublishControlDialog.tsx`

- 新增 `websiteId` prop
- 新增網站選擇步驟
- 更新 API 呼叫包含 `website_id`

## Migration Strategy

### Phase 1: Database Migration

1. 執行 SQL migration 新增欄位
2. 資料遷移：將現有 `website_id` 複製到 `published_to_website_id`（已發布的文章）
3. 向後相容：保留 `website_id` 欄位

### Phase 2: API Updates

1. 更新 GET /api/articles 回傳格式
2. 更新 PATCH /api/articles/[id] 接受新參數
3. 更新 POST /api/articles/[id]/publish 接受 `website_id`
4. 實作 POST /api/articles/batch-publish

### Phase 3: UI Refactoring

1. 實作新組件（ArticleSplitView, InlineHtmlEditor, WebsiteSelector）
2. 重構 `/dashboard/articles` page
3. 簡化 `/dashboard/websites/[id]` page
4. 移除 `/dashboard/articles/[id]/edit` 和 `/dashboard/articles/[id]/preview`

### Phase 4: Testing & Validation

1. E2E 測試文章創建 → 編輯 → 發布流程
2. 測試批次發布功能
3. 測試網站歸檔查看
4. 驗證 database 遷移正確性

## Technical Considerations

### Performance

- **左側列表**：使用虛擬滾動（如文章數 > 100，使用 `@tanstack/react-virtual`）
- **右側編輯器**：debounce 自動儲存（1秒）
- **HTML 渲染**：使用 Web Worker 進行 DOMPurify 淨化
- **Allotment onChange debounce**：300ms 避免過度寫入 localStorage

### State Management

- **Client-Side State**：考慮使用 Zustand 或 Jotai 管理複雜 UI 狀態
  - Selected article ID
  - Active tab (preview/edit)
  - Pane sizes
  - Batch selection state
  - Draft content (localStorage sync)
- **Server State**：使用 React Query/SWR 管理 API 資料快取
  - 文章列表
  - 網站清單
  - 發布狀態
- **Undo/Redo** (可選，Phase 5.4)：
  - 使用 `use-undo` 或 `immer` + custom history stack
  - 僅適用於 HTML 編輯器內容
  - Keyboard shortcuts：Cmd+Z (Undo), Cmd+Shift+Z (Redo)

### Accessibility

- Keyboard navigation（Tab / Shift+Tab 在 panes 間切換）
- ARIA labels for screen readers
- Focus management（選擇文章後 focus 移至編輯器）
- **Allotment keyboard support**：內建 focus trap 和 keyboard resizing

### Error Handling

- 編輯衝突檢測（多人同時編輯）
- 網路錯誤重試機制
- 本地草稿暫存（localStorage）
- **Optimistic Updates**：立即更新 UI，失敗時回滾

### Browser Compatibility

- 支援 Chrome, Firefox, Safari, Edge（最新兩個版本）
- Allotment 原生支援現代瀏覽器，無需額外 polyfill
- Fallback for CSS Grid（不支援時使用 Flexbox）

## Rollback Plan

如果需要回滾：

1. Database：`website_id` 欄位仍保留，可繼續使用
2. API：保持向後相容，舊的呼叫方式仍可運作
3. UI：可透過 feature flag 切換新舊介面

## Security Considerations

- **XSS Prevention**：DOMPurify 淨化所有 HTML 內容
- **CSRF Protection**：API 使用 Next.js 內建 CSRF token
- **Permission Check**：發布前驗證使用者對目標網站的權限
- **SQL Injection**：使用 Supabase parameterized queries
