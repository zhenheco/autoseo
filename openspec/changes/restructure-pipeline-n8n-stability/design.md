## Context

文章生成使用 multi-agent 架構，目前存在：

- 15+ 個獨立 Agent，維護困難
- 資料傳遞依賴隱式參數，容易遺失
- 過度平行化導致失敗率高
- 缺乏中間驗證機制

用戶提供的 N8N 工作流程已穩定運行多時，採用線性順序執行模式，值得借鏡。

## Goals / Non-Goals

### Goals

- 提升 pipeline 穩定性，減少 fallback 到 legacy 模式的情況
- 簡化 Agent 數量，從 15+ 降至 8-10 個
- 確保 industry/region/language 等資訊正確傳遞
- 建立統一的 JSON 解析機制
- 增加 Quality Gate 驗證機制
- 保持現有圖片生成配置（Gemini 精選圖 + GPT 配圖）

### Non-Goals

- 不改變 WordPress 發布邏輯
- 不改變 Token 計費架構
- 不改變 GitHub Actions 觸發機制
- 不重寫 AI Client 基礎架構

## Decisions

### Decision 1: 流程執行模式

- **選擇**: 採用線性順序執行為主，僅在圖片生成步驟使用平行執行
- **原因**: N8N 流程證明線性執行更穩定，圖片生成互不依賴可並行
- **替代方案**:
  - 完全平行化 → 失敗率高，難以追蹤
  - 完全線性化 → 執行時間過長

### Decision 2: Context 管理

- **選擇**: 建立 `PipelineContext` 類別，作為所有 Agent 的共享狀態
- **原因**: 解決資料傳遞斷層問題，型別安全
- **結構**:

  ```typescript
  interface PipelineContext {
    // 輸入參數
    keyword: string;
    targetLanguage: string;
    industry?: string;
    region?: string;
    targetWordCount: number;

    // 品牌資訊
    brandVoice: BrandVoice;
    websiteSettings: WebsiteSettings;

    // 流程狀態
    currentPhase: PipelinePhase;
    completedPhases: PipelinePhase[];

    // Agent 輸出（逐步填充）
    research?: ResearchOutput;
    strategy?: StrategyOutput;
    content?: ContentOutput;
    html?: string;
    meta?: MetaOutput;
    images?: ImageOutput[];

    // 錯誤追蹤
    errors: PipelineError[];
    warnings: PipelineWarning[];
  }
  ```

### Decision 3: Agent 整合策略

- **選擇**: 合併功能相近的 Agent
- **整合方案**:

  | 現有 Agent                                                   | 整合後                            |
  | ------------------------------------------------------------ | --------------------------------- |
  | StrategyAgent + ContentPlanAgent                             | StrategyAgent（負責策略+大綱）    |
  | IntroductionAgent + SectionAgent + ConclusionAgent + QAAgent | WritingAgent（負責所有寫作）      |
  | HTMLAgent + 部分格式化邏輯                                   | HTMLAgent（簡化，專注 HTML 轉換） |

- **保留獨立**:
  - ResearchAgent（研究階段，增加 referenceMapping 輸出）
  - CompetitorAnalysisAgent（競品分析）
  - ImageAgent（圖片生成：Gemini Flash 2.5 精選圖 + GPT Image 1 Mini 配圖）
  - MetaAgent（SEO Meta + SlugValidator）
  - CategoryAgent（分類選擇，移到發佈前執行）
  - LinkEnrichmentAgent（內外部連結處理）
  - PublishAgent（發布）
  - QualityGateAgent（新增，質檢）

### Decision 5: 外部連結處理

- **選擇**: 三階段處理外部連結
- **流程**:
  1. **ResearchAgent**: 收集 externalReferences + 生成 referenceMapping（標記哪些引用適合哪個段落）
  2. **WritingAgent**: 在寫作時引用來源，輸出帶標記 [REF:url] 的 Markdown
  3. **LinkEnrichmentAgent**: 將標記轉換為真實超連結，設定正確 rel 屬性
- **SEO 考量**:
  - 權威來源（.edu, .gov, 官方文檔）不加 nofollow
  - 一般來源加 nofollow
  - 所有外部連結加 noopener noreferrer
  - 競爭對手網站不加入連結

### Decision 6: 內部連結處理

- **選擇**: LinkEnrichmentAgent 主動查詢資料庫
- **取代**: 原本依賴 previousArticles 參數傳入（類似 N8N 用 Google Sheet）
- **查詢邏輯**:
  ```sql
  SELECT id, title, slug, keyword, html_content
  FROM generated_articles
  WHERE website_id = $1
    AND status = 'published'
    AND id != $2
  ORDER BY created_at DESC
  LIMIT 20;
  ```
- **處理流程**:
  1. 查詢同網站已發布文章（最近 20 篇）
  2. AI 分析當前文章與這些文章的關聯性
  3. 選擇 2-3 篇最相關的文章
  4. 在適當位置插入內部連結

### Decision 7: CategoryAgent 執行時機

- **選擇**: 移到發佈階段前執行
- **原因**: 沒有確定發佈網站時無法查詢 WordPress 分類表
- **流程**:
  1. 查詢目標 WordPress 網站的現有分類和標籤
  2. AI 從現有選項中選擇最適合的
  3. 不創建新分類（避免分類混亂）
- **非發佈場景**: 如果只是生成文章不發佈，跳過 CategoryAgent

### Decision 4: JSON 解析統一

- **選擇**: 建立 `AIResponseParser` 類別，統一處理所有 AI 輸出
- **原因**: 各 Agent 的 JSON 解析邏輯重複且不一致
- **功能**:

  ```typescript
  class AIResponseParser {
    // 嘗試多種解析策略
    parse<T>(content: string, schema: z.ZodSchema<T>): T | null;

    // 清理 AI 輸出（移除 markdown 包裝、思考過程等）
    cleanContent(content: string): string;

    // 提取 JSON 區塊
    extractJSON(content: string): string | null;

    // 驗證輸出格式
    validate<T>(data: unknown, schema: z.ZodSchema<T>): T;
  }
  ```

### Decision 5: Quality Gate 機制

- **選擇**: 在關鍵步驟後增加驗證節點
- **驗證點**:
  1. 研究完成後：驗證 research output 完整性
  2. 策略完成後：驗證大綱結構合理性
  3. 寫作完成後：驗證字數、格式、關鍵字密度
  4. HTML 轉換後：驗證 HTML 結構完整性
- **失敗處理**:
  - 輕微問題：記錄 warning，繼續執行
  - 嚴重問題：回退重試該步驟（最多 2 次）
  - 致命問題：標記失敗，等待人工介入

### Decision 8: 重試策略

- **選擇**: 統一重試配置，採用指數退避
- **配置**:
  ```typescript
  const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "rate_limit_exceeded",
      "model_overloaded",
      "fetch failed",
      "network error",
      "socket hang up",
    ],
  };
  ```

### Decision 9: Pipeline 完整流程順序

- **選擇**: 明確定義完整的 Agent 執行順序
- **流程**:
  ```
  Research → CompetitorAnalysis → Strategy → Writing → LinkEnrichment → HTML → Meta → Image → Category → Publish
  ```
- **說明**:
  - CompetitorAnalysisAgent 在 Research 後、Strategy 前執行（提供差異化分析）
  - CategoryAgent 在 Publish 前執行（需要查詢 WordPress）
  - Image 階段內部平行執行（FeaturedImage + ContentImages）

### Decision 10: LinkEnrichmentAgent 輸出格式

- **選擇**: LinkEnrichmentAgent 輸出 **Markdown 格式**
- **原因**: 保持 HTMLAgent 職責單一（統一 Markdown → HTML 轉換）
- **處理**:
  - 外部連結：`[REF:url]` → `[anchor text](url){:target="_blank" rel="noopener noreferrer nofollow"}`
  - 內部連結：插入 `[相關文章標題](/slug)` 格式
  - HTMLAgent 負責將 Markdown 連結轉為 HTML `<a>` 標籤

### Decision 11: Checkpoint 版本控制

- **選擇**: 增加 `checkpoint_version` 欄位
- **版本**: 每次 Pipeline 結構變更時遞增版本號
- **處理**:

  ```typescript
  const CHECKPOINT_VERSION = 2; // 每次 Pipeline 結構變更時遞增

  if (savedCheckpoint.version !== CHECKPOINT_VERSION) {
    console.warn("Checkpoint version mismatch, starting from scratch");
    return null; // 重新執行
  }
  ```

### Decision 12: 內部連結新網站處理

- **選擇**: 無已發布文章時跳過內部連結處理
- **邏輯**:
  ```typescript
  const internalArticles = await queryInternalArticles(websiteId);
  if (internalArticles.length === 0) {
    console.log("No published articles, skipping internal links");
    return content; // 直接返回原內容
  }
  ```

### Decision 13: Idempotency 增強

- **選擇**: 增加時間窗口 + 強制重新生成選項
- **參數**:
  ```typescript
  interface IdempotencyConfig {
    timeWindowDays: 30; // 30 天內算重複
    forceRegenerate?: boolean; // 強制重新生成
  }
  ```
- **關鍵字正規化**:
  ```typescript
  function normalizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .replace(/\s+/g, "") // 移除空格
      .trim();
  }
  ```

### Decision 14: 外部連結品質控制

- **選擇**: 增加死鏈檢測 + 數量限制
- **死鏈檢測**:
  ```typescript
  async function checkUrlAlive(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: "HEAD", timeout: 5000 });
      return response.ok;
    } catch {
      return false;
    }
  }
  ```
- **數量限制**: 每篇文章最多 **8 個外部連結**
- **競爭對手過濾**: 從 `WebsiteSettings.competitor_domains` 讀取

### Decision 15: QualityGate 具體閾值

- **選擇**: 定義明確的品質門檻
- **閾值配置**:
  ```typescript
  const QUALITY_THRESHOLDS = {
    keywordDensity: { min: 0.5, max: 2.5 }, // 百分比
    wordCount: {
      min: 800,
      max: 5000,
      // CJK: 使用字元數，Latin: 使用單詞數
    },
    h2Count: { min: 3, max: 10 },
    imageCount: { min: 1, max: 8 },
  };
  ```
- **CJK 字數計算**:
  ```typescript
  function countWords(text: string, language: string): number {
    if (["zh-TW", "zh-CN", "ja", "ko"].includes(language)) {
      return text.replace(/\s/g, "").length; // 字元數
    }
    return text.split(/\s+/).filter(Boolean).length; // 單詞數
  }
  ```

### Decision 16: 圖片儲存流程

- **選擇**: 圖片先存 Supabase，發布時再上傳 WordPress
- **流程**:
  1. ImageAgent 生成圖片 → 上傳 Supabase Storage
  2. 儲存 Supabase URL 到 `generated_articles.images`
  3. PublishAgent 發布時 → 下載圖片 → 上傳 WordPress Media Library
  4. 上傳失敗 → 記錄 warning，使用 Supabase URL 作為 fallback

### Decision 17: Checkpoint 清理機制

- **選擇**: 定期清理過期 checkpoint
- **策略**:
  - 保留期限：30 天
  - 清理時機：GitHub Actions cron job（每天執行）
  - 清理條件：`last_checkpoint < NOW() - INTERVAL '30 days'`

### Decision 18: GitHub Actions 並發控制

- **選擇**: 使用資料庫鎖避免重複處理
- **實作**:
  ```sql
  UPDATE article_jobs
  SET started_at = NOW(), worker_id = $1
  WHERE id = (
    SELECT id FROM article_jobs
    WHERE status = 'pending'
      AND (started_at IS NULL OR started_at < NOW() - INTERVAL '3 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
  ```

### Decision 19: 監控指標

- **選擇**: 定義關鍵 metrics 供監控使用
- **指標**:

  ```typescript
  const METRICS = {
    // 成功率
    "pipeline.success.rate": "Counter",
    "pipeline.failure.rate": "Counter",

    // 階段時間
    "phase.research.duration": "Histogram",
    "phase.writing.duration": "Histogram",
    "phase.total.duration": "Histogram",

    // Checkpoint
    "checkpoint.resume.count": "Counter",
    "checkpoint.version_mismatch.count": "Counter",

    // Quality Gate
    "quality.pass.count": "Counter",
    "quality.fail.count": "Counter",
  };
  ```

### Decision 20: BrandVoice 預設值

- **選擇**: 未設定 BrandVoice 時使用預設模板
- **預設值**:
  ```typescript
  const DEFAULT_BRAND_VOICE: BrandVoice = {
    brand_name: websiteSettings.name || "Our Brand",
    tone: "professional",
    style: "informative",
    target_audience: "general audience",
    writing_guidelines: [],
    avoid_phrases: [],
  };
  ```

### Decision 21: 快取策略

- **選擇**: 對頻繁查詢的資料增加短期快取
- **快取項目**:
  | 資料 | TTL | 快取位置 |
  |------|-----|----------|
  | WordPress categories/tags | 5 分鐘 | Memory |
  | Internal articles list | 5 分鐘 | Memory |
  | Website settings | 10 分鐘 | Memory |
- **實作**: 使用 `Map` + TTL 或 `lru-cache` 套件

## Risks / Trade-offs

| Risk                          | Mitigation                               |
| ----------------------------- | ---------------------------------------- |
| 重構範圍大，可能引入新 bug    | 分階段實施，每階段獨立測試               |
| 線性執行增加總時間            | 僅圖片生成保持並行，其他步驟時間影響有限 |
| Agent 合併可能遺失功能        | 建立完整的功能對照表，確保覆蓋           |
| 新的 Context 機制需要學習成本 | 提供清晰的文檔和範例                     |

## Migration Plan

### Phase 1: 基礎設施（Week 1）

1. 建立 `PipelineContext` 類別
2. 建立 `AIResponseParser` 類別
3. 更新 `orchestrator.ts` 使用新的 Context

### Phase 2: Agent 整合（Week 2）

1. 合併 StrategyAgent + ContentPlanAgent
2. 合併 WritingAgent（含 Introduction/Section/Conclusion/QA）
3. 更新相關型別定義

### Phase 3: 質檢機制（Week 3）

1. 實作 QualityGateAgent
2. 在 orchestrator 中加入驗證點
3. 實作重試邏輯

### Phase 4: 測試與優化（Week 4）

1. 端到端測試
2. 效能優化
3. 文檔更新

## Open Questions

1. **Checkpoint 機制**：是否需要支援從中間步驟恢復？（建議 Phase 2 後評估）
2. **Model 選擇策略**：是否要像 N8N 那樣對不同步驟使用不同模型？（建議獨立 proposal）
3. **內部連結強化**：LinkEnrichmentAgent 是否需要參考 N8N 的邏輯重寫？（建議獨立 proposal）
