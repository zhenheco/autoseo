# Design: 整合並標準化 AI 模型配置系統

## 系統架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)                │
├─────────────────────────────────────────────────────────────┤
│  網站設定頁面                                               │
│  ┌─────────────────────────────────────────────┐           │
│  │ AI 模型配置                                  │           │
│  │ • 複雜處理模型選擇器                         │           │
│  │ • 簡單功能模型選擇器                         │           │
│  │ • 成本預估顯示                               │           │
│  └─────────────────────────────────────────────┘           │
└──────────────────────┬──────────────────────────────────────┘
                       │ API Calls
┌──────────────────────▼──────────────────────────────────────┐
│                  Backend (Next.js API Routes)               │
├─────────────────────────────────────────────────────────────┤
│  Model Management API                                       │
│  • GET /api/ai-models (列出模型)                            │
│  • PUT /api/websites/[id]/agent-config (更新配置)          │
│                                                             │
│  Article Generation Orchestrator                           │
│  ┌─────────────────────────────────────────┐               │
│  │ 1. 載入網站模型配置                      │               │
│  │ 2. 依階段選擇模型                        │               │
│  │    • Research/Strategy → 複雜處理模型    │               │
│  │    • Writing/Category/Tag → 簡單功能模型 │               │
│  │    • Image → 固定 DALL-E 3 Mini          │               │
│  │    • Search → 固定 Perplexity            │               │
│  │ 3. 執行 Agents 並記錄使用量              │               │
│  └─────────────────────────────────────────┘               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  External Services                          │
├─────────────────────────────────────────────────────────────┤
│  OpenRouter (統一 AI API Gateway)                           │
│  • DeepSeek Models                                          │
│  • OpenAI Models                                            │
│  • Google Gemini Models                                     │
│  • Anthropic Claude Models                                  │
│                                                             │
│  Perplexity API (搜尋與研究)                                │
│  • Sonar Model                                              │
└─────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Database (Supabase/PostgreSQL)             │
├─────────────────────────────────────────────────────────────┤
│  ai_models                    agent_configs                 │
│  • model_id (PK)              • website_id (FK)             │
│  • model_name                 • complex_processing_model    │
│  • provider                   • simple_processing_model     │
│  • model_type                 • image_model                 │
│  • processing_tier ⭐         • ...                          │
│  • pricing                                                  │
│  • ...                        token_billing                 │
│                               • token_count × 2 ⭐          │
│                               • official_price              │
│                               • ...                         │
└─────────────────────────────────────────────────────────────┘
```

## 核心設計決策

### 1. 階段化模型選擇

**決策**: 將 AI 處理分為「複雜處理」和「簡單功能」兩大類，而非為每個 Agent 單獨配置模型。

**理由**:
- **簡化配置**: 使用者不需要理解每個 Agent 的差異，只需選擇兩種模型
- **成本優化**: 只在需要深度推理的階段使用昂貴模型
- **一致性**: 同類型任務使用相同模型，確保輸出風格一致
- **可擴充性**: 未來新增 Agent 時，自動歸類到相應的處理階段

**分類邏輯**:

| Agent | 處理階段 | 理由 |
|-------|---------|------|
| Research | 複雜處理 | 需要深度分析 SERP 和競爭對手 |
| Strategy | 複雜處理 | 需要制定內容策略和大綱規劃 |
| Writing | 簡單功能 | 依據大綱生成內容，相對直接 |
| Internal Links | 簡單功能 | 模式匹配和推薦任務 |
| External Links | 簡單功能 | 模式匹配和推薦任務 |
| Category | 簡單功能 | 分類任務 |
| Tag | 簡單功能 | 標籤生成任務 |
| Meta | 簡單功能 | 生成 meta 資訊 |
| Image | 固定 | 統一使用 DALL-E 3 Mini |
| Search | 固定 | 統一使用 Perplexity Sonar |

### 2. Token 計費 2x 倍數規則

**決策**: 實際使用的 token 數量 × 2 作為計費基礎，但顯示官方定價。

**理由**:
- **商業模式**: 包含平台維護、API 管理、額外功能的成本
- **使用者透明**: 顯示官方定價讓使用者了解模型本身的成本
- **內部管理**: 2x 倍數覆蓋平台運營成本

**實作方式**:
```typescript
// 官方定價 (每 1M tokens)
const officialPrice = {
  input: 0.55,   // $0.55 per 1M tokens
  output: 2.19   // $2.19 per 1M tokens
};

// 實際計費
const actualTokens = usage.input_tokens * 2;  // 2x 倍數
const cost = (actualTokens * officialPrice.input) / 1_000_000;

// 儲存記錄
await db.insert({
  raw_tokens: usage.input_tokens,       // 實際 API 返回的 tokens
  billable_tokens: actualTokens,        // 計費 tokens (2x)
  official_price: officialPrice.input,  // 官方定價
  total_cost: cost                      // 總成本
});
```

**顯示給使用者**:
```
使用量: 1,000 tokens
定價: $0.55 / 1M tokens (官方定價)
成本: $0.0011

註: 實際計費包含平台服務費用 (2x tokens)
```

### 3. 模型 Fallback 機制

**決策**: 當主要模型不可用時，自動降級到備用模型。

**Fallback 鏈**:

```
複雜處理:
deepseek-reasoner → claude-sonnet-4.5 → gpt-4o → gemini-2.5-pro

簡單功能:
deepseek-chat → gpt-4o-mini → gemini-2.0-flash → claude-sonnet-4.5

圖片:
dall-e-3-mini → dall-e-3 → dall-e-2

搜尋:
perplexity-sonar → (無 fallback，返回錯誤)
```

**實作**:
```typescript
async function executeWithFallback(
  primaryModel: string,
  fallbackChain: string[],
  input: AgentInput
): Promise<AgentOutput> {
  const models = [primaryModel, ...fallbackChain];

  for (const model of models) {
    try {
      return await executeAgent(model, input);
    } catch (error) {
      console.warn(`模型 ${model} 失敗，嘗試下一個...`, error);
      if (model === models[models.length - 1]) {
        throw new Error('所有模型都失敗');
      }
    }
  }
}
```

### 4. Perplexity 整合策略

**決策**: Perplexity 作為唯一的即時搜尋和資料來源，所有研究階段必須使用。

**理由**:
- **即時資料**: Perplexity 提供最新的網路搜尋結果
- **引用來源**: 自動提供可驗證的資料來源
- **專業搜尋**: 針對深度研究優化的 AI 模型
- **成本效益**: 統一搜尋來源避免多個 API 的管理成本

**使用方式**:

```typescript
// Research Agent
async execute(input: ResearchInput) {
  // 1. 使用 Perplexity 進行關鍵字研究
  const serpAnalysis = await perplexity.search(
    `分析關鍵字「${input.keyword}」的 SERP 結果和競爭對手`
  );

  // 2. 使用配置的複雜處理模型分析資料
  const analysis = await aiClient.complete({
    model: input.model, // complex_processing_model
    prompt: `根據以下搜尋結果分析...${serpAnalysis.content}`
  });

  return {
    analysis,
    sources: serpAnalysis.citations
  };
}

// Strategy Agent
async execute(input: StrategyInput) {
  // 使用 Perplexity 獲取最新趨勢
  const trends = await perplexity.getTrends(input.keyword);

  // 使用複雜處理模型制定策略
  const strategy = await aiClient.complete({
    model: input.model,
    prompt: `根據趨勢制定內容策略...${trends}`
  });

  return strategy;
}
```

**快取策略**:
```typescript
// 避免重複查詢相同關鍵字
const CACHE_TTL = 3600; // 1 小時

async function cachedPerplexitySearch(query: string) {
  const cacheKey = `perplexity:${hashQuery(query)}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await perplexity.search(query);
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

  return result;
}
```

## 資料模型設計

### ai_models 表

```sql
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('text', 'image')),

  -- 新增: 處理階段分類
  processing_tier TEXT CHECK (processing_tier IN ('complex', 'simple', 'both', 'fixed')),

  -- 定價資訊 (官方定價)
  pricing JSONB DEFAULT '{
    "input_per_1m": 0,
    "output_per_1m": 0
  }'::jsonb,

  -- 能力標籤
  capabilities JSONB DEFAULT '[]'::jsonb,

  -- 模型限制
  context_window INTEGER,
  max_tokens INTEGER,

  -- 狀態
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 範例資料
INSERT INTO ai_models (provider, model_id, model_name, model_type, processing_tier, pricing) VALUES
  ('deepseek', 'deepseek/deepseek-reasoner', 'DeepSeek Reasoner', 'text', 'complex',
   '{"input_per_1m": 0.55, "output_per_1m": 2.19}'::jsonb),

  ('deepseek', 'deepseek/deepseek-chat', 'DeepSeek Chat', 'text', 'simple',
   '{"input_per_1m": 0.14, "output_per_1m": 0.28}'::jsonb),

  ('openai', 'openai/gpt-4o', 'GPT-4o', 'text', 'both',
   '{"input_per_1m": 2.50, "output_per_1m": 10.00}'::jsonb),

  ('openai', 'openai/gpt-4o-mini', 'GPT-4o Mini', 'text', 'simple',
   '{"input_per_1m": 0.15, "output_per_1m": 0.60}'::jsonb),

  ('google', 'google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'text', 'complex',
   '{"input_per_1m": 1.25, "output_per_1m": 5.00}'::jsonb),

  ('google', 'google/gemini-2.0-flash', 'Gemini 2.0 Flash', 'text', 'simple',
   '{"input_per_1m": 0.075, "output_per_1m": 0.30}'::jsonb),

  ('anthropic', 'anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 'text', 'both',
   '{"input_per_1m": 3.00, "output_per_1m": 15.00}'::jsonb),

  ('openai', 'openai/dall-e-3', 'DALL-E 3', 'image', 'fixed',
   '{"standard_1024": 0.04, "hd_1024": 0.08}'::jsonb);
```

### agent_configs 表

```sql
ALTER TABLE agent_configs
  -- 新的階段化配置
  ADD COLUMN complex_processing_model TEXT DEFAULT 'deepseek/deepseek-reasoner',
  ADD COLUMN simple_processing_model TEXT DEFAULT 'deepseek/deepseek-chat',

  -- 保留舊欄位以維持向後相容
  -- research_model, strategy_model, writing_model 等仍然存在
  -- 新邏輯會優先使用新欄位，如果為 NULL 則使用舊欄位

  -- 圖片模型 (固定)
  ADD COLUMN image_model TEXT DEFAULT 'openai/dall-e-3',

  -- 搜尋來源 (固定)
  ADD COLUMN search_provider TEXT DEFAULT 'perplexity-sonar';

-- Migration 腳本: 將舊配置遷移到新欄位
UPDATE agent_configs SET
  complex_processing_model = COALESCE(research_model, 'deepseek/deepseek-reasoner'),
  simple_processing_model = COALESCE(writing_model, 'deepseek/deepseek-chat');
```

### token_billing_records 表

```sql
CREATE TABLE token_billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_job_id UUID NOT NULL REFERENCES article_jobs(id),
  agent_name TEXT NOT NULL,
  model_id TEXT NOT NULL,

  -- Token 數量
  raw_input_tokens INTEGER NOT NULL,        -- API 返回的實際 tokens
  raw_output_tokens INTEGER NOT NULL,
  billable_input_tokens INTEGER NOT NULL,   -- 計費 tokens (raw × 2)
  billable_output_tokens INTEGER NOT NULL,

  -- 定價和成本
  official_input_price DECIMAL(10, 6),      -- 每 1M tokens 的官方價格
  official_output_price DECIMAL(10, 6),
  multiplier DECIMAL(3, 1) DEFAULT 2.0,     -- 固定 2.0
  total_cost DECIMAL(10, 6),                -- 總成本

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 範例記錄
INSERT INTO token_billing_records VALUES (
  gen_random_uuid(),
  'article-job-uuid',
  'research',
  'deepseek/deepseek-reasoner',
  1000,   -- raw_input_tokens
  2000,   -- raw_output_tokens
  2000,   -- billable_input_tokens (1000 × 2)
  4000,   -- billable_output_tokens (2000 × 2)
  0.55,   -- official_input_price ($0.55 per 1M)
  2.19,   -- official_output_price ($2.19 per 1M)
  2.0,    -- multiplier
  (2000 * 0.55 / 1000000) + (4000 * 2.19 / 1000000) -- total_cost
);
```

## API 設計

### GET /api/ai-models

列出所有可用的 AI 模型，支援依處理階段過濾。

**Query Parameters**:
- `tier`: `complex` | `simple` | `both` | `fixed`
- `type`: `text` | `image`

**Response**:
```json
{
  "models": [
    {
      "id": "uuid",
      "model_id": "deepseek/deepseek-reasoner",
      "model_name": "DeepSeek Reasoner",
      "provider": "deepseek",
      "model_type": "text",
      "processing_tier": "complex",
      "pricing": {
        "input_per_1m": 0.55,
        "output_per_1m": 2.19
      },
      "capabilities": ["reasoning", "analysis"],
      "context_window": 32768,
      "is_recommended": true
    }
  ]
}
```

### PUT /api/websites/[id]/agent-config

更新網站的 AI 模型配置。

**Request Body**:
```json
{
  "complex_processing_model": "deepseek/deepseek-reasoner",
  "simple_processing_model": "deepseek/deepseek-chat",
  "image_model": "openai/dall-e-3"
}
```

**Response**:
```json
{
  "success": true,
  "config": {
    "website_id": "uuid",
    "complex_processing_model": "deepseek/deepseek-reasoner",
    "simple_processing_model": "deepseek/deepseek-chat",
    "image_model": "openai/dall-e-3",
    "search_provider": "perplexity-sonar"
  }
}
```

### GET /api/billing/estimate

預估文章生成的成本。

**Query Parameters**:
- `website_id`: UUID
- `word_count`: 目標字數

**Response**:
```json
{
  "estimate": {
    "complex_processing": {
      "model": "deepseek/deepseek-reasoner",
      "estimated_tokens": 4000,
      "billable_tokens": 8000,
      "cost": 0.0044
    },
    "simple_processing": {
      "model": "deepseek/deepseek-chat",
      "estimated_tokens": 10000,
      "billable_tokens": 20000,
      "cost": 0.0028
    },
    "image_generation": {
      "model": "dall-e-3",
      "count": 3,
      "cost": 0.12
    },
    "total_estimated_cost": 0.1272,
    "note": "實際成本可能因內容複雜度而有所不同，計費包含 2x token 倍數"
  }
}
```

## 安全性考量

### 1. API Key 管理
- 所有 AI 模型的 API Key 儲存在環境變數
- 使用 Supabase Vault 加密敏感資訊
- 定期輪換 API Keys

### 2. 速率限制
```typescript
// 每個網站每小時最多 10 次文章生成
const rateLimit = {
  max: 10,
  window: 3600 * 1000 // 1 hour
};
```

### 3. 成本控制
```typescript
// 單次文章生成的最大成本限制
const MAX_COST_PER_ARTICLE = 1.0; // $1.00

async function validateCost(estimatedCost: number) {
  if (estimatedCost > MAX_COST_PER_ARTICLE) {
    throw new Error(`預估成本 $${estimatedCost} 超過限制 $${MAX_COST_PER_ARTICLE}`);
  }
}
```

## 效能優化

### 1. 模型列表快取
```typescript
// 快取模型列表 1 小時
const CACHE_TTL = 3600;

async function getModels() {
  const cached = await redis.get('ai_models:list');
  if (cached) return JSON.parse(cached);

  const models = await db.select().from('ai_models');
  await redis.setex('ai_models:list', CACHE_TTL, JSON.stringify(models));

  return models;
}
```

### 2. Perplexity 搜尋快取
```typescript
// 相同關鍵字的搜尋結果快取 1 小時
async function cachedSearch(keyword: string) {
  const key = `perplexity:search:${hashKeyword(keyword)}`;
  // ... 實作如上
}
```

### 3. 平行處理
```typescript
// 可以平行執行的 Agents
const [writing, category, tags, meta] = await Promise.all([
  writingAgent.execute({ model: simpleModel }),
  categoryAgent.execute({ model: simpleModel }),
  tagAgent.execute({ model: simpleModel }),
  metaAgent.execute({ model: simpleModel })
]);
```

## 監控與告警

### 1. 模型可用性監控
```typescript
// 每 5 分鐘檢查模型狀態
setInterval(async () => {
  const models = await getActiveModels();

  for (const model of models) {
    try {
      await testModelAvailability(model.model_id);
    } catch (error) {
      await alertModelDown(model.model_id, error);
    }
  }
}, 5 * 60 * 1000);
```

### 2. 成本追蹤
```typescript
// 每日成本報告
async function generateDailyCostReport() {
  const costs = await db
    .select()
    .from('token_billing_records')
    .where('created_at', '>', new Date(Date.now() - 24 * 3600 * 1000));

  const total = costs.reduce((sum, r) => sum + r.total_cost, 0);

  if (total > DAILY_COST_THRESHOLD) {
    await alertHighCost(total);
  }
}
```

### 3. 品質監控
```typescript
// 追蹤失敗率
async function trackFailureRate() {
  const executions = await db
    .select()
    .from('agent_executions')
    .where('created_at', '>', new Date(Date.now() - 3600 * 1000));

  const failureRate = executions.filter(e => e.status === 'failed').length / executions.length;

  if (failureRate > 0.1) { // 10%
    await alertHighFailureRate(failureRate);
  }
}
```

## 未來擴充性

### 1. 支援更多模型提供商
- 直接整合 OpenAI API (不透過 OpenRouter)
- 支援 Mistral、Cohere 等其他提供商
- 支援本地部署的開源模型

### 2. 動態模型選擇
```typescript
// 根據任務複雜度自動選擇模型
async function selectModelByComplexity(task: Task) {
  const complexity = await analyzeComplexity(task);

  if (complexity > 0.8) {
    return 'claude-sonnet-4.5'; // 最強模型
  } else if (complexity > 0.5) {
    return 'gpt-4o'; // 中階模型
  } else {
    return 'deepseek-chat'; // 經濟模型
  }
}
```

### 3. A/B 測試
```typescript
// 比較不同模型的效果
async function runABTest(keyword: string) {
  const [articleA, articleB] = await Promise.all([
    generateArticle({ model: 'gpt-4o' }),
    generateArticle({ model: 'claude-sonnet-4.5' })
  ]);

  return {
    gpt4o: await evaluateQuality(articleA),
    claude: await evaluateQuality(articleB)
  };
}
```
