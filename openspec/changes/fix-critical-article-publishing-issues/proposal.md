# 修復關鍵文章發布問題

## 問題摘要

目前系統存在四個關鍵問題影響核心功能運作：

1. **WordPress 發布失敗**：選擇網站並點擊發布後，文章未實際發布到 WordPress 網站
2. **已發布狀態顯示不明確**：已發布文章缺乏明確的視覺狀態標示（建議使用紅色圈）
3. **Credits 扣除失敗**：文章生成完成後無法正確扣除 Credits，懷疑是 token 計算或命名問題
4. **UI 字體大小錯誤**：文章列表中標題與 meta 資料（日期、字數）的字體大小需互換

## 影響範圍

- **使用者體驗**：嚴重 - 無法正常發布文章，計費錯誤
- **受影響組件**：
  - WordPress 發布 API (`/api/articles/[id]/publish`)
  - Token 計費服務 (`TokenBillingService`)
  - 文章狀態顯示 (`ArticleStatusIcon`)
  - 文章列表 UI (`articles/page.tsx`)

## 技術債務/既有問題

### 問題 1: WordPress 發布流程缺陷

**根因**：`/api/articles/[id]/publish/route.ts` 只更新資料庫狀態，未實際調用 `WordPressClient` 發布文章

```typescript:src/app/api/articles/[id]/publish/route.ts
// 當前程式碼只更新資料庫，沒有實際發布
const { error: updateError } = await supabase
  .from('generated_articles')
  .update({
    wordpress_status: publishStatus,
    published_at: now,
    status: 'published',
  })
```

**缺失**：

- 未建立 `WordPressClient` 實例
- 未調用 `createPost()` 方法
- 未處理分類/標籤同步
- 未上傳特色圖片
- 未保存 WordPress post ID 和 URL

### 問題 2: 狀態顯示邏輯不完整

`ArticleStatusIcon` 可能未處理 `status: 'published'` 或 `wordpress_status: 'publish'` 狀態

### 問題 3: Token 扣除失敗

根據 `TokenBillingService` 分析：

**可能原因**：

1. **API Response 缺少 usage 欄位**：

   ```typescript:src/lib/billing/token-billing-service.ts
   const actualCalculation = await this.calculator.calculate({
     modelName: response.model || options.model,
     inputTokens: response.usage.promptTokens,  // ← 如果 response.usage 為 undefined 會出錯
     outputTokens: response.usage.completionTokens,
   })
   ```

2. **模型回應格式不一致**：不同 AI 模型（OpenAI, Anthropic, Deepseek 等）的 token 欄位命名不同
   - OpenAI: `usage.prompt_tokens`, `usage.completion_tokens`
   - Anthropic: `usage.input_tokens`, `usage.output_tokens`
   - 需要在 `api-router.ts` 統一標準化

3. **錯誤處理缺失**：當 `response.usage` 為空時，沒有降級處理（使用預估值）

### 問題 4: UI 文字大小

文章列表元資料字體過大（text-[10px]），標題字體過小（text-sm）

## 提議解決方案

### 1. 實作完整 WordPress 發布流程

- 建立 `WordPressPublishService` 處理完整發布邏輯
- 分離關注點：API route → Service → WordPress Client
- 實作重試機制和錯誤恢復
- 添加發布後驗證

### 2. 增強狀態視覺化

- 為 `published` 狀態添加紅色圓點標示
- 為 `scheduled` 狀態保留現有黃色標示
- 為 `draft` 狀態使用灰色標示

### 3. 修復 Token 計費邏輯

- 在 `api-router.ts` 標準化所有模型的 token usage 格式
- 添加降級處理：當無法取得實際 token 使用時，使用預估值
- 增加詳細日誌記錄 token 扣除流程
- 修復 `completeWithBilling` 的錯誤處理

### 4. 調整文章列表 UI

- 標題字體：`text-sm` → `text-base font-semibold`
- Meta 資料字體：`text-[10px]` → `text-xs`

## 變更規格

此變更修改以下規格：

1. **wordpress-publishing** (新增)：WordPress 文章發布流程
2. **article-status-display** (修改)：文章狀態視覺顯示
3. **token-billing** (修改)：Token 計費邏輯
4. **article-list-ui** (修改)：文章列表使用者介面

## 預期成果

- ✅ 點擊「發布」後，文章實際發布到 WordPress 並返回 post ID 和 URL
- ✅ 已發布文章在列表中顯示紅色圓點
- ✅ Credits 在文章生成後正確扣除，並記錄詳細使用日誌
- ✅ 文章列表標題清晰可讀，meta 資料適當縮小

## 風險與考量

- **向後相容性**：需保留現有資料庫結構
- **效能影響**：WordPress 發布為同步操作，可能需 2-5 秒
- **錯誤處理**：網路失敗時需要明確的錯誤訊息
- **測試覆蓋**：需要模擬各種 AI 模型的 response 格式

## 依賴關係

- 需要 `WordPressClient` 已正確設定認證（Application Password 或 JWT）
- 需要 `website_configs` 表包含有效的 WordPress 憑證
- 需要 `TokenCalculator` 支援所有使用的 AI 模型

## 實作順序

1. 先修復 Token 計費（最關鍵）
2. 實作 WordPress 發布服務
3. 更新狀態顯示
4. 調整 UI 文字大小
