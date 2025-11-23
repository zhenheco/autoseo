# 設計文件：修復關鍵文章發布問題

## 架構概覽

此變更跨越多個系統層級：

```
┌─────────────────────────────────────────────────────────────┐
│ 前端 UI                                                       │
│ - ArticleList (文字大小調整)                                  │
│ - ArticleStatusIcon (狀態視覺化)                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ API Routes                                                   │
│ - POST /api/articles/[id]/publish (WordPress 發布)           │
│ - POST /api/articles/generate-batch (Token 計費)            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 服務層                                                        │
│ - WordPressPublishService (新增)                            │
│ - TokenBillingService (修復)                                │
│ - ArticleStorageService                                      │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ WP Client│    │AI API Router │
│         │    │              │
└─────────┘    └──────────────┘
```

## 問題 1: WordPress 發布流程設計

### 當前流程（有缺陷）

```typescript
用戶點擊發布
  ↓
API 更新資料庫 status = 'published'
  ↓
返回成功（但文章未實際發布）❌
```

### 修復後流程

```typescript
用戶點擊發布
  ↓
API 驗證權限和文章存在
  ↓
調用 WordPressPublishService
  ↓
  1. 建立 WordPressClient
  2. 獲取網站設定（URL、憑證）
  3. 處理分類映射
  4. 處理標籤映射
  5. 上傳特色圖片（如果有）
  6. 調用 createPost()
  7. 更新 Rank Math/Yoast SEO meta
  ↓
保存 WordPress post ID 和 URL 到資料庫
  ↓
更新文章狀態為 'published'
  ↓
返回完整發布資訊 ✅
```

### WordPressPublishService 設計

```typescript
class WordPressPublishService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async publish(params: {
    articleId: string;
    websiteId: string;
    companyId: string;
    publishStatus: "publish" | "draft";
  }): Promise<PublishResult> {
    // 1. 獲取文章完整資料
    const article = await this.getArticle(params.articleId);

    // 2. 獲取網站設定
    const website = await this.getWebsiteConfig(params.websiteId);

    // 3. 建立 WordPress 客戶端
    const wpClient = new WordPressClient({
      url: website.url,
      username: website.username,
      applicationPassword: website.app_password,
    });

    // 4. 處理分類
    const categoryIds = await this.syncCategories(wpClient, article.categories);

    // 5. 處理標籤
    const tagIds = await this.syncTags(wpClient, article.tags);

    // 6. 上傳特色圖片
    let featuredMediaId: number | undefined;
    if (article.featured_image_url) {
      featuredMediaId = await this.uploadFeaturedImage(
        wpClient,
        article.featured_image_url,
      );
    }

    // 7. 發布文章
    const wpPost = await wpClient.createPost({
      title: article.title,
      content: article.html_content || article.markdown_content,
      status: params.publishStatus,
      categories: categoryIds,
      tags: tagIds,
      featured_media: featuredMediaId,
      excerpt: article.meta_description,
    });

    // 8. 更新 SEO meta（如果網站有安裝 Rank Math）
    if (website.seo_plugin === "rankmath" && article.seo_metadata) {
      await wpClient.updateRankMathMeta(wpPost.id, {
        rank_math_title: article.seo_metadata.title,
        rank_math_description: article.seo_metadata.description,
        rank_math_focus_keyword: article.primary_keyword,
      });
    }

    // 9. 更新資料庫
    await this.supabase
      .from("generated_articles")
      .update({
        wordpress_post_id: wpPost.id,
        wordpress_post_url: wpPost.link,
        wordpress_status: wpPost.status,
        published_at: new Date().toISOString(),
        status: "published",
        published_to_website_id: params.websiteId,
      })
      .eq("id", params.articleId);

    return {
      success: true,
      wordpress_post_id: wpPost.id,
      wordpress_url: wpPost.link,
    };
  }

  private async syncCategories(
    wpClient: WordPressClient,
    categories: string[],
  ): Promise<number[]> {
    // 獲取現有分類
    const existingCategories = await wpClient.getCategories();
    const categoryMap = new Map(
      existingCategories.map((c) => [c.name.toLowerCase(), c.id]),
    );

    const categoryIds: number[] = [];

    for (const categoryName of categories) {
      const existing = categoryMap.get(categoryName.toLowerCase());
      if (existing) {
        categoryIds.push(existing);
      } else {
        // 建立新分類
        const newCategory = await wpClient.createCategory(categoryName);
        categoryIds.push(newCategory.id);
      }
    }

    return categoryIds;
  }

  private async syncTags(
    wpClient: WordPressClient,
    tags: string[],
  ): Promise<number[]> {
    // 類似 syncCategories 的邏輯
  }

  private async uploadFeaturedImage(
    wpClient: WordPressClient,
    imageUrl: string,
  ): Promise<number> {
    // 下載圖片並上傳到 WordPress
  }
}
```

### 錯誤處理策略

```typescript
try {
  const result = await publishService.publish(params);
  return { success: true, ...result };
} catch (error) {
  if (error instanceof WordPressAuthError) {
    // 認證失敗 - 通知用戶更新憑證
    return {
      error: "WordPress 認證失敗，請檢查網站設定",
      code: "AUTH_FAILED",
    };
  } else if (error instanceof WordPressNetworkError) {
    // 網路錯誤 - 可重試
    return {
      error: "WordPress 連線失敗，請稍後重試",
      code: "NETWORK_ERROR",
      retryable: true,
    };
  } else {
    // 未知錯誤 - 記錄詳細資訊
    console.error("[WordPress Publish] Unexpected error:", error);
    return {
      error: "發布失敗：" + error.message,
      code: "UNKNOWN_ERROR",
    };
  }
}
```

## 問題 2: Token 計費修復設計

### 根本問題

不同 AI 供應商返回的 token usage 格式不一致：

```typescript
// OpenAI
{
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300
  }
}

// Anthropic
{
  usage: {
    input_tokens: 100,
    output_tokens: 200
  }
}

// Deepseek (via OpenRouter)
{
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200
  }
}
```

### 解決方案：在 API Router 統一格式

修改 `api-router.ts`：

```typescript
export class APIRouter implements AIClient {
  async complete(
    prompt: string | ChatMessage[],
    options: AICompletionOptions,
  ): Promise<AICompletionResponse> {
    const response = await this.routeRequest(prompt, options);

    // 統一 usage 格式
    const normalizedUsage = this.normalizeUsage(response.usage, options.model);

    return {
      ...response,
      usage: normalizedUsage,
    };
  }

  private normalizeUsage(
    usage: any,
    model: string,
  ): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    // 如果沒有 usage 資訊，返回預估值
    if (!usage) {
      console.warn(`[APIRouter] No usage data from ${model}, using estimation`);
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    // Anthropic 格式
    if ("input_tokens" in usage && "output_tokens" in usage) {
      return {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
      };
    }

    // OpenAI / Deepseek 格式
    if ("prompt_tokens" in usage && "completion_tokens" in usage) {
      return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens:
          usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
      };
    }

    // 未知格式 - 記錄警告並返回 0
    console.error(
      "[APIRouter] Unknown usage format:",
      usage,
      "for model:",
      model,
    );
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }
}
```

### TokenBillingService 修復

添加降級處理：

```typescript
async completeWithBilling(
  aiClient: AIClient,
  companyId: string,
  userId: string,
  articleId: string | null,
  prompt: string,
  options: AICompletionOptions,
  usageType: 'article_generation' | 'title_generation' | 'image_description' | 'perplexity_analysis' = 'article_generation',
  metadata: Record<string, unknown> = {}
): Promise<BilledCompletionResult> {
  // ... 預先扣除邏輯 ...

  const response = await aiClient.complete(prompt, options)

  // 檢查 usage 是否有效
  if (!response.usage || response.usage.totalTokens === 0) {
    console.warn('[TokenBilling] Invalid usage data, using estimation')

    // 使用預估值
    const estimation = await this.calculator.estimateArticleTokens({
      wordCount: typeof prompt === 'string' ? prompt.length : 1000,
      model: options.model,
      includeImages: 0,
      includeSeo: false,
    })

    // 使用預估的 chargedTokens
    const actualCalculation = {
      chargedTokens: estimation.chargedTokens,
      officialTotalTokens: estimation.chargedTokens,
      officialInputTokens: estimation.chargedTokens / 2,
      officialOutputTokens: estimation.chargedTokens / 2,
      modelTier: 'advanced' as const,
      modelMultiplier: 2.0,
      officialCostUsd: 0,
      chargedCostUsd: 0,
    }

    // 記錄警告到日誌
    await this.supabase.from('token_usage_logs').insert({
      company_id: companyId,
      article_id: articleId,
      user_id: userId,
      model_name: options.model,
      model_tier: 'advanced',
      model_multiplier: 2.0,
      input_tokens: 0,
      output_tokens: 0,
      total_official_tokens: 0,
      charged_tokens: actualCalculation.chargedTokens,
      official_cost_usd: 0,
      charged_cost_usd: 0,
      usage_type: usageType,
      metadata: {
        ...metadata,
        warning: 'No usage data from AI provider, used estimation',
        estimation: true
      } as any,
    })
  } else {
    // 正常計費流程
    const actualCalculation = await this.calculator.calculate({
      modelName: response.model || options.model,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
    })

    // ... 扣除邏輯 ...
  }
}
```

## 問題 3: 狀態顯示設計

### ArticleStatusIcon 組件擴充

```typescript
export function ArticleStatusIcon({
  status,
  wordpressStatus,
  scheduledAt
}: {
  status: string
  wordpressStatus?: string | null
  scheduledAt?: string | null
}) {
  // 已發布到 WordPress
  if (wordpressStatus === 'publish' || status === 'published') {
    return (
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs text-red-600">已發布</span>
      </div>
    )
  }

  // 已排程
  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="text-xs text-yellow-600">已排程</span>
      </div>
    )
  }

  // 草稿
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-gray-400" />
      <span className="text-xs text-gray-600">草稿</span>
    </div>
  )
}
```

### 資料庫查詢更新

確保查詢包含 `wordpress_status`：

```typescript
const { data: articles } = await supabase.from("generated_articles").select(`
    id,
    title,
    status,
    wordpress_status,
    published_at,
    word_count,
    quality_score,
    created_at
  `);
```

## 問題 4: UI 文字大小調整

### 簡單 CSS 調整

```typescript
// 文章列表項目
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
    {/* 標題：從 text-sm 改為 text-base font-semibold */}
    <h3 className="text-base font-semibold truncate">{item.title}</h3>
    <ArticleStatusIcon status={item.status} />
  </div>

  {/* Meta 資料：從 text-[10px] 改為 text-xs */}
  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
    <span>{new Date(item.created_at).toLocaleDateString('zh-TW')}</span>
    <span>字數: {item.article.word_count || 0}</span>
    <span>品質: {item.article.quality_score}分</span>
  </div>
</div>
```

## 測試策略

### 1. WordPress 發布測試

```typescript
describe("WordPressPublishService", () => {
  it("應該成功發布文章到 WordPress", async () => {
    const result = await publishService.publish({
      articleId: "test-article-id",
      websiteId: "test-website-id",
      companyId: "test-company-id",
      publishStatus: "publish",
    });

    expect(result.success).toBe(true);
    expect(result.wordpress_post_id).toBeGreaterThan(0);
    expect(result.wordpress_url).toContain("https://");
  });

  it("應該處理認證失敗", async () => {
    // Mock 錯誤的憑證
    await expect(publishService.publish(invalidParams)).rejects.toThrow(
      "WordPress 認證失敗",
    );
  });
});
```

### 2. Token 計費測試

```typescript
describe("TokenBillingService - Usage Normalization", () => {
  it("應該處理 Anthropic 格式的 usage", async () => {
    const mockResponse = {
      content: "test",
      usage: {
        input_tokens: 100,
        output_tokens: 200,
      },
    };

    const result = await billingService.completeWithBilling(
      mockAIClient,
      companyId,
      userId,
      articleId,
      "test prompt",
      { model: "claude-3-opus" },
    );

    expect(result.billing.chargedTokens).toBeGreaterThan(0);
  });

  it("應該在沒有 usage 資料時使用預估", async () => {
    const mockResponse = {
      content: "test",
      usage: undefined, // 模擬沒有 usage
    };

    const result = await billingService.completeWithBilling(
      mockAIClient,
      companyId,
      userId,
      articleId,
      "test prompt",
      { model: "test-model" },
    );

    // 應該使用預估值，不應拋出錯誤
    expect(result.billing.chargedTokens).toBeGreaterThan(0);
  });
});
```

### 3. 狀態顯示測試

```typescript
describe('ArticleStatusIcon', () => {
  it('應該顯示紅色圓點給已發布文章', () => {
    render(<ArticleStatusIcon status="published" wordpressStatus="publish" />)

    const indicator = screen.getByText('已發布')
    expect(indicator).toHaveClass('text-red-600')
  })
})
```

## 部署策略

### 階段 1：修復 Token 計費（最高優先級）

- 部署 `api-router.ts` 的 usage 標準化
- 部署 `TokenBillingService` 的降級處理
- 驗證：觀察 `token_usage_logs` 表，確認有記錄

### 階段 2：實作 WordPress 發布

- 建立 `WordPressPublishService`
- 更新 `/api/articles/[id]/publish` route
- 驗證：手動測試發布到測試網站

### 階段 3：UI 更新

- 更新 `ArticleStatusIcon`
- 調整文章列表文字大小
- 驗證：視覺檢查

## 監控與追蹤

### 關鍵指標

1. **Token 計費成功率**：`token_usage_logs` 表的記錄數 / API 調用數
2. **WordPress 發布成功率**：`wordpress_post_id IS NOT NULL` 的比例
3. **錯誤率**：每種錯誤類型的數量

### 日誌

```typescript
// 添加詳細日誌
console.log("[TokenBilling] Charging", chargedTokens, "tokens for", model);
console.log("[WordPress] Publishing article", articleId, "to", websiteUrl);
console.log("[WordPress] Created post ID:", wpPostId, "URL:", wpUrl);
```

### Sentry 追蹤

```typescript
if (error) {
  Sentry.captureException(error, {
    tags: {
      component: "WordPressPublish",
      articleId,
      websiteId,
    },
  });
}
```
