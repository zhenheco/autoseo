# 最終模型清單與驗證結果

## 驗證日期
2025-11-04 (更新)

## ✅ 所有模型驗證通過 (9/9 - 100%)

| 模型 ID | 名稱 | Provider | Tier | 回應時間 | 狀態 |
|---------|------|----------|------|----------|------|
| `deepseek/deepseek-r1` | DeepSeek R1 | OpenRouter | Complex | 1061ms | ✅ |
| `deepseek/deepseek-chat` | DeepSeek Chat | OpenRouter | Simple | 1603ms | ✅ |
| `openai/gpt-5` | GPT-5 | OpenRouter | Complex | 656ms | ✅ |
| `openai/gpt-5-mini` | GPT-5 Mini | OpenRouter | Simple | 892ms | ✅ |
| `openai/gpt-4o` | GPT-4o | OpenRouter | Both | 1014ms | ✅ |
| `openai/gpt-4o-mini` | GPT-4o Mini | OpenRouter | Simple | 806ms | ✅ |
| `google/gemini-2.5-pro` | Gemini 2.5 Pro | OpenRouter | Complex | 2904ms | ✅ |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash | OpenRouter | Complex | 690ms | ✅ |
| `anthropic/claude-sonnet-4.5` | Claude Sonnet 4.5 | OpenRouter | Both | 2119ms | ✅ |

## API 策略

### 文字處理
**DeepSeek 官方 API** (主要模型):
- `deepseek-reasoner` - 複雜處理
- `deepseek-chat` - 簡單功能

**OpenRouter** (fallback 鏈):
- Complex: gpt-5 → gpt-4o → gemini-2.5-pro → gemini-2.5-flash → claude-sonnet-4.5
- Simple: gpt-5-mini → gpt-4o-mini → gpt-4o → claude-sonnet-4.5

### 圖片生成
**OpenAI 官方 API**:
- `gpt-image-1-mini`

### 搜尋研究
**Perplexity 官方 API** (已整合):
- `sonar`

## Fallback 鏈設計

### 複雜處理（研究、大綱規劃）
```
deepseek-reasoner (DeepSeek API)
  ↓ (失敗)
openai/gpt-5 (OpenRouter)
  ↓ (失敗)
openai/gpt-4o (OpenRouter)
  ↓ (失敗)
google/gemini-2.5-pro (OpenRouter)
  ↓ (失敗)
google/gemini-2.5-flash (OpenRouter)
  ↓ (失敗)
anthropic/claude-sonnet-4.5 (OpenRouter)
```

### 簡單功能（寫作、分類、標籤）
```
deepseek-chat (DeepSeek API)
  ↓ (失敗)
openai/gpt-5-mini (OpenRouter)
  ↓ (失敗)
openai/gpt-4o-mini (OpenRouter)
  ↓ (失敗)
openai/gpt-4o (OpenRouter)
  ↓ (失敗)
anthropic/claude-sonnet-4.5 (OpenRouter)
```

## 環境變數配置

```bash
# DeepSeek 官方 API
DEEPSEEK_API_KEY=<your-deepseek-api-key>

# OpenRouter API (fallback)
OPENROUTER_API_KEY=<your-openrouter-api-key>

# OpenAI 官方 API (圖片)
OPENAI_API_KEY=<your-openai-api-key>

# Perplexity API (搜尋)
PERPLEXITY_API_KEY=<your-perplexity-api-key>
```

## ⚠️ 重要變更

### 已移除
- ❌ **SerpAPI** - 不再使用，已從環境變數中移除
- ❌ `PLATFORM_SERPAPI_API_KEY`
- ❌ 所有 SerpAPI 相關代碼

### 已新增
- ✅ GPT-5 和 GPT-5 Mini
- ✅ Gemini 2.5 Pro
- ✅ Claude Sonnet 4.5（取代 3.5）
- ✅ OpenAI API Key 用於圖片生成

## 實作優先順序

### Phase 1: API 客戶端
1. DeepSeek 官方 API 客戶端
2. OpenAI 圖片生成客戶端

### Phase 2: Database & Types
3. Database Migration (api_provider 欄位)
4. TypeScript 型別定義更新

### Phase 3: Orchestrator
5. API 路由邏輯（根據 api_provider 選擇客戶端）
6. Fallback 鏈實作
7. Token 計費 2x 倍數

### Phase 4: UI & API
8. 模型管理 API
9. Frontend 網站設定 UI
10. 整合測試

## 驗證腳本
`scripts/verify-models.ts` - 已更新並測試通過所有模型
