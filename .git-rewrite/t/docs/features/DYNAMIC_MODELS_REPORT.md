# 動態模型系統實作報告

## 問題分析

原本的實作將模型 ID 寫死在程式碼中，這會導致：

1. 新模型發布時需要修改程式碼
2. 模型棄用時無法動態調整
3. 無法靈活管理模型定價和參數
4. 前端無法動態獲取可用模型列表

## 解決方案

實作動態模型配置系統，類似 N8N 的做法，透過資料庫和 API 管理所有 AI 模型。

## 實作內容

### 1. 資料庫 Schema

#### 新增資料表: `ai_models`

```sql
CREATE TABLE ai_models (
  id UUID PRIMARY KEY,
  provider ai_provider NOT NULL,     -- openai, anthropic, deepseek, perplexity, nano
  model_id TEXT NOT NULL,             -- 模型 ID (如 gpt-4, claude-3-opus)
  model_name TEXT NOT NULL,           -- 顯示名稱
  model_type ai_model_type NOT NULL,  -- text, image, embedding
  description TEXT,                    -- 描述

  capabilities JSONB,                  -- 能力標籤
  pricing JSONB,                       -- 定價資訊

  context_window INTEGER,              -- 上下文視窗
  max_tokens INTEGER,                  -- 最大 tokens
  supports_streaming BOOLEAN,          -- 支援串流
  supports_json_mode BOOLEAN,          -- 支援 JSON 模式
  supports_function_calling BOOLEAN,   -- 支援函數呼叫

  image_sizes TEXT[],                  -- 圖片尺寸選項
  image_quality_options TEXT[],        -- 圖片品質選項

  is_active BOOLEAN,                   -- 是否啟用
  is_deprecated BOOLEAN,               -- 是否棄用
  deprecated_at TIMESTAMPTZ,           -- 棄用時間
  replacement_model_id UUID,           -- 替代模型

  release_date DATE,                   -- 發布日期
  version TEXT,                        -- 版本
  tags TEXT[],                         -- 標籤

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 預設模型資料

已預先插入以下模型：

**OpenAI Text:**

- gpt-4-turbo (推薦)
- gpt-4
- gpt-3.5-turbo (經濟)

**Anthropic:**

- claude-3-opus-20240229 (強大)
- claude-3-sonnet-20240229 (平衡, 推薦)
- claude-3-haiku-20240307 (快速)

**DeepSeek:**

- deepseek-chat (中文優化)
- deepseek-coder (程式設計)

**Perplexity:**

- sonar (搜尋)
- sonar-pro (進階搜尋)

**OpenAI Image:**

- dall-e-3 (推薦, 高品質)
- dall-e-2 (經濟)
- chatgpt-image-mini (快速)

**Nano:**

- nano-banana (超經濟)

### 2. 輔助函數

```sql
-- 取得所有活躍的文字模型
get_active_text_models()

-- 取得所有活躍的圖片模型
get_active_image_models()

-- 依 provider 取得模型
get_models_by_provider(provider)
```

### 3. API Endpoints

#### GET `/api/ai-models`

取得所有模型列表

- Query params:
  - `type`: text | image | embedding
  - `provider`: openai | anthropic | deepseek | perplexity | nano

#### GET `/api/ai-models/text`

取得所有文字模型（依 provider 分組）

#### GET `/api/ai-models/image`

取得所有圖片模型（依 provider 分組）

#### POST `/api/ai-models`

新增模型（管理員）

#### PATCH `/api/ai-models`

更新模型（管理員）

### 4. AI Client 更新

更新 `getProvider()` 方法，改為更靈活的模式匹配：

```typescript
private getProvider(model: string): 'openai' | 'anthropic' | 'deepseek' | 'perplexity' {
  if (model.startsWith('gpt-') || model.startsWith('dall-e-') || model.includes('chatgpt')) {
    return 'openai';
  }
  if (model.startsWith('claude-')) {
    return 'anthropic';
  }
  if (model.startsWith('deepseek-')) {
    return 'deepseek';
  }
  if (model.startsWith('perplexity-') || model.startsWith('sonar')) {
    return 'perplexity';
  }
  return 'openai';
}
```

## 使用方式

### 前端獲取模型列表

```typescript
// 取得所有文字模型
const response = await fetch('/api/ai-models/text');
const { models, groupedByProvider } = await response.json();

// groupedByProvider 結構:
{
  "openai": [
    {
      "id": "uuid",
      "modelId": "gpt-4-turbo",
      "modelName": "GPT-4 Turbo",
      "description": "...",
      "capabilities": ["reasoning", "analysis"],
      "pricing": { "input": 0.01, "output": 0.03 },
      "contextWindow": 128000,
      "maxTokens": 4096,
      "tags": ["recommended", "latest"]
    }
  ],
  "anthropic": [...],
  ...
}
```

### 前端選擇模型

```jsx
<Select>
  <optgroup label="OpenAI">
    {groupedByProvider.openai.map((model) => (
      <option value={model.modelId}>
        {model.modelName}
        {model.tags.includes("recommended") && " ⭐"}
        {model.tags.includes("economical") && " 💰"}
      </option>
    ))}
  </optgroup>
  <optgroup label="Anthropic">
    {groupedByProvider.anthropic.map((model) => (
      <option value={model.modelId}>{model.modelName}</option>
    ))}
  </optgroup>
</Select>
```

### 新增新模型

```typescript
await fetch("/api/ai-models", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "openai",
    model_id: "gpt-5",
    model_name: "GPT-5",
    model_type: "text",
    description: "最新的 GPT-5 模型",
    capabilities: ["reasoning", "multimodal"],
    pricing: { input: 0.02, output: 0.04, currency: "USD", per: 1000 },
    context_window: 200000,
    max_tokens: 8192,
    supports_streaming: true,
    supports_json_mode: true,
    supports_function_calling: true,
    is_active: true,
    tags: ["latest", "powerful"],
  }),
});
```

### 棄用舊模型

```typescript
await fetch("/api/ai-models", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "model-uuid",
    is_deprecated: true,
    deprecated_at: new Date().toISOString(),
    replacement_model_id: "new-model-uuid",
  }),
});
```

## 優勢

### 1. 動態更新

- 新模型發布時只需在資料庫新增，無需修改程式碼
- 模型參數變更可即時生效

### 2. 靈活管理

- 可隨時啟用/停用模型
- 可標記棄用並指定替代模型
- 可調整定價和參數限制

### 3. 前端友善

- API 返回結構化數據
- 支援依 provider 分組
- 包含標籤（推薦、經濟、最新等）
- 可顯示定價資訊協助用戶選擇

### 4. 成本透明

- 每個模型都有明確的定價資訊
- 可計算預估成本
- 可依成本篩選模型

### 5. 版本管理

- 記錄模型發布日期和版本
- 可追蹤模型演進歷史
- 棄用模型不會立即移除，保持向後相容

## 檔案清單

- `supabase/migrations/20251026000002_ai_model_configs.sql` - 資料庫 schema
- `src/app/api/ai-models/route.ts` - 主要 API
- `src/app/api/ai-models/text/route.ts` - 文字模型 API
- `src/app/api/ai-models/image/route.ts` - 圖片模型 API
- `src/lib/ai/ai-client.ts` - 更新的 AI Client

## 下一步

1. 建立前端模型選擇器 UI 元件
2. 實作模型管理介面（管理員）
3. 新增模型使用統計
4. 實作成本追蹤和預警

## TypeScript 型別檢查

✅ 所有檔案通過型別檢查
