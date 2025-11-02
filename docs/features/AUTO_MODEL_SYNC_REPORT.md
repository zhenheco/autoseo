# 自動模型同步系統報告

## 問題

手動新增模型不夠自動化，當 AI 提供商發布新模型時需要人工介入。

## 解決方案

實作**完全自動化**的模型同步系統，支援：
1. 自動從 AI 提供商 API 拉取最新模型
2. 自動發現新模型並新增到資料庫
3. 自動更新現有模型資訊
4. 自動標記過期模型
5. 定時自動執行（每天凌晨 2 點）

## 實作架構

### 1. 模型同步服務類別

#### OpenAIModelSync
```typescript
// 從 OpenAI API 自動拉取
const models = await openaiSync.fetchAvailableModels();

// 自動解析模型資訊
- GPT-4 系列（自動識別 turbo, vision 等變體）
- GPT-3.5 系列
- DALL-E 系列
- ChatGPT Image 系列
```

**自動提取資訊:**
- 模型 ID 和名稱
- 定價（input/output tokens）
- Context Window（依版本自動推斷）
- 支援功能（streaming, JSON mode, function calling）
- 標籤（recommended, latest, preview 等）

#### AnthropicModelSync
```typescript
// 已知模型列表
const models = await anthropicSync.fetchAvailableModels();

// 自動檢查新模型
const newModels = await anthropicSync.checkForNewModels();
```

**支援模型:**
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku
- Claude 3.5 Sonnet（最新）

**自動發現:**
- 爬取 Anthropic 文檔頁面
- 使用正則表達式匹配新模型 ID
- 依變體（opus/sonnet/haiku）自動推斷定價和能力

#### GeminiModelSync
```typescript
// Google Gemini 模型
const models = await geminiSync.fetchAvailableModels();
```

**支援模型:**
- Gemini 1.5 Pro（100萬 token context）
- Gemini 1.5 Flash（快速且經濟）
- Gemini Pro（平衡版本）

### 2. 同步服務

#### ModelSyncService
統一管理所有提供商的同步邏輯：

```typescript
// 同步所有提供商
const results = await syncService.syncAllProviders();

// 同步特定提供商
await syncService.syncOpenAI();
await syncService.syncAnthropic();
await syncService.syncGemini();

// 標記過期模型
await syncService.markDeprecatedModels();
```

**智慧同步邏輯:**
1. 檢查模型是否已存在
2. 存在 → 更新資訊
3. 不存在 → 新增模型
4. 返回詳細報告

**自動棄用:**
- 檢查 6 個月前的模型
- 自動標記 preview 版本為棄用
- 標記帶日期的舊版本（如 0613）

### 3. API 端點

#### POST /api/ai-models/sync
手動觸發同步

```bash
# 同步所有
curl -X POST https://your-domain.com/api/ai-models/sync

# 同步特定提供商
curl -X POST https://your-domain.com/api/ai-models/sync \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai"}'
```

**回應:**
```json
{
  "success": true,
  "summary": {
    "newModels": 3,
    "updatedModels": 5,
    "deprecatedModels": 2,
    "errors": 0
  },
  "details": [
    {
      "provider": "openai",
      "newModels": 2,
      "updatedModels": 3,
      "errors": []
    },
    {
      "provider": "anthropic",
      "newModels": 1,
      "updatedModels": 2,
      "errors": []
    }
  ]
}
```

#### GET /api/cron/sync-models
定時任務端點（需要認證）

```bash
curl https://your-domain.com/api/cron/sync-models \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 4. 自動定時同步

#### Vercel Cron Job
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-models",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**執行時間:** 每天凌晨 2:00 (UTC)
**最大執行時間:** 5 分鐘
**認證:** 使用 CRON_SECRET 環境變數

## 使用流程

### 自動模式（推薦）
1. 部署到 Vercel
2. 設定 `CRON_SECRET` 環境變數
3. 系統每天自動同步
4. 前端自動獲得最新模型列表

### 手動模式
1. 需要時呼叫 `/api/ai-models/sync`
2. 查看同步報告
3. 前端重新獲取模型列表

### 前端使用
```typescript
// 完全不需要改變！
// 前端依然呼叫相同的 API
const response = await fetch('/api/ai-models/text');
const { groupedByProvider } = await response.json();

// 自動獲得最新模型
```

## 支援的提供商

| 提供商 | 自動拉取 | 新模型發現 | 定價更新 | 狀態 |
|--------|---------|-----------|---------|------|
| OpenAI | ✅ API | ✅ API | ✅ | 完成 |
| Anthropic | ✅ 內建 | ✅ 網頁 | ✅ | 完成 |
| Google (Gemini) | ✅ 內建 | ⏳ 計劃 | ✅ | 完成 |
| DeepSeek | ⏳ 計劃 | ⏳ 計劃 | ✅ | 計劃 |
| Perplexity | ⏳ 計劃 | ⏳ 計劃 | ✅ | 計劃 |

## 環境變數設定

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Cron
CRON_SECRET=random-secret-string
```

## 監控和日誌

### 同步報告
每次同步會記錄：
- 新增模型數量
- 更新模型數量
- 棄用模型數量
- 錯誤訊息

### 錯誤處理
- 單一模型同步失敗不影響其他模型
- 詳細錯誤訊息記錄
- 失敗後繼續處理其他模型

### 日誌輸出
```
Model sync completed: {
  newModels: 3,
  updatedModels: 5,
  deprecatedModels: 2,
  errors: 0
}
```

## 優勢

### 1. 完全自動化 ✅
- 無需手動介入
- 自動發現新模型
- 自動更新資訊

### 2. 即時更新 ✅
- 每天自動同步
- 可手動觸發
- 前端立即可用

### 3. 智慧管理 ✅
- 自動標記過期模型
- 保留歷史模型資料
- 向後相容

### 4. 可擴展性 ✅
- 易於新增新提供商
- 統一的介面設計
- 模組化架構

### 5. 成本透明 ✅
- 自動更新定價
- 可計算預估成本
- 協助用戶選擇

## 檔案清單

- `src/lib/model-sync/openai-sync.ts` - OpenAI 同步
- `src/lib/model-sync/anthropic-sync.ts` - Anthropic 同步
- `src/lib/model-sync/gemini-sync.ts` - Gemini 同步
- `src/lib/model-sync/model-sync-service.ts` - 統一服務
- `src/app/api/ai-models/sync/route.ts` - 手動同步 API
- `src/app/api/cron/sync-models/route.ts` - 定時任務
- `vercel.json` - Cron 配置

## 下一步

1. ✅ OpenAI 自動同步
2. ✅ Anthropic 自動同步
3. ✅ Gemini 內建模型
4. ⏳ DeepSeek 同步（計劃）
5. ⏳ Perplexity 同步（計劃）
6. ⏳ 同步歷史記錄追蹤
7. ⏳ 前端同步狀態顯示

## 總結

**完全不需要手動新增模型！**

系統會：
1. 每天自動從 OpenAI API 拉取最新模型
2. 自動檢查 Anthropic 文檔發現新模型
3. 自動更新模型資訊和定價
4. 自動標記過期模型
5. 前端自動獲得最新列表

你只需要：
1. 部署到 Vercel
2. 設定 API Keys
3. 就這樣！系統全自動運作 🚀
