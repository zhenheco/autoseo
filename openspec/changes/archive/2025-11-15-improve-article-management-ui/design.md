# Design Document: Improve Article Management UI

## Context

當前系統的文章管理介面需要多項改進：

**現況分析**：

1. **Credit 餘額顯示**：現有 `TokenBalanceDisplay` 組件功能完整，但位置不直觀
2. **語系選擇**：目前僅在文章生成時可選擇，缺少全域切換
3. **文章列表**：資訊密度低（大字體、大間距），在 1080p 螢幕僅能顯示 3-4 篇文章
4. **HTML 編輯**：無法修改已生成內容，必須重新生成浪費 Credit
5. **發布控制**：缺少狀態管理和排程功能的 UI

**技術背景**：

- 資料庫：Supabase PostgreSQL
- 前端：Next.js 15 App Router + React 19 + TypeScript
- UI 庫：shadcn/ui (Radix UI + Tailwind CSS)
- 現有組件：`TokenBalanceDisplay`, `ArticleHtmlPreview`, Dialog, Badge 等

## Goals / Non-Goals

### Goals

- ✅ 提升介面資訊密度（文章列表顯示更多內容）
- ✅ 整合 Credit 和語系選擇至頂部導航欄
- ✅ 提供輕量級 HTML 編輯功能（語法高亮 + 預覽）
- ✅ 實現單篇文章發布控制（狀態選擇、排程設定）
- ✅ 顯示排程資訊於文章列表
- ✅ 保持現有效能和 UX 品質

### Non-Goals

- ❌ 不實現完整的 WYSIWYG 編輯器（Notion-like）
- ❌ 不支援同時發布到多個平台（僅 WordPress）
- ❌ 不實現複雜的審批工作流程
- ❌ 不新增資料庫欄位（使用現有結構）
- ❌ 不實現批次發布（延後至有明確需求時）

## Decisions

### 1. 頂部導航欄整合

**決定**：將現有 `TokenBalanceDisplay` 組件簡化後移至頂部導航欄，與新建的語系選擇器並列。

**理由**：

- Credit 資訊是全域性的，應顯示在所有頁面
- 使用者參考圖片顯示此設計符合預期 UX
- 語系選擇也應為全域設定，而非僅限文章生成

**實作方案**：

```tsx
// src/app/(dashboard)/dashboard/layout.tsx
<header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur-sm">
  <div className="flex h-full items-center justify-between px-6">
    <div className="flex items-center gap-4 flex-1">
      <Search />
    </div>

    <div className="flex items-center gap-3">
      {/* Credit 顯示 - 簡化版 */}
      <TokenBalanceDisplay compact />

      {/* 語系選擇 */}
      <LanguageSelector />

      {/* 原有元素 */}
      <Bell />
      <ThemeToggle />
      <UserMenu />
    </div>
  </div>
</header>
```

**組件調整**：

- `TokenBalanceDisplay`：新增 `compact` prop，簡化樣式（移除 card、縮小字體）
- `LanguageSelector`：新建組件，使用 Select + localStorage 儲存選擇

**響應式設計**：

- 手機版（< 768px）：隱藏 Credit 詳細資訊，僅顯示總額
- 平板版（768px - 1024px）：簡化 Credit 顯示
- 桌面版（≥ 1024px）：完整顯示

### 2. HTML 編輯器選擇

**決定**：優先使用 `react-simple-code-editor` + Prism.js（輕量方案），備選 Monaco Editor（按需載入）。

**理由**：

- **輕量優先**：`react-simple-code-editor` 僅 ~2KB，Prism.js ~20KB
- **功能足夠**：HTML 編輯不需要自動補全、類型檢查等複雜功能
- **效能考量**：Monaco Editor 完整包 ~3MB，即使按需載入也會影響首次載入
- **使用者需求**：主要是微調 HTML，而非從零編寫

**技術比較**：

| 方案                             | 大小  | 功能       | 效能       | 推薦度    |
| -------------------------------- | ----- | ---------- | ---------- | --------- |
| react-simple-code-editor + Prism | ~22KB | ⭐⭐⭐     | ⭐⭐⭐⭐⭐ | ✅ 優先   |
| Monaco Editor (dynamic)          | ~3MB  | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | 備選      |
| Textarea (無高亮)                | 0     | ⭐         | ⭐⭐⭐⭐⭐ | ❌ 不推薦 |

**實作範例**：

```tsx
// src/components/articles/HtmlEditor.tsx
"use client";

import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import "prismjs/components/prism-markup"; // HTML 支援
import "prismjs/themes/prism-tomorrow.css"; // 深色主題

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.markup, "markup")}
        padding={16}
        className="font-mono text-sm min-h-[500px]"
        style={{
          backgroundColor: "#1e1e1e",
          color: "#d4d4d4",
        }}
      />
    </div>
  );
}
```

**降級方案**：
若使用者反饋需要更強大功能（自動補全、多檔案編輯），再引入 Monaco Editor：

```tsx
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div>載入編輯器...</div>,
});
```

### 3. 文章列表優化

**決定**：縮小字體和間距，提高資訊密度，目標是在 1080p 螢幕顯示 6-8 篇文章。

**具體調整**：

| 元素       | 原值               | 新值               | 理由         |
| ---------- | ------------------ | ------------------ | ------------ |
| 標題字體   | `text-lg` (18px)   | `text-base` (16px) | 節省垂直空間 |
| 卡片內邊距 | `p-6` (24px)       | `p-4` (16px)       | 減少空白     |
| 卡片間距   | `space-y-4` (16px) | `space-y-2` (8px)  | 緊湊排列     |
| Meta 字體  | `text-sm` (14px)   | `text-xs` (12px)   | 次要資訊縮小 |
| Meta 圖示  | `h-4 w-4`          | `h-3 w-3`          | 與字體匹配   |

**範例對比**：

```tsx
// ❌ 原有樣式（佔用空間大）
<Card>
  <CardHeader className="p-6">
    <CardTitle className="text-lg">{article.title}</CardTitle>
  </CardHeader>
  <CardContent className="p-6">
    <div className="flex items-center gap-6 text-sm">
      <FileText className="h-4 w-4" />
      <span>{article.word_count} 字</span>
    </div>
  </CardContent>
</Card>

// ✅ 優化樣式（資訊密度高）
<Card className="hover:shadow-md transition-shadow">
  <CardHeader className="p-4">
    <div className="flex items-start justify-between">
      <CardTitle className="text-base">{article.title}</CardTitle>
      {article.scheduled_publish_at && (
        <Badge variant="outline" className="text-xs">
          <Clock className="mr-1 h-3 w-3" />
          {formatScheduleTime(article.scheduled_publish_at)}
        </Badge>
      )}
    </div>
  </CardHeader>
  <CardContent className="p-4 pt-0">
    <div className="flex items-center gap-4 text-xs">
      <FileText className="h-3 w-3" />
      <span>{article.word_count} 字</span>
    </div>
  </CardContent>
</Card>
```

**可讀性保證**：

- 最小字體：12px (text-xs)，符合 WCAG 標準
- 行高：保持 1.5 倍行距
- 對比度：使用 `text-muted-foreground` 確保可讀性

### 4. 發布控制設計

**決定**：使用 Dialog 組件實作發布設定，支援狀態選擇和排程設定。

**UI 流程**：

1. 文章卡片顯示當前狀態 Badge（`generated`, `published`, `scheduled`）
2. 點擊「發布設定」按鈕 → 開啟 Dialog
3. Dialog 內容：
   - 發布目標選擇（僅 WordPress）
   - 狀態選擇（草稿/待審核/已發布/已排程）
   - 排程時間選擇器（條件顯示）
   - 確認按鈕：「立即發布」或「設定排程」

**資料流**：

```
使用者操作 → Dialog → API 呼叫 → 更新資料庫 → 重新載入列表
```

**狀態管理**：
使用現有欄位，無需新增：

- `generated_articles.wordpress_status`: `draft` | `published` | `scheduled`
- `generated_articles.published_at`: 發布時間戳
- `article_jobs.scheduled_publish_at`: 排程時間
- `article_jobs.auto_publish`: 是否自動發布

### 5. 排程顯示

**決定**：在文章卡片右上角顯示排程 Badge，使用 `outline` variant 區分其他狀態。

**顯示邏輯**：

```tsx
// 僅當文章有排程時顯示
{
  article.article_job?.scheduled_publish_at && (
    <Badge variant="outline" className="text-xs">
      <Clock className="mr-1 h-3 w-3" />
      {format(
        new Date(article.article_job.scheduled_publish_at),
        "MM/dd HH:mm",
      )}
    </Badge>
  );
}
```

**資料查詢**：
需要在 `getWebsiteArticles` 中 join `article_jobs` 表：

```typescript
const { data, error } = await supabase
  .from("generated_articles")
  .select(
    `
    *,
    article_job:article_jobs(scheduled_publish_at, auto_publish, status)
  `,
  )
  .eq("website_id", websiteId)
  .order("created_at", { ascending: false });
```

## API 設計

### 1. PATCH /api/articles/[id]

**用途**：更新文章 HTML 內容

**請求**：

```typescript
{
  html_content: string; // 必填，新的 HTML 內容
}
```

**處理流程**：

1. 驗證使用者權限（company_id 匹配）
2. 驗證 HTML 結構（基本檢查，如標籤閉合）
3. 更新 `html_content` 欄位
4. 重新計算 `word_count` 和 `reading_time`
5. 更新 `updated_at` 時間戳

**回應**：

```typescript
{
  success: true,
  article: {
    id: string;
    html_content: string;
    word_count: number;
    reading_time: number;
    updated_at: string;
  }
}
```

**錯誤處理**：

- 400：HTML 結構無效
- 403：無權限編輯
- 404：文章不存在

**實作範例**：

```typescript
// src/app/api/articles/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import * as cheerio from "cheerio";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { html_content } = await request.json();

  // 驗證 HTML
  try {
    const $ = cheerio.load(html_content);
    // 基本驗證：檢查是否有內容
    if ($("body").text().trim().length === 0) {
      return NextResponse.json({ error: "HTML 內容為空" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: "HTML 結構無效" }, { status: 400 });
  }

  const supabase = await createClient();

  // 重新計算字數和閱讀時間
  const $ = cheerio.load(html_content);
  const text = $("body").text();
  const word_count = text.length; // 中文字數
  const reading_time = Math.ceil(word_count / 300); // 假設每分鐘 300 字

  const { data, error } = await supabase
    .from("generated_articles")
    .update({
      html_content,
      word_count,
      reading_time,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", user.company_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, article: data });
}
```

### 2. POST /api/articles/[id]/publish

**用途**：立即發布文章到 WordPress

**請求**：

```typescript
{
  target: "wordpress"; // 第一階段僅支援 WordPress
}
```

**處理流程**：

1. 驗證使用者權限
2. 載入文章資料和 WordPress 配置
3. 呼叫 WordPress REST API 發布文章
4. 更新文章狀態為 `published`
5. 儲存 `wordpress_post_url`

**回應**：

```typescript
{
  success: true;
  wordpress_url: string;
  published_at: string;
}
```

### 3. POST /api/articles/[id]/schedule

**用途**：設定文章排程發布

**請求**：

```typescript
{
  scheduled_time: string; // ISO 8601 格式，必須為未來時間
  auto_publish: boolean; // 是否到時自動發布
}
```

**處理流程**：

1. 驗證使用者權限
2. 驗證排程時間（必須為未來時間）
3. 更新 `article_jobs.scheduled_publish_at`
4. 更新 `generated_articles.wordpress_status` 為 `scheduled`

**回應**：

```typescript
{
  success: true;
  scheduled_time: string;
}
```

## 資料庫結構

**重要**：無需新增欄位，現有結構已完整支援所有功能。

### generated_articles 表（相關欄位）

```sql
-- 文章內容
html_content TEXT NOT NULL,
markdown_content TEXT NOT NULL,

-- 統計
word_count INTEGER,
reading_time INTEGER,

-- WordPress 發布
wordpress_post_id INTEGER,
wordpress_post_url TEXT,
wordpress_status TEXT,  -- draft, published, scheduled

-- 狀態
status TEXT DEFAULT 'generated',
published_at TIMESTAMP WITH TIME ZONE,
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### article_jobs 表（相關欄位）

```sql
-- 排程功能
scheduled_publish_at TIMESTAMP WITH TIME ZONE,
auto_publish BOOLEAN DEFAULT true,
published_at TIMESTAMP WITH TIME ZONE,

-- 狀態
status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed, scheduled
```

## Risks / Trade-offs

### Risk 1: HTML 編輯可能破壞內容結構

**風險**：使用者不熟悉 HTML，修改後破壞排版或 SEO 結構。

**緩解措施**：

1. ✅ 新增「預覽」功能，即時顯示修改效果
2. ✅ 儲存前進行基本 HTML 驗證（使用 `cheerio`）
3. ✅ 提供「恢復原始版本」按鈕（查詢 `markdown_content` 重新生成）
4. ✅ 在編輯器上方顯示警告：「⚠️ 請謹慎修改 HTML，錯誤可能影響排版」

**實作**：

```tsx
<div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
  <p className="text-sm text-yellow-800">
    ⚠️ 請謹慎修改 HTML 結構。建議僅調整文字內容或樣式，避免刪除重要標籤。
  </p>
</div>
<HtmlEditor value={html} onChange={setHtml} />
<div className="mt-4 flex gap-2">
  <Button onClick={handleSave}>儲存</Button>
  <Button variant="outline" onClick={handlePreview}>預覽</Button>
  <Button variant="ghost" onClick={handleRestore}>恢復原始版本</Button>
</div>
```

### Risk 2: 資訊密度過高導致可讀性下降

**風險**：過度縮小字體和間距可能讓介面難以閱讀，特別是視力較差的使用者。

**緩解措施**：

1. ✅ 保持最小字體為 `12px` (text-xs)，符合 WCAG 2.1 標準
2. ✅ 使用色彩對比度檢查工具（如 WebAIM Contrast Checker）
3. ✅ 在多種螢幕尺寸（13", 15", 27"）測試可讀性
4. ✅ 考慮新增「緊湊模式」開關（使用者可切換）

**可選增強**：

```tsx
// 使用者偏好設定
const [compactMode, setCompactMode] = useState(
  localStorage.getItem("article-list-compact") === "true",
);

<div className={compactMode ? "space-y-2" : "space-y-4"}>{/* 文章列表 */}</div>;
```

### Risk 3: 編輯器效能問題

**風險**：處理大型 HTML 文件（> 10,000 行）時，編輯器可能卡頓。

**緩解措施**：

1. ✅ 使用 `react-simple-code-editor`（比 Monaco 輕量）
2. ✅ 限制文章大小（前端警告 > 50KB 的 HTML）
3. ✅ 如確實需要，提供「降級模式」（純 textarea）

### Risk 4: WordPress API 發布失敗

**風險**：網路錯誤、API 金鑰過期、WordPress 版本不相容等導致發布失敗。

**緩解措施**：

1. ✅ 實作完整的錯誤處理和重試機制
2. ✅ 提供詳細的錯誤訊息（區分網路錯誤、認證錯誤、權限錯誤）
3. ✅ 記錄失敗原因到 `article_jobs.error_message`
4. ✅ 提供「重新發布」按鈕

**錯誤處理範例**：

```typescript
try {
  const response = await fetch(wordpressApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WordPress API 錯誤：${error.message}`);
  }

  // 成功處理...
} catch (error) {
  // 區分錯誤類型
  if (error.message.includes("401")) {
    return { error: "API 金鑰無效或已過期，請至設定頁面更新" };
  } else if (error.message.includes("403")) {
    return { error: "無權限發布，請檢查 WordPress 使用者角色" };
  } else if (error.message.includes("網路")) {
    return { error: "網路連線失敗，請檢查網路設定" };
  } else {
    return { error: `發布失敗：${error.message}` };
  }
}
```

## Migration Plan

### Phase 1: UI 優化（不涉及 API）- 第 1-2 週

**目標**：完成頂部導航欄和文章列表優化

**任務**：

1. 建立 `LanguageSelector` 組件
2. 調整 `TokenBalanceDisplay` 支援 compact 模式
3. 更新 `dashboard/layout.tsx` 整合組件
4. 優化文章列表樣式
5. 新增排程 Badge 顯示

**測試**：

- 在不同螢幕尺寸測試響應式佈局
- 驗證 Credit 顯示和語系切換功能
- 確認文章列表可讀性

**部署**：

- 無資料庫變更，可直接部署
- 使用 feature flag 控制新 UI（可選）

### Phase 2: HTML 編輯功能 - 第 3 週

**目標**：實現 HTML 編輯和預覽

**任務**：

1. 安裝依賴：`pnpm add react-simple-code-editor prismjs cheerio`
2. 建立 `HtmlEditor` 組件
3. 建立編輯頁面 `/articles/[id]/edit`
4. 實作 `PATCH /api/articles/[id]` API
5. 新增預覽對話框

**測試**：

- 測試語法高亮
- 測試 HTML 驗證（故意輸入錯誤 HTML）
- 測試字數和閱讀時間重新計算
- 測試大型 HTML（> 10KB）的效能

**部署**：

- 無資料庫變更
- 新增 API 端點（向後相容）

### Phase 3: 發布控制 - 第 4 週

**目標**：實現發布設定和排程功能

**任務**：

1. 建立 `PublishControlDialog` 組件
2. 實作 `POST /api/articles/[id]/publish` API
3. 實作 `POST /api/articles/[id]/schedule` API
4. 整合到文章列表

**測試**：

- 測試立即發布流程
- 測試排程設定
- 測試錯誤處理（API 失敗、網路錯誤）
- 測試 WordPress API 整合

**部署**：

- 無資料庫變更（使用現有欄位）
- 需要配置 WordPress API 金鑰

### Rollback Plan

**Phase 1**：

- 如果 UI 變更導致使用者困擾，可快速回退 CSS
- 使用 Git revert 恢復到上一版本

**Phase 2**：

- 編輯功能為新增功能，可透過移除連結關閉
- API 端點保持向後相容，不影響現有功能

**Phase 3**：

- 發布功能為增強，不影響現有發布流程
- 可透過環境變數暫時關閉排程功能

## Open Questions

1. **HTML 編輯器是否需要版本控制？**
   - **建議**：第一版不實作，若使用者需求強烈再考慮
   - **替代方案**：保留 `markdown_content`，可隨時重新生成 HTML

2. **是否需要批次發布功能？**
   - **建議**：延後至使用者有明確需求時再實作
   - **理由**：增加複雜度，且目前使用情境不明確

3. **語系選擇是否影響現有文章？**
   - **建議**：僅影響新生成的文章，不改變現有文章語系
   - **實作**：將語系儲存至 localStorage，生成時讀取

4. **排程發布是否需要後台任務？**
   - **建議**：是，使用 cron job 或 Supabase Edge Functions
   - **實作**：定時檢查 `scheduled_publish_at` 並自動發布

5. **是否允許編輯已發布的文章 HTML？**
   - **建議**：允許，但顯示警告「修改已發布文章可能影響 SEO」
   - **增強**：提供「同步到 WordPress」按鈕

## Performance Considerations

### 1. 編輯器載入效能

**優化**：

- 使用 `react-simple-code-editor`（輕量）
- Prism.js 僅載入 HTML 語法支援（~20KB）
- 避免載入完整的 Monaco Editor（~3MB）

**測量**：

- 首次載入時間 < 500ms
- 編輯器初始化時間 < 100ms

### 2. 文章列表查詢效能

**優化**：

- 在 `article_jobs.scheduled_publish_at` 建立索引（已存在）
- 使用 Supabase join 一次查詢所有資料
- 限制每頁顯示數量（20-50 篇）

**SQL 索引**（已存在）：

```sql
CREATE INDEX idx_article_jobs_scheduled
ON article_jobs(scheduled_publish_at)
WHERE scheduled_publish_at IS NOT NULL;
```

### 3. Credit 顯示更新頻率

**優化**：

- 使用 SWR 快取（10 秒輪詢）
- 監聽文章生成完成事件，立即更新
- 避免每次路由切換都重新查詢

**已實作**（`TokenBalanceDisplay.tsx`）：

```typescript
const { data: balance } = useSWR<TokenBalance>(
  "/api/billing/balance",
  fetcher,
  {
    refreshInterval: 10000, // 10 秒輪詢
    revalidateOnFocus: true,
    dedupingInterval: 2000, // 防止重複請求
  },
);
```

## Security Considerations

### 1. HTML 注入攻擊

**風險**：使用者輸入惡意 HTML（如 `<script>` 標籤）

**緩解**：

- ✅ 在預覽時使用 DOMPurify 淨化 HTML
- ✅ WordPress 發布時依賴 WordPress 自身的淨化機制
- ✅ 不在管理後台渲染未淨化的 HTML

**已實作**（`ArticleHtmlPreview` 組件）：

```typescript
import DOMPurify from "isomorphic-dompurify";

const cleanHtml = DOMPurify.sanitize(htmlContent);
```

### 2. WordPress API 金鑰管理

**風險**：API 金鑰洩漏或被竊取

**緩解**：

- ✅ 金鑰儲存在 Supabase（加密）
- ✅ 僅 Server Component 可存取
- ✅ 前端永不暴露金鑰
- ✅ 實作金鑰輪換機制（管理員可重新生成）

### 3. 權限驗證

**風險**：使用者編輯或發布不屬於自己的文章

**緩解**：

- ✅ 所有 API 端點驗證 `company_id` 匹配
- ✅ 使用 Row Level Security (RLS) 雙重保護
- ✅ 審計日誌記錄所有編輯和發布操作

**RLS 政策**（已存在）：

```sql
CREATE POLICY "Users can only access their company's articles"
ON generated_articles
FOR ALL
USING (company_id IN (
  SELECT company_id FROM company_members
  WHERE user_id = auth.uid() AND status = 'active'
));
```

## Monitoring & Observability

### 1. 錯誤追蹤

**實作**：

- 記錄所有 API 錯誤到 `article_jobs.error_message`
- 使用 Sentry 或類似工具追蹤前端錯誤
- 監控 WordPress API 呼叫失敗率

### 2. 效能監控

**指標**：

- HTML 編輯器載入時間
- API 回應時間（PATCH, POST）
- 文章列表渲染時間
- WordPress 發布成功率

### 3. 使用者行為追蹤

**事件**：

- HTML 編輯次數
- 發布成功/失敗次數
- 排程設定次數
- 語系切換次數

## Summary

此設計文件詳細規劃了文章管理 UI 的改進方案，核心原則為：

1. **零資料庫變更**：充分利用現有欄位，避免 migration 風險
2. **輕量優先**：選擇 `react-simple-code-editor` 而非 Monaco Editor
3. **漸進增強**：分三階段實作，每階段獨立可部署
4. **向後相容**：所有新功能不影響現有流程
5. **安全第一**：完整的權限驗證和 HTML 淨化
6. **效能優化**：索引、快取、按需載入

預計總開發時間：4 週，每週可獨立部署一個階段。
