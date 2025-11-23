# Proposal: 修復文章儲存流程與 Token 扣除邏輯

## Why

用戶回報三個關鍵問題影響文章生成系統的可用性：

1. **文章重複生成問題**：選定標題生成後會產生多篇文章（任務 A、文章 B、文章 C），正常應該只有一篇文章並更新到任務 A
2. **Token 未扣除問題**：文章生成完成後，Token 餘額沒有依照實際使用量扣除，導致用戶無法準確追蹤用量
3. **預覽顯示 Markdown 問題**：文章列表右側預覽區域顯示 Markdown 格式而非渲染後的 HTML

這些問題直接影響：

- **系統可靠性**：重複生成浪費資源和 Token
- **商業邏輯**：Token 計費不準確，造成收入損失
- **用戶體驗**：無法正常預覽文章內容

## What Changes

### 1. 修復文章儲存與 Job 狀態同步

**問題根因**：

- `orchestrator.ts` 在 line 545 調用 `saveArticleWithRecommendations()` 建立新的 `generated_articles` 記錄
- 但沒有更新原始的 `article_jobs.status` 到正確狀態
- 導致系統將同一個 job 視為未完成，重複生成文章

**解決方案**：

- 文章儲存成功後，將 `article_jobs` 的文章 ID 記錄到 `metadata.saved_article_id`
- 在生成流程開始前檢查是否已有儲存的文章，避免重複生成
- 確保 `article_jobs.status = 'completed'` 時同時更新文章 ID

### 2. 實作 Token 扣除邏輯

**問題根因**：

- `TokenBillingService` 已實作 `deductTokensIdempotent()` 方法
- 但 `orchestrator.execute()` 完成時沒有調用此方法
- Token 只在生成前「檢查餘額」，沒有在完成後「實際扣除」

**解決方案**：

- 在 `orchestrator.ts` 的 Phase 8（文章儲存後）新增 Token 扣除邏輯
- 累積所有 AI 調用的實際 token 使用量
- 使用 `deductTokensIdempotent()` 扣除，以 `articleJobId` 作為 idempotency key
- 扣除失敗記錄錯誤但不中斷流程

### 3. 修正 HTML 預覽顯示

**問題根因**：

- `generated_articles.html_content` 可能儲存了 Markdown 格式
- 或前端顯示時未正確渲染 HTML

**解決方案**：

- 驗證 `HTMLAgent` 確實產生 HTML 而非 Markdown
- 確保 `article-storage.ts` 儲存的是 `writing.html` 而非 `writing.markdown`
- 前端使用 DOMPurify 正確渲染 HTML（已在先前修復中完成）

## Impact

### Affected specs

- `article-generation` (需新建或更新)
- `token-billing` (已存在，需新增 deduction 流程)

### Affected code

- `src/lib/agents/orchestrator.ts` - 新增 Token 扣除和防重複生成邏輯
- `src/lib/services/article-storage.ts` - 驗證 HTML 儲存正確性
- `src/lib/billing/token-billing-service.ts` - 確保 `deductTokensIdempotent` 可用
- `src/app/(dashboard)/dashboard/articles/page.tsx` - 已修復（使用 DOMPurify）

### Dependencies

- 需要 `TokenBillingService.deductTokensIdempotent()` 正常運作
- 需要 `article_jobs.metadata` 支援儲存文章 ID
- 需要 `generated_articles` 正確儲存 HTML 內容

## Risks

- **低風險**: Token 扣除使用 idempotency key，避免重複扣除
- **低風險**: 防重複生成邏輯只檢查 metadata，不影響現有流程
- **需驗證**: 確保所有 AI 調用的 token 使用量都被正確記錄
