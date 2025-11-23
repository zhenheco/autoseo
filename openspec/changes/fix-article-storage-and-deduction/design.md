# Design: 修復文章儲存流程與 Token 扣除邏輯

## 架構概述

文章生成系統涉及三個核心流程：

1. **文章生成流程** (`ParallelOrchestrator`)
2. **文章儲存流程** (`ArticleStorageService`)
3. **Token 計費流程** (`TokenBillingService`)

目前這三個流程之間缺乏適當的同步機制，導致重複生成、Token 未扣除等問題。

## 問題分析

### 問題 1: 文章重複生成

**當前流程**:

```
1. 用戶選擇標題
2. 建立 article_job (status='pending')
3. GitHub Actions 觸發 process-jobs.ts
4. orchestrator.execute() 生成文章
5. saveArticleWithRecommendations() 儲存到 generated_articles
6. updateJobStatus('completed')
```

**問題根源**:

- `article_jobs` 和 `generated_articles` 之間沒有雙向關聯
- `orchestrator.execute()` 沒有檢查是否已生成
- 如果 `updateJobStatus` 失敗，job 仍是 `pending`，會被重複處理

**影響**:

- 同一個 job 可能觸發多次生成
- 浪費 AI Token 和資源
- 產生多筆重複的文章記錄

### 問題 2: Token 未扣除

**當前流程**:

```
1. generate-batch API: checkTokenBalance() - 只檢查不扣除
2. orchestrator.execute(): 執行所有 AI 調用
3. 每個 agent 記錄 token usage 到 executionInfo
4. ❌ 沒有調用 deductTokensIdempotent()
5. ❌ Token 餘額不變
```

**問題根源**:

- `TokenBillingService.deductTokensIdempotent()` 已實作但未被調用
- `orchestrator.execute()` 完成時只更新 job status，沒有扣除 Token
- Token 使用量只記錄在 `result.executionStats`，沒有寫入資料庫

**影響**:

- 用戶 Token 餘額不準確
- 無法追蹤實際用量
- 商業邏輯失效

### 問題 3: HTML 預覽顯示 Markdown

**當前流程**:

```
1. HTMLAgent.execute() 輸出 html_content
2. article-storage.ts 儲存到 generated_articles.html_content
3. 前端從資料庫讀取 html_content
4. 使用 DOMPurify.sanitize() 渲染
```

**可能原因**:

- `HTMLAgent` 輸出的是 Markdown 而非 HTML
- `article-storage.ts` 誤儲存 `markdown_content` 到 `html_content`
- 前端渲染配置問題（已在先前修復中解決）

## 解決方案設計

### 方案 1: 防止重複生成

**設計**:

```typescript
// orchestrator.ts - execute() 開頭
async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
  const supabase = await this.getSupabase();

  // 1. 檢查是否已生成
  const { data: jobData } = await supabase
    .from('article_jobs')
    .select('metadata')
    .eq('id', input.articleJobId)
    .single();

  if (jobData?.metadata?.saved_article_id) {
    // 已生成，從資料庫載入並返回
    const { data: article } = await supabase
      .from('generated_articles')
      .select('*')
      .eq('id', jobData.metadata.saved_article_id)
      .single();

    return this.reconstructResultFromArticle(article);
  }

  // 2. 繼續正常流程...
}

// 文章儲存成功後
const savedArticle = await articleStorage.saveArticleWithRecommendations(...);

// 3. 立即更新 metadata 記錄文章 ID
await supabase
  .from('article_jobs')
  .update({
    metadata: {
      ...jobData.metadata,
      saved_article_id: savedArticle.article.id,
      generation_completed_at: new Date().toISOString(),
    }
  })
  .eq('id', input.articleJobId);
```

**好處**:

- Idempotent: 重複執行返回相同結果
- 快速: 跳過不必要的 AI 調用
- 資料一致: 確保一對一關係

### 方案 2: 實作 Token 扣除

**設計**:

```typescript
// orchestrator.ts - Phase 8 文章儲存後
if (result.success || result.wordpress) {
  try {
    // 1. 儲存文章
    const savedArticle = await articleStorage.saveArticleWithRecommendations({
      articleJobId: input.articleJobId,
      result,
      websiteId: input.websiteId,
      companyId: input.companyId,
      userId,
    });

    // 2. 累積所有 AI token 使用量
    const totalTokenUsage = this.calculateTotalTokenUsage(result);

    // 3. 調用 Token 扣除
    const tokenBillingService = new TokenBillingService(supabase);

    try {
      await tokenBillingService.deductTokensIdempotent({
        idempotencyKey: input.articleJobId,
        companyId: input.companyId,
        articleId: savedArticle.article.id,
        amount: totalTokenUsage.charged,
        metadata: {
          modelName: 'multi-agent-generation',
          articleTitle: result.meta?.seo.title,
          breakdown: {
            research: result.research?.executionInfo.tokenUsage,
            strategy: result.strategy?.executionInfo.tokenUsage,
            writing: result.writing?.executionInfo.tokenUsage,
            meta: result.meta?.executionInfo.tokenUsage,
            image: result.image?.executionInfo?.tokenUsage,
          },
          totalOfficialTokens: totalTokenUsage.official,
          totalChargedTokens: totalTokenUsage.charged,
        },
      });

      console.log('[Orchestrator] ✅ Token 扣除成功:', totalTokenUsage.charged);
    } catch (tokenError) {
      console.error('[Orchestrator] ⚠️  Token 扣除失敗（不影響文章生成）:', tokenError);
      // 記錄錯誤但不中斷流程
      await supabase
        .from('article_jobs')
        .update({
          metadata: {
            ...jobData.metadata,
            token_deduction_error: (tokenError as Error).message,
            token_deduction_attempted_at: new Date().toISOString(),
          }
        })
        .eq('id', input.articleJobId);
    }
  } catch (storageError) {
    console.error('[Orchestrator] 文章儲存失敗:', storageError);
  }
}

// 輔助方法
private calculateTotalTokenUsage(result: ArticleGenerationResult): {
  official: number;
  charged: number;
} {
  let officialTotal = 0;
  let chargedTotal = 0;

  [result.research, result.strategy, result.writing, result.meta, result.image]
    .filter(phase => phase?.executionInfo?.tokenUsage)
    .forEach(phase => {
      officialTotal += phase.executionInfo.tokenUsage.total || 0;
      chargedTotal += phase.executionInfo.tokenUsage.charged || phase.executionInfo.tokenUsage.total || 0;
    });

  return { official: officialTotal, charged: chargedTotal };
}
```

**好處**:

- Idempotent: 使用 `articleJobId` 作為 key，避免重複扣除
- 完整記錄: 詳細的 token breakdown
- 容錯: 扣除失敗不影響文章生成

### 方案 3: 確保 HTML 正確儲存

**驗證點**:

1. **HTMLAgent 輸出驗證**:

```typescript
// html-agent.ts
async execute(input: HTMLAgentInput): Promise<HTMLAgentOutput> {
  // 確保返回的是 HTML 而非 Markdown
  const html = await this.convertMarkdownToHtml(input.html);

  return {
    html, // ← 必須是 HTML 格式
    executionInfo: {...},
  };
}
```

2. **ArticleStorage 儲存驗證**:

```typescript
// article-storage.ts line 200-203
const articleData = {
  markdown_content: result.writing!.markdown, // 原始 Markdown
  html_content: result.writing!.html, // 渲染後 HTML ✓
  // ...
};
```

3. **前端渲染驗證** (已完成):

```typescript
// articles/page.tsx - 使用 DOMPurify 正確渲染
dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(selectedArticle.html_content || '<p>內容載入中...</p>', {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', ..., 'img', ...],
    ALLOWED_ATTR: ['href', 'src', 'alt', ...],
  }),
}}
```

## 資料流程圖

### 修復前（有問題）:

```
用戶選擇標題
    ↓
建立 article_job (status='pending')
    ↓
GitHub Actions 觸發
    ↓
orchestrator.execute()
    ├─ Phase 1-7: 生成文章
    ├─ Phase 8: saveArticle() → generated_articles
    └─ updateJobStatus('completed') → article_jobs
         ↓
    ❌ 如果失敗，job 仍是 'pending'
    ❌ 下次 cron 會重複執行
    ❌ 產生多篇重複文章
```

### 修復後（正確）:

```
用戶選擇標題
    ↓
建立 article_job (status='pending')
    ↓
GitHub Actions 觸發
    ↓
orchestrator.execute()
    ├─ 檢查 metadata.saved_article_id
    │   └─ ✅ 如果存在，直接返回
    │
    ├─ Phase 1-7: 生成文章
    ├─ Phase 8: saveArticle() → generated_articles
    │   └─ ✅ 立即更新 metadata.saved_article_id
    │
    ├─ Token 扣除
    │   └─ ✅ deductTokensIdempotent(articleJobId)
    │
    └─ updateJobStatus('completed')
         ↓
    ✅ 即使 status 更新失敗，有 saved_article_id 保護
    ✅ 下次執行會直接返回已生成的文章
    ✅ Token 不會重複扣除（idempotency key）
```

## 技術考量

### 1. Idempotency（冪等性）

**為什麼重要**:

- 分散式系統中，操作可能因網路問題被重試
- 確保重複執行不會產生副作用

**實作**:

- 文章生成: 使用 `metadata.saved_article_id` 作為標記
- Token 扣除: 使用 `articleJobId` 作為 idempotency key

### 2. 錯誤處理策略

**原則**:

- 文章生成成功 > Token 扣除失敗：接受，記錄錯誤
- 文章生成失敗：整個流程失敗
- Token 扣除失敗：不中斷文章生成，但記錄錯誤供後續補扣

### 3. 資料一致性

**挑戰**:

- `article_jobs` 和 `generated_articles` 跨表更新
- 如果一個成功、一個失敗？

**解決**:

- 優先儲存文章（核心價值）
- 立即更新 metadata 建立關聯
- Token 扣除作為「最後一步」，失敗可補救

### 4. 效能影響

**新增操作**:

- 開頭檢查 `saved_article_id`: ~50ms
- Token 扣除: ~200ms
- 更新 metadata: ~50ms

**總計**: ~300ms overhead（相對於整個文章生成流程 60-120 秒，可忽略）

## 測試策略

### 單元測試

```typescript
describe("ParallelOrchestrator", () => {
  it("should skip generation if article already exists", async () => {
    // 模擬已有 saved_article_id
    const result = await orchestrator.execute(input);
    expect(result.savedArticle.id).toBe(existingArticleId);
    expect(aiClient.complete).not.toHaveBeenCalled();
  });

  it("should deduct tokens after article generation", async () => {
    const result = await orchestrator.execute(input);
    expect(tokenBillingService.deductTokensIdempotent).toHaveBeenCalledWith({
      idempotencyKey: input.articleJobId,
      amount: expect.any(Number),
    });
  });

  it("should handle token deduction failure gracefully", async () => {
    tokenBillingService.deductTokensIdempotent.mockRejectedValue(
      new Error("DB error"),
    );
    const result = await orchestrator.execute(input);
    expect(result.success).toBe(true); // 文章仍成功生成
  });
});
```

### 整合測試

```typescript
describe("Article Generation E2E", () => {
  it("should generate article only once even if triggered multiple times", async () => {
    await orchestrator.execute(input);
    await orchestrator.execute(input); // 重複執行

    const articles = await getArticlesByJobId(articleJobId);
    expect(articles).toHaveLength(1); // 只有一篇
  });

  it("should correctly deduct tokens from balance", async () => {
    const balanceBefore = await getTokenBalance(companyId);
    await orchestrator.execute(input);
    const balanceAfter = await getTokenBalance(companyId);

    expect(balanceBefore - balanceAfter).toBeGreaterThan(0);
  });
});
```

## 部署計劃

### 階段 1: 防重複生成（風險最低）

- 先部署 `saved_article_id` 檢查機制
- 不影響現有流程
- 立即見效

### 階段 2: Token 扣除（需監控）

- 部署 Token 扣除邏輯
- 密切監控 Token 餘額變化
- 準備回滾方案

### 階段 3: HTML 驗證（已部分完成）

- 前端 DOMPurify 已修復
- 後端 HTMLAgent 驗證
- 資料庫內容檢查

## 監控指標

部署後需要監控：

1. **文章生成**:
   - 重複文章數量（應為 0）
   - 生成失敗率
   - 平均生成時間

2. **Token 使用**:
   - 扣除成功率（應 > 99%）
   - 餘額準確性
   - 扣除失敗原因

3. **預覽顯示**:
   - HTML 正確率
   - Markdown 誤顯示數量
   - 圖片載入成功率
