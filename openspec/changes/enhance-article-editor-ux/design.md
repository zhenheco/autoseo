# Design: Enhance Article Editor UX

## Architecture Overview

本變更涉及三個獨立的 UI 改進，分別針對不同的組件：

1. **InlineHtmlEditor** - 新增 WYSIWYG 編輯模式
2. **ArticleList** - 優化狀態顯示
3. **PublishDialog** - 新增網站選擇器

## Technical Decisions

### 1. WYSIWYG 編輯器選擇

#### 選項評估

**Option A: TipTap**

- 優點：
  - 基於 ProseMirror，強大且可擴展
  - React 整合良好
  - 支援協作編輯（未來可能需要）
  - 可輸出 HTML
- 缺點：
  - 包體積較大
  - 學習曲線較陡

**Option B: Lexical (Meta)**

- 優點：
  - 現代化架構
  - 效能優異
  - React 原生支援
- 缺點：
  - 相對較新，生態系統較小
  - HTML 輸出需要額外配置

**Option C: Quill**

- 優點：
  - 成熟穩定
  - 簡單易用
  - 輕量級
- 缺點：
  - React 整合需要額外工作
  - 自訂能力較弱

**決定：選擇 TipTap**

- 理由：專案已有 React 生態系統，TipTap 提供最佳的 React 整合和未來擴展性
- Trade-off：接受較大的包體積，換取更好的開發體驗和功能完整性
- 業界驗證：根據 Liveblocks 2025 年調查，TipTap 是最受歡迎的協作編輯框架之一

**必要套件**：

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
```

**效能最佳化配置**（基於 TipTap 2025 官方最佳實踐）：

- 使用 `EditorContext` 避免 prop drilling
- 設定 `immediatelyRender: false` 支援 SSR 並避免 hydration 錯誤
- 設定 `shouldRerenderOnTransaction: false` 提升 React 效能（減少不必要的重新渲染）
- 使用 `useEditorState` hook 僅訂閱必要的狀態變更，而非整個編輯器狀態
- 將編輯器隔離在獨立元件中，避免父元件狀態變更觸發編輯器重新渲染
- 避免過度使用 React Node Views（會影響效能）

**效能監控**：

- 使用 React DevTools Profiler 追蹤重新渲染頻率
- 在編輯器元件中插入 `console.count` 監測渲染次數
- 目標：編輯時每秒重新渲染次數 < 10 次

### 2. 編輯模式設計

**移除所有分頁，只保留單一視覺編輯模式**

理由：

- 簡化使用者體驗，避免認知負擔
- TipTap JSON 儲存格式已提供完整的內容控制
- 移除原始碼編輯降低使用者犯錯的風險
- 符合現代 CMS 編輯器趨勢（如 Notion、WordPress Gutenberg）

最終結構：

```
單一編輯區域：
  - 視覺編輯 (WYSIWYG with Toolbar)
```

### 3. 狀態顯示優化

**業界最佳實踐**（基於 PatternFly、Carbon Design System）：

- 狀態和嚴重性應透過**文字 + 顏色 + 圖示**的組合呈現
- 圖示單獨使用時必須配上文字標籤或 tooltip

**當前實作**：

```tsx
status: "completed"; // 硬編碼字串
```

**新設計（符合 WCAG 2.1 AA）**：

```tsx
import { Check, Clock, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// 狀態圖示組件
<Tooltip>
  <TooltipTrigger asChild>
    <div role="img" aria-label="已完成" className="inline-flex items-center">
      <Check className="h-4 w-4 text-green-600" />
    </div>
  </TooltipTrigger>
  <TooltipContent role="tooltip">
    <p>已完成</p>
  </TooltipContent>
</Tooltip>;
```

**無障礙要求**：

- 顏色對比度 ≥ 4.5:1
- 包含 `role="img"` 和 `aria-label`
- Tooltip 包含 `role="tooltip"`
- 支援鍵盤導航（Tab 鍵觸發 tooltip）

### 4. 網站選擇器與發布工作流程

**現代 CMS 工作流程模式（2025 最佳實踐）**：

基於 Storyblok、Contentful 等現代 CMS 的設計模式，發布流程應包含：

1. **明確的狀態階段**：drafting → reviewing → ready to publish → published
2. **基於角色的權限**：不同角色擁有不同的發布權限
3. **發布目標選擇**：清晰顯示將發布到哪個網站

**資料來源**：

- Table: 從現有程式碼確認使用 `articles.website_id` 欄位
- 查詢使用者的 WordPress 網站列表（基於 `company_id`）

**UI 設計（增強版）**：

```tsx
<div className="space-y-4">
  {/* 發布目標選擇 */}
  <div>
    <Label htmlFor="website">發布目標網站 *</Label>
    <Select
      value={selectedWebsiteId}
      onValueChange={setSelectedWebsiteId}
      required
    >
      <SelectTrigger id="website">
        <SelectValue placeholder="選擇發布網站" />
      </SelectTrigger>
      <SelectContent>
        {websites.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            <p>尚無可用網站</p>
            <Link href="/settings/websites" className="text-primary underline">
              前往設定新增網站
            </Link>
          </div>
        )}
        {websites.map((site) => (
          <SelectItem key={site.id} value={site.id}>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>{site.name}</span>
              <span className="text-xs text-muted-foreground">
                ({new URL(site.url).hostname})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* 發布狀態提示 */}
  {selectedWebsiteId && (
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertDescription>文章將發布至：{selectedWebsite.name}</AlertDescription>
    </Alert>
  )}
</div>
```

**快取策略**：

```tsx
// 使用 SWR 或 React Query 快取網站列表
const { data: websites, isLoading } = useSWR(
  `/api/websites?company_id=${companyId}`,
  fetcher,
  { revalidateOnFocus: false, dedupingInterval: 60000 },
);
```

## Data Storage Strategy

### JSON vs HTML 儲存

**最佳實踐（基於 2025 業界標準）**：

- **主要資料**：儲存 TipTap JSON 格式作為真實來源（source of truth）
- **快取欄位**：選擇性儲存 HTML 到獨立欄位用於快速渲染

**理由**：

1. **安全性**：JSON 比原始 HTML 更安全（降低 XSS 風險）
2. **結構驗證**：可針對 TipTap schema 驗證 JSON，避免畸形資料
3. **未來擴展**：JSON 格式更容易支援協作編輯、版本控制等進階功能

**資料庫 Schema 更新**：

```sql
ALTER TABLE articles ADD COLUMN content_json JSONB;
-- html_content 保留用於快速渲染和相容性
```

## Security Considerations

### 多層安全防護策略（Defense in Depth）

基於 OWASP XSS Prevention Cheat Sheet 2025 最佳實踐，實作三層防護：

**層級 1：TipTap Schema 過濾（第一道防線）**

```typescript
// TipTap 只允許在 extensions 中定義的節點和標記
import StarterKit from "@tiptap/starter-kit";

const editor = useEditor({
  extensions: [
    StarterKit, // 僅允許：Bold, Italic, Heading, Paragraph, List 等
  ],
});
// 未定義的標籤（如 <script>, <style>）會被自動移除
```

**層級 2：客戶端 DOMPurify 清理（即時回饋）**

```typescript
import DOMPurify from "dompurify";

// 配置允許的標籤和屬性
const config = {
  ALLOWED_TAGS: [
    // 基本格式
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    // 標題
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // 列表
    "ul",
    "ol",
    "li",
    // 連結和圖片
    "a",
    "img",
    // 嵌入內容（僅限特定來源）
    "iframe",
  ],
  ALLOWED_ATTR: [
    "href",
    "title",
    "target",
    "src",
    "alt",
    "width",
    "height",
    "allow",
    "allowfullscreen",
    "frameborder",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|blob):)/i,
};

const sanitizedHtml = DOMPurify.sanitize(editor.getHTML(), config);
```

**層級 3：伺服器端 sanitize-html（最後防線）**

```typescript
// Node.js 伺服器端
import sanitizeHtml from "sanitize-html";

const cleanHtml = sanitizeHtml(html, {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target"],
    img: ["src", "alt", "width", "height"],
    iframe: ["src", "allow", "allowfullscreen", "frameborder"],
  },
  allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
  // 移除所有 JavaScript 偽協議
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // 移除所有事件處理器（onclick, onerror 等）
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
});

// 額外驗證：拒絕不安全的 HTML
if (html !== cleanHtml) {
  throw new Error("內容包含不安全的元素");
}
```

### JSON Schema 驗證

**伺服器端驗證 TipTap JSON 格式**：

```typescript
import Ajv from "ajv";

const tiptapSchema = {
  type: "object",
  required: ["type", "content"],
  properties: {
    type: { enum: ["doc"] },
    content: {
      type: "array",
      items: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            enum: [
              "paragraph",
              "heading",
              "text",
              "bulletList",
              "orderedList",
              "listItem",
              "blockquote",
              "codeBlock",
            ],
          },
          attrs: { type: "object" },
          content: { type: "array" },
          marks: { type: "array" },
        },
      },
    },
  },
};

const ajv = new Ajv();
const validate = ajv.compile(tiptapSchema);

if (!validate(contentJson)) {
  throw new Error("內容格式不正確");
}
```

### Content Security Policy (CSP)

**額外安全層**（在 HTTP headers 中設定）：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  frame-src https://www.youtube.com https://player.vimeo.com;
```

### 安全測試案例

**必須測試的 XSS 向量**（> 50 個測試案例）：

```typescript
// 基本 script injection
'<script>alert("XSS")</script>';
'<img src=x onerror=alert("XSS")>';

// Event handlers
'<div onclick="alert(\'XSS\')">Click</div>';
'<body onload="alert(\'XSS\')">';

// JavaScript 偽協議
'<a href="javascript:alert(\'XSS\')">Link</a>';
'<img src="javascript:alert(\'XSS\')">';

// HTML entity encoding
"<img src=x onerror=&#97;&#108;&#101;&#114;&#116;&#40;&#39;XSS&#39;&#41;>";

// Data URI
'<img src="data:text/html,<script>alert(\'XSS\')</script>">';

// SVG vectors
'<svg onload=alert("XSS")>';

// 所有測試案例都應被成功清理或拒絕
```

**關鍵原則**：

- 永遠不要信任客戶端的清理
- 伺服器端必須獨立驗證所有輸入
- 不要修改已清理的內容（會引入新的漏洞）
- 使用白名單而非黑名單策略

## Performance Considerations

### 編輯器效能

- **Lazy Loading**：使用 `React.lazy()` 動態載入 TipTap
- **Code Splitting**：TipTap 套件獨立 chunk，約 200KB (gzipped)
- **初始渲染優化**：`immediatelyRender: false` 避免 SSR 水合問題
- **Transaction 優化**：`shouldRerenderOnTransaction: false` 減少不必要的重渲染

### 草稿儲存

- 保留現有的 `localStorage` 草稿自動儲存
- 防抖（debounce）1 秒後儲存
- 儲存 JSON 格式（比 HTML 更輕量）

### 資料查詢

- **網站列表快取**：使用 SWR/React Query，60 秒內不重複請求
- **分頁載入**：文章列表支援分頁或虛擬滾動
- **狀態圖示**：使用 SVG icon，無額外網路請求

### Bundle Size Impact

```
預估影響：
+ @tiptap/react: ~60KB (gzipped)
+ @tiptap/pm: ~120KB (gzipped)
+ @tiptap/starter-kit: ~30KB (gzipped)
--------------------------------------
Total: ~210KB (僅在點擊「視覺編輯」時載入)
```

## UX Design Patterns

### 即時視覺編輯

**模式**：所見即所得，直接在最終渲染樣式上編輯

實作：

- 單一編輯區域，整合工具列和內容區
- 編輯器樣式符合 WordPress 最終渲染效果
- 即時回饋，無需切換分頁

### 發布確認流程

**模式**：清晰的確認對話框，防止誤發布

實作：

```
1. 點擊「發布」按鈕
2. 顯示對話框：
   - 目標網站
   - 文章標題
   - 最後修改時間
3. 確認後執行發布
4. 顯示成功訊息（包含已發布的 URL）
```

## Implementation Sequence

### Phase 1: 狀態圖示優化（最簡單，快速交付價值）

- 預估時間：2-3 小時
- 價值：立即提升列表可視性
- 風險：低

### Phase 2: 網站選擇器（中等複雜度）

- 預估時間：4-6 小時
- 價值：簡化發布流程
- 風險：中（需確保 API 正確查詢網站）

### Phase 3: WYSIWYG 編輯器（最複雜，需要最多測試）

- 預估時間：8-10 小時
- 價值：大幅改善編輯體驗
- 風險：高（需要充分測試安全性、效能）
- 注意：移除所有分頁，單一編輯模式可簡化實作

**建議**：按順序實作，每個 phase 完成後部署到 staging 環境測試
