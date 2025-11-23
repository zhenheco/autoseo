# 實作任務清單

## 階段 1：Token 計費修復（最高優先級）⭐

### 1.1 標準化 AI Usage 格式

- [ ] 在 `src/lib/ai/api-router.ts` 添加 `normalizeUsage()` 方法
- [ ] 處理 Anthropic 格式 (`input_tokens`, `output_tokens`)
- [ ] 處理 OpenAI/Deepseek 格式 (`prompt_tokens`, `completion_tokens`)
- [ ] 處理缺失 usage 的情況（返回零值）
- [ ] 添加詳細日誌記錄未知格式
- [ ] 修改 `complete()` 方法調用標準化

**驗證**：

```bash
# 測試不同模型的 token 計費
pnpm exec tsx scripts/test-token-billing.ts
```

### 1.2 Token 計費降級處理

- [ ] 修改 `TokenBillingService.completeWithBilling()`
- [ ] 添加 usage 有效性檢查 (`!response.usage || response.usage.totalTokens === 0`)
- [ ] 實作降級邏輯：使用 `estimateArticleTokens()`
- [ ] 在日誌中標記 `metadata.estimation: true`
- [ ] 添加警告日誌：「No usage data from AI provider, using estimation」
- [ ] 確保不拋出錯誤，優雅降級

**驗證**：

```bash
# 模擬沒有 usage 的情況
pnpm exec tsx scripts/test-token-fallback.ts
```

### 1.3 詳細日誌記錄

- [ ] 在 `token_usage_logs` 插入時添加完整 metadata
- [ ] 記錄是否使用預估 (`estimation` 欄位)
- [ ] 記錄警告訊息 (`warning` 欄位)
- [ ] 添加 console.log 追蹤計費流程

**驗證**：

```sql
-- 檢查最近的 token usage 記錄
SELECT
  model_name,
  charged_tokens,
  metadata->'estimation' as is_estimation,
  metadata->'warning' as warning,
  created_at
FROM token_usage_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 階段 2：WordPress 發布功能

### 2.1 建立 WordPressPublishService

- [ ] 建立檔案 `src/lib/services/wordpress-publish.service.ts`
- [ ] 實作 `publish()` 主方法
- [ ] 實作 `getArticle()` 私有方法
- [ ] 實作 `getWebsiteConfig()` 私有方法
- [ ] 實作 `syncCategories()` 私有方法
- [ ] 實作 `syncTags()` 私有方法
- [ ] 實作 `uploadFeaturedImage()` 私有方法
- [ ] 添加完整的 TypeScript 類型定義

**驗證**：

```typescript
const service = new WordPressPublishService(supabase);
const result = await service.publish({
  articleId: "test-id",
  websiteId: "test-website-id",
  companyId: "test-company-id",
  publishStatus: "publish",
});
```

### 2.2 分類和標籤同步

- [ ] 在 `syncCategories()` 中獲取現有分類
- [ ] 建立分類名稱到 ID 的映射
- [ ] 檢查分類是否存在，不存在則建立
- [ ] 返回分類 ID 陣列
- [ ] 對標籤實作相同邏輯

**驗證**：

- 檢查 WordPress 後台，確認新分類已建立
- 確認現有分類被重用（未重複建立）

### 2.3 特色圖片上傳

- [ ] 實作 `uploadFeaturedImage()` 方法
- [ ] 使用 fetch 下載圖片
- [ ] 將圖片轉為 Buffer/Blob
- [ ] 調用 `WordPressClient.uploadMedia()`
- [ ] 返回 media ID
- [ ] 錯誤處理：圖片下載失敗或上傳失敗

**驗證**：

- 確認圖片出現在 WordPress 媒體庫
- 確認文章有正確的特色圖片

### 2.4 SEO 外掛整合

- [ ] 檢查網站的 `seo_plugin` 設定
- [ ] 如果是 'rankmath'，調用 `updateRankMathMeta()`
- [ ] 傳遞 `rank_math_title`, `rank_math_description`, `rank_math_focus_keyword`
- [ ] 如果是 'yoast'，在 `createPost` 時包含 `yoast_meta`
- [ ] 添加錯誤處理：SEO 更新失敗不應阻止發布

**驗證**：

- 檢查 WordPress 文章，確認 SEO meta 正確設定
- 測試 Rank Math 和 Yoast 兩種外掛

### 2.5 資料庫更新

- [ ] 在發布成功後更新 `generated_articles` 表
- [ ] 設定 `wordpress_post_id`
- [ ] 設定 `wordpress_post_url`
- [ ] 設定 `wordpress_status`
- [ ] 設定 `published_at`
- [ ] 設定 `status` 為 'published'
- [ ] 設定 `published_to_website_id`

**驗證**：

```sql
SELECT
  id,
  title,
  wordpress_post_id,
  wordpress_post_url,
  status,
  published_at
FROM generated_articles
WHERE id = 'test-article-id';
```

### 2.6 更新 Publish API Route

- [ ] 修改 `src/app/api/articles/[id]/publish/route.ts`
- [ ] 建立 `WordPressPublishService` 實例
- [ ] 調用 `service.publish()`
- [ ] 處理成功響應
- [ ] 處理錯誤：認證失敗、網路錯誤、未知錯誤
- [ ] 返回適當的 HTTP 狀態碼和錯誤訊息

**驗證**：

```bash
curl -X POST http://localhost:3000/api/articles/[article-id]/publish \
  -H "Content-Type: application/json" \
  -d '{"target": "wordpress", "website_id": "website-id", "status": "publish"}'
```

### 2.7 錯誤處理和重試

- [ ] 定義自訂錯誤類別：`WordPressAuthError`, `WordPressNetworkError`
- [ ] 在 API route 中捕獲並分類錯誤
- [ ] 返回明確的錯誤代碼：`AUTH_FAILED`, `NETWORK_ERROR`, `UNKNOWN_ERROR`
- [ ] 標記可重試的錯誤 (`retryable: true`)
- [ ] 添加 Sentry 錯誤追蹤（如果已設定）

**驗證**：

- 測試錯誤憑證，確認返回 `AUTH_FAILED`
- 測試無效的網站 URL，確認返回 `NETWORK_ERROR`

---

## 階段 3：狀態顯示更新

### 3.1 更新 ArticleStatusIcon 組件

- [ ] 開啟 `src/components/articles/ArticleStatusIcon.tsx`
- [ ] 添加 `wordpressStatus` prop 到類型定義
- [ ] 優先檢查 `wordpressStatus === 'publish' || status === 'published'`
- [ ] 顯示紅色圓點和「已發布」文字
- [ ] 保留現有的排程和草稿邏輯

**驗證**：

- 視覺檢查文章列表
- 確認已發布文章顯示紅色圓點

### 3.2 更新文章列表查詢

- [ ] 修改 `src/app/(dashboard)/dashboard/articles/page.tsx`
- [ ] 確保 fetch 查詢包含 `wordpress_status` 欄位
- [ ] 傳遞 `wordpress_status` 到 `ArticleStatusIcon`

**驗證**：

```typescript
console.log("Article data:", article);
// 應該包含 wordpress_status 欄位
```

### 3.3 資料庫 Migration（如需要）

- [ ] 檢查 `wordpress_status` 欄位是否存在於 `generated_articles` 表
- [ ] 如果不存在，建立 migration 添加欄位
- [ ] 類型：`text`，可為空
- [ ] 預設值：`null`

**驗證**：

```sql
\d generated_articles
-- 確認 wordpress_status 欄位存在
```

---

## 階段 4：UI 文字大小調整

### 4.1 調整文章標題樣式

- [ ] 開啟 `src/app/(dashboard)/dashboard/articles/page.tsx`
- [ ] 找到第 265 行左右的標題元素
- [ ] 將 `text-sm font-medium` 改為 `text-base font-semibold`
- [ ] 保留 `truncate` 類別

**Before**:

```typescript
<h3 className="text-sm font-medium truncate">{item.title}</h3>
```

**After**:

```typescript
<h3 className="text-base font-semibold truncate">{item.title}</h3>
```

**驗證**：視覺檢查標題是否更大更醒目

### 4.2 調整 Meta 資料樣式

- [ ] 找到第 271 行左右的 meta 容器
- [ ] 將 `text-[10px]` 改為 `text-xs`
- [ ] 保留其他樣式不變

**Before**:

```typescript
<div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
```

**After**:

```typescript
<div className="flex gap-3 text-xs text-muted-foreground mt-1">
```

**驗證**：視覺檢查 meta 資料是否仍清晰可讀

---

## 階段 5：測試和驗證

### 5.1 單元測試

- [ ] 撰寫 `WordPressPublishService` 測試
- [ ] 撰寫 `APIRouter.normalizeUsage()` 測試
- [ ] 撰寫 `TokenBillingService` 降級測試
- [ ] 撰寫 `ArticleStatusIcon` 渲染測試

**執行**：

```bash
pnpm test
```

### 5.2 整合測試

- [ ] 測試完整的 WordPress 發布流程
- [ ] 測試 Token 計費與實際 AI 模型
- [ ] 測試狀態顯示與資料庫同步

**執行**：

```bash
pnpm test:integration
```

### 5.3 手動測試清單

- [ ] 生成一篇文章
- [ ] 確認 Credits 正確扣除
- [ ] 選擇 WordPress 網站並發布
- [ ] 確認文章出現在 WordPress 後台
- [ ] 確認文章列表顯示紅色「已發布」狀態
- [ ] 確認標題和 meta 資料文字大小正確
- [ ] 測試發布到不存在的網站（應顯示錯誤）
- [ ] 測試錯誤的憑證（應顯示認證失敗）

### 5.4 效能測試

- [ ] 測試 WordPress 發布時間（應在 5 秒內）
- [ ] 測試 Token 計費不影響生成速度
- [ ] 檢查資料庫查詢效能

---

## 階段 6：文件和部署

### 6.1 更新文件

- [ ] 更新 `CLAUDE.md` 或 `README.md` 說明 WordPress 發布功能
- [ ] 記錄所需的 WordPress 設定（Application Password）
- [ ] 說明支援的 SEO 外掛（Rank Math, Yoast）

### 6.2 環境變數檢查

- [ ] 確認不需要新的環境變數
- [ ] 驗證現有環境變數足夠

### 6.3 資料庫 Migration

- [ ] 如有新 migration，測試 up 和 down
- [ ] 在 staging 環境執行 migration
- [ ] 確認無資料遺失

### 6.4 部署到 Production

- [ ] 部署到 staging 並測試
- [ ] 通知用戶即將部署的變更
- [ ] 部署到 production
- [ ] 監控錯誤日誌和 Sentry

### 6.5 部署後驗證

- [ ] 在 production 測試 WordPress 發布
- [ ] 確認 Token 計費正常
- [ ] 檢查 `token_usage_logs` 表有新記錄
- [ ] 確認 UI 更新正確顯示

---

## 回滾計劃

如果部署後發現嚴重問題：

1. **Token 計費問題**：
   - 回滾 `api-router.ts` 和 `token-billing-service.ts`
   - 使用 Git revert 命令

2. **WordPress 發布問題**：
   - 暫時停用 WordPress 發布功能
   - 只保留資料庫狀態更新

3. **UI 問題**：
   - 快速修復 CSS 即可，風險最低

---

## 完成標準

所有任務完成後，系統應該：

✅ WordPress 發布功能完全正常，文章實際發布到網站
✅ Credits 在每次文章生成後正確扣除
✅ 已發布文章顯示紅色「已發布」標誌
✅ 文章列表標題清晰可讀（16px），meta 資料適當縮小（12px）
✅ 所有測試通過
✅ 無新的錯誤或警告
✅ 文件更新完整
