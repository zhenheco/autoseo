# 設計文件：強化文章管理使用者體驗

## Context

目前文章管理系統存在多個使用者體驗問題，包括 HTML 連結渲染、文章狀態管理、批次操作功能缺失等。本次改進旨在提供完整的文章管理工作流程，從批次生成、即時編輯、到排程發佈的端到端解決方案。

**關鍵限制**：

- 需保持與現有 WordPress 發佈流程的兼容性
- 必須支援多網站配置
- 需考慮性能優化（大量文章列表）
- 富文本編輯器需支援 HTML 內容的雙向轉換

**利害關係人**：

- 內容創作者（需要高效的編輯和發佈工具）
- SEO 專家（需要批次排程和多網站管理）
- 系統管理員（需要穩定可靠的文章狀態管理）

## Goals / Non-Goals

### Goals

1. 修復 HTML 連結渲染問題，確保所有連結正常運作
2. 解決文章狀態管理混亂，避免重複創建任務
3. 實作完整的批次選擇和排程發佈功能
4. 提供即時編輯功能，減少來回切換
5. 支援多網站和多平台發佈

### Non-Goals

1. 不包含 SEO 分析和建議功能（已有其他系統處理）
2. 不實作版本控制和協作編輯（未來可考慮）
3. 不支援自訂發佈平台（僅 WordPress 和預定義平台）

## Decisions

### Decision 1: 富文本編輯器選擇

**選擇**：使用 Tiptap 作為富文本編輯器

**理由**：

- **Tiptap**：
  - 基於 ProseMirror，性能優異
  - 完整的 React 支援和 TypeScript 類型
  - 模組化設計，可按需載入功能
  - 活躍的社區和良好的文件
  - 支援自訂擴展

- **替代方案考慮**：
  - **Lexical**（Meta）：功能強大但學習曲線較陡
  - **Slate**：過於底層，需要更多自訂開發
  - **Quill**：較舊，社區活躍度下降

### Decision 2: 文章狀態管理策略

**選擇**：使用 `slug` 作為唯一性標識，配合時間戳確保唯一性

**理由**：

- Slug 已在系統中使用，具有語義化
- 時間戳可避免標題相同但內容不同的情況
- 支援冪等性檢查，避免重複創建

**實作**：

```typescript
// 生成唯一 slug
const baseSlug = slugify(title, { lower: true, strict: true });
const uniqueSlug = `${baseSlug}-${Date.now()}`;

// 冪等性檢查
const existing = await supabase
  .from("article_jobs")
  .select("id, status")
  .eq("slug", uniqueSlug)
  .single();

if (existing && existing.status !== "completed") {
  // 更新現有任務
} else {
  // 創建新任務
}
```

### Decision 3: HTML 連結渲染優化

**選擇**：使用 `useMemo` 快取 DOMPurify 清理結果

**理由**：

- DOMPurify.sanitize 是 CPU 密集操作
- 文章內容不頻繁變更，適合使用快取
- 參考業界最佳實踐（LogRocket, DEV Community）

**實作**：

```typescript
const sanitizedHTML = useMemo(
  () => DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: [...],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', ...],
  }),
  [htmlContent]
);
```

### Decision 4: 批次操作架構

**選擇**：使用客戶端 state 管理選擇狀態，伺服器端處理批次邏輯

**理由**：

- 即時的 UI 反饋需要客戶端狀態
- 批次操作需要伺服器端確保一致性
- 使用樂觀更新提升使用者體驗

**資料流**：

```
使用者勾選 → 客戶端 state 更新 → UI 立即反應
   ↓
點擊 SCHEDULE ALL → 批次 API 請求 → 伺服器處理
   ↓
返回結果 → 客戶端更新狀態 → 重新獲取文章列表
```

### Decision 5: 排程發佈機制

**選擇**：使用資料庫排程 + Cron job 輪詢

**理由**：

- 簡單可靠，不需要額外的訊息佇列系統
- 現有架構已有 Cron job 基礎設施
- 可使用 Supabase 的 scheduled_at 欄位

**替代方案**：

- **GitHub Actions**：已用於文章生成，可擴展用於排程發佈
- **Redis + Bull Queue**：過於複雜，目前規模不需要

## Risks / Trade-offs

### Risk 1: 富文本編輯器性能

**風險**：大型文章（>10000 字）可能導致編輯器卡頓

**緩解措施**：

- 使用虛擬化渲染（react-window）
- 實作延遲載入（lazy loading）
- 限制單篇文章最大字數（如 20000 字）

### Risk 2: 批次發佈失敗處理

**風險**：批次發佈時部分文章失敗，難以追蹤和重試

**緩解措施**：

- 實作交易式批次處理（全部成功或全部失敗）
- 記錄詳細的發佈日誌到 `article_publications` 表
- 提供重試機制和失敗文章列表

### Risk 3: 即時儲存資料丟失

**風險**：自動儲存失敗或網路問題導致編輯內容丟失

**緩解措施**：

- 使用 localStorage 作為本地備份
- 實作離線編輯功能（Service Worker）
- 定期檢查同步狀態，顯示警告

### Trade-off: 功能豐富度 vs 複雜度

**取捨**：提供完整的編輯功能可能增加學習曲線

**決策**：

- 提供預設模板和快捷鍵提示
- 實作使用者引導（onboarding tour）
- 分階段發布功能（MVP → 進階功能）

## Migration Plan

### Phase 1: 修復現有問題（Week 1）

1. 修復 HTML 連結渲染
2. 修正文章狀態管理邏輯
3. 添加冪等性檢查

**驗證標準**：

- 所有連結可點擊並正確導向
- 不再出現重複的 article_jobs
- 文章狀態正確轉換

### Phase 2: 基礎功能實作（Week 2-3）

1. 實作批次選擇功能
2. 實作排程發佈工具列
3. 實作文章狀態指示器

**驗證標準**：

- 可勾選單篇或全選文章
- 可設定排程時間並批次發佈
- 狀態指示器正確顯示

### Phase 3: 進階功能實作（Week 4-5）

1. 整合富文本編輯器
2. 實作即時編輯和自動儲存
3. 實作單篇發佈功能

**驗證標準**：

- 編輯器流暢運作，無明顯卡頓
- 自動儲存正常，無資料丟失
- 單篇發佈成功並顯示結果

### Phase 4: 優化與測試（Week 6）

1. UI/UX 優化
2. 性能測試和優化
3. 整合測試

**驗證標準**：

- 所有功能通過端到端測試
- 性能指標符合預期（載入時間 < 2s）
- 無 critical bugs

### Rollback Plan

如果發現嚴重問題：

1. 使用 feature flags 關閉新功能
2. 回滾資料庫遷移（如有）
3. 恢復舊版組件

## Open Questions

1. **富文本編輯器擴展功能**：是否需要支援表格、程式碼區塊、嵌入影片？
   - 建議：MVP 階段先不支援，根據使用者反饋決定

2. **多語言支援**：編輯器界面是否需要多語言？
   - 建議：目前專注於繁體中文，未來可擴展

3. **協作編輯**：是否需要多人同時編輯同一篇文章？
   - 建議：非當前優先級，可列入未來規劃

4. **版本控制**：是否需要追蹤文章編輯歷史？
   - 建議：實作基礎版本記錄（created_at, updated_at），完整版本控制未來考慮

## Performance Optimization

### Tiptap 編輯器優化（基於官方最佳實踐）

**關鍵問題**：Tailwind `prose` 類別在大型文件會造成嚴重性能下降

**解決方案**：

```typescript
// 1. 禁用不必要的重新渲染
const editor = useEditor({
  extensions: [...],
  shouldRerenderOnTransaction: false, // 關鍵優化
});

// 2. 避免在 transactions 期間遍歷文件狀態
// 使用 nodeView 時使用純 HTML 元素，避免複雜的 React 組件
```

**性能指標**：

- 初次載入時間 < 500ms
- 編輯器輸入延遲 < 16ms（60fps）
- 大型文章（> 5000字）渲染時間 < 1s

### 虛擬化和延遲載入

```typescript
// 文章列表使用虛擬化
import { useVirtualizer } from "@tanstack/react-virtual";

// 只渲染可見範圍的文章
```

## Security Considerations

### XSS 防護

- ✅ DOMPurify 清理所有 HTML 內容
- ✅ 嚴格的 ALLOWED_TAGS 和 ALLOWED_ATTR 白名單
- ✅ CSP (Content Security Policy) headers
- ❌ 禁止 `<script>`, `<iframe>`, `<object>`, `<embed>`

### CSRF 防護

- 使用 Next.js 內建的 CSRF token
- 所有 POST/PUT/DELETE 請求需要驗證

### 權限控制

```typescript
// 檢查使用者是否有編輯權限
const canEdit = await checkPermission(userId, "write", articleId);
if (!canEdit) throw new ForbiddenError();
```

## Error Handling & Retry Mechanism

### WordPress API Rate Limiting 處理

**問題**：批次發佈時可能觸發 WordPress API rate limit

**解決方案**：實作 exponential backoff 重試機制

```typescript
async function publishWithRetry(
  article: Article,
  maxRetries = 3,
  baseDelay = 1000,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await wordpressAPI.publish(article);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### 批次操作錯誤處理

**策略**：部分失敗，記錄詳細日誌

```typescript
const results = await Promise.allSettled(
  articles.map((article) => publishWithRetry(article)),
);

const succeeded = results.filter((r) => r.status === "fulfilled");
const failed = results.filter((r) => r.status === "rejected");

// 記錄到 article_publications 表
```

## Database Schema Changes

### 新增 scheduled_at 欄位

```sql
ALTER TABLE generated_articles
ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_edited_by UUID REFERENCES auth.users(id);

CREATE INDEX idx_generated_articles_scheduled
ON generated_articles(scheduled_at)
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';
```

### 新增 article_publications 表（發佈歷史）

```sql
CREATE TABLE article_publications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES generated_articles(id) ON DELETE CASCADE,
  website_id UUID REFERENCES website_configs(id),
  platform TEXT NOT NULL, -- 'wordpress', 'medium', 'hashnode', etc.

  -- 發佈資訊
  platform_post_id TEXT,
  platform_post_url TEXT,
  platform_status TEXT, -- 'draft', 'published', 'scheduled', 'failed'

  -- 錯誤處理
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,

  -- 時間戳
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_article_publications_article ON article_publications(article_id);
CREATE INDEX idx_article_publications_scheduled ON article_publications(scheduled_at) WHERE platform_status = 'scheduled';
```

### 唯一性約束（避免重複創建）

```sql
-- 為 article_jobs 新增複合唯一索引
CREATE UNIQUE INDEX idx_article_jobs_unique_slug
ON article_jobs(slug)
WHERE status != 'failed';
```

## Offline Support & Local Backup

### localStorage 備份

```typescript
// 每次編輯時自動備份到 localStorage
useEffect(() => {
  const backup = {
    articleId,
    content: editor.getHTML(),
    timestamp: Date.now(),
  };
  localStorage.setItem(`article_backup_${articleId}`, JSON.stringify(backup));
}, [editor.getHTML()]);

// 載入時檢查備份
useEffect(() => {
  const backup = localStorage.getItem(`article_backup_${articleId}`);
  if (backup) {
    const { content, timestamp } = JSON.parse(backup);
    if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
      // 24 hours
      // 提示使用者恢復備份
    }
  }
}, []);
```

### 離線狀態檢測

```typescript
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  window.addEventListener("online", () => setIsOnline(true));
  window.addEventListener("offline", () => setIsOnline(false));
}, []);
```

## Monitoring & Logging

### 關鍵指標監控

- 文章生成成功率
- 發佈成功率（按平台）
- 編輯器性能指標（輸入延遲、渲染時間）
- API 錯誤率和響應時間

### 日誌策略

```typescript
// 結構化日誌
logger.info("Article published", {
  articleId,
  platform: "wordpress",
  duration: endTime - startTime,
  wordCount: article.word_count,
});

logger.error("Publication failed", {
  articleId,
  platform: "wordpress",
  error: error.message,
  retryCount,
});
```

### 使用 Sentry 追蹤錯誤

```typescript
Sentry.captureException(error, {
  tags: {
    feature: "article-publishing",
    platform: "wordpress",
  },
  extra: {
    articleId,
    articleTitle,
  },
});
```

## Testing Strategy

### Unit Tests

- HTML 清理功能（DOMPurify 配置）
- 狀態管理邏輯（批次選擇、排程）
- API 重試機制

### Integration Tests

- 文章編輯流程（編輯 → 自動儲存 → 發佈）
- 批次發佈流程
- 排程發佈流程

### E2E Tests

```typescript
// 使用 Playwright
test("批次排程發佈流程", async ({ page }) => {
  // 1. 勾選多篇文章
  await page.click('[data-testid="article-checkbox-1"]');
  await page.click('[data-testid="article-checkbox-2"]');

  // 2. 設定排程時間
  await page.click('[data-testid="schedule-button"]');
  await page.fill('[data-testid="schedule-date"]', "2025-12-01");

  // 3. 確認排程
  await page.click('[data-testid="confirm-schedule"]');

  // 4. 驗證成功訊息
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

### Performance Tests

- 載入 1000+ 篇文章列表
- 編輯 10000+ 字文章
- 批次發佈 50+ 篇文章

## Concurrent Editing Handling

### 樂觀鎖定（Optimistic Locking）

```typescript
// 使用版本號防止並發衝突
interface Article {
  id: string;
  content: string;
  version: number; // 版本號
  updated_at: string;
}

// 更新時檢查版本
await supabase
  .from("generated_articles")
  .update({
    content: newContent,
    version: article.version + 1,
  })
  .eq("id", articleId)
  .eq("version", article.version); // 如果版本不匹配，更新失敗
```

### 衝突檢測

```typescript
// 定期檢查是否有其他使用者編輯
const checkConflict = useCallback(async () => {
  const { data } = await supabase
    .from("generated_articles")
    .select("updated_at, last_edited_by")
    .eq("id", articleId)
    .single();

  if (
    data.updated_at > lastKnownUpdateAt &&
    data.last_edited_by !== currentUserId
  ) {
    // 顯示衝突警告
    showConflictWarning();
  }
}, [articleId]);

useEffect(() => {
  const interval = setInterval(checkConflict, 30000); // 每 30 秒檢查
  return () => clearInterval(interval);
}, [checkConflict]);
```

## UI Components Design

### WordPress 發佈工具列

基於參考截圖的 UI 設計，發佈工具列包含以下組件：

```typescript
interface PublishToolbarProps {
  articleId: string;
  onPublishSuccess: (result: PublishResult) => void;
}

interface PublishResult {
  platform: "wordpress";
  websiteId: string;
  websiteName: string;
  status: "publish" | "draft" | "scheduled";
  postId: string;
  postUrl: string;
  publishedAt: string;
}
```

**組件佈局**：

```tsx
<div className="flex items-center gap-4 p-4 border-t">
  {/* WordPress 標籤 */}
  <div className="text-sm font-medium">WordPress</div>

  {/* 網站選擇器 */}
  <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
    <SelectTrigger className="w-[200px]">
      <SelectValue placeholder="選擇網站" />
    </SelectTrigger>
    <SelectContent>
      {websites.map((site) => (
        <SelectItem key={site.id} value={site.id}>
          {site.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* 狀態選擇器 */}
  <Select value={publishStatus} onValueChange={setPublishStatus}>
    <SelectTrigger className="w-[150px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="publish">Publish</SelectItem>
      <SelectItem value="draft">Draft</SelectItem>
      <SelectItem value="scheduled">Scheduled</SelectItem>
    </SelectContent>
  </Select>

  {/* 排程日期選擇器（僅在 scheduled 時顯示） */}
  {publishStatus === "scheduled" && (
    <DateTimePicker value={scheduledDate} onChange={setScheduledDate} />
  )}

  {/* POST 按鈕 */}
  <Button
    onClick={handlePublish}
    disabled={isPublishing || !selectedWebsite}
    className="bg-purple-600 hover:bg-purple-700"
  >
    {isPublishing ? "發佈中..." : "POST"}
  </Button>
</div>;

{
  /* 發佈結果顯示 */
}
{
  publishResult && (
    <div className="p-4 bg-green-50 border-t">
      Published on: {publishResult.publishedAt}{" "}
      <a
        href={publishResult.postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline font-medium"
      >
        GO TO POST
      </a>
    </div>
  );
}
```

**狀態管理**：

```typescript
const [selectedWebsite, setSelectedWebsite] = useState<string>("");
const [publishStatus, setPublishStatus] = useState<
  "publish" | "draft" | "scheduled"
>("publish");
const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
const [isPublishing, setIsPublishing] = useState(false);
const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

const handlePublish = async () => {
  setIsPublishing(true);
  try {
    const result = await publishArticle({
      articleId,
      websiteId: selectedWebsite,
      status: publishStatus,
      scheduledAt: publishStatus === "scheduled" ? scheduledDate : null,
    });
    setPublishResult(result);
    onPublishSuccess(result);
  } catch (error) {
    toast.error("發佈失敗：" + error.message);
  } finally {
    setIsPublishing(false);
  }
};
```

### 批次選擇工具列

```typescript
interface BatchToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onScheduleAll: (date: Date) => void;
  onResetSchedule: () => void;
}
```

**組件佈局**：

```tsx
<div className="flex items-center gap-4 p-4 bg-gray-50 border-b">
  {/* 選擇資訊 */}
  <div className="text-sm text-gray-600">已選取 {selectedCount} 篇文章</div>

  {/* Select All 按鈕 */}
  <Button variant="outline" onClick={onSelectAll}>
    Select All
  </Button>

  {/* 排程工具 */}
  {selectedCount > 0 && (
    <>
      <DateTimePicker value={scheduleDate} onChange={setScheduleDate} />

      <Select value={scheduleMode} onValueChange={setScheduleMode}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="排程條件" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="immediate">立即發佈</SelectItem>
          <SelectItem value="specific">指定時間</SelectItem>
          <SelectItem value="interval">間隔發佈</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={handleScheduleAll} className="bg-blue-600">
        SCHEDULE ALL
      </Button>

      <Button variant="outline" onClick={onResetSchedule}>
        RESET SCHEDULE
      </Button>
    </>
  )}
</div>
```

## Technical Stack

### Frontend

- **編輯器**：Tiptap v2
  - 配置：`shouldRerenderOnTransaction: false`
  - 避免使用 Tailwind `prose` 在編輯器內
- **狀態管理**：React useState/useReducer（局部狀態）
- **UI 組件**：shadcn/ui（已有）
- **日期選擇器**：shadcn/ui date picker
- **虛擬化**：@tanstack/react-virtual

### Backend

- **API**：Next.js API Routes
- **資料庫**：Supabase PostgreSQL
- **Cron Job**：Vercel Cron（每分鐘檢查排程文章）
- **任務佇列**：簡單的 PostgreSQL 查詢（未來可升級為 Bull/BullMQ）

### Monitoring & Observability

- **錯誤追蹤**：Sentry
- **日誌**：結構化日誌（JSON format）
- **性能監控**：Web Vitals API

### Third-party Services

- **WordPress API**：使用現有整合，加上 rate limiting 處理
- **DOMPurify**：HTML 清理（strict 模式）
- **Clipboard API**：複製功能（with fallback）
