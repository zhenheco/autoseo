# AI 模型驗證結果

## 執行日期
2025-11-04

## 驗證摘要

### ✅ 可用模型 (6/7 測試通過)

| 模型 | Provider | 用途 | 回應時間 | 狀態 |
|------|----------|------|----------|------|
| deepseek/deepseek-r1 | DeepSeek (OpenRouter) | Complex | 1163ms | ✅ |
| deepseek/deepseek-chat | DeepSeek (OpenRouter) | Simple | 2109ms | ✅ |
| openai/gpt-4o | OpenAI (OpenRouter) | Both | 983ms | ✅ |
| openai/gpt-4o-mini | OpenAI (OpenRouter) | Simple | 1369ms | ✅ |
| google/gemini-2.5-flash | Google (OpenRouter) | Complex | 1676ms | ✅ |
| anthropic/claude-sonnet-4.5 | Anthropic (OpenRouter) | Both | 1213ms | ✅ |

### ❌ 不可用模型

| 模型 | 原因 | 解決方案 |
|------|------|----------|
| google/gemini-2.0-flash-exp:free | 需要資料政策設定 | 不使用 free 模型 |

## 最終策略更新

### 文字模型 API 策略

根據用戶需求，採用混合 API 策略：

#### DeepSeek 模型 → **使用官方 API**
- **API 端點**: `https://api.deepseek.com/v1/chat/completions`
- **模型**:
  - `deepseek-reasoner` - 複雜處理（研究、規劃）
  - `deepseek-chat` - 簡單功能（寫作、分類、標籤）
- **優勢**:
  - 直接使用最新版本
  - 更穩定的連接
  - 官方支援

#### 其他模型 → **使用 OpenRouter**
- **OpenAI**:
  - `openai/gpt-4o` - 兩者皆可
  - `openai/gpt-4o-mini` - 簡單功能 fallback
- **Google**:
  - `google/gemini-2.5-flash` - 複雜處理 fallback
- **Anthropic**:
  - `anthropic/claude-sonnet-4.5` - 兩者皆可（最新版本）

### 圖片模型 API 策略

#### ChatGPT Image → **使用 OpenAI 官方 API**
- **原因**: OpenRouter 未提供圖片生成模型
- **模型**: `gpt-image-1-mini` (用戶指定)
- **API 端點**: `https://api.openai.com/v1/images/generations`
- **API Key**: 已配置於環境變數 `OPENAI_API_KEY`

### 搜尋來源

#### Perplexity → **已整合且運作正常**
- **API 端點**: `https://api.perplexity.ai/chat/completions`
- **模型**: `sonar` (預設)
- **使用狀態**:
  - ✅ Research Agent 已整合 (src/lib/agents/research-agent.ts:139)
  - ✅ 支援引用來源提取
  - ✅ 錯誤處理和 Mock 資料 fallback
  - ✅ 4種搜尋方法：`search()`, `analyzeCompetitors()`, `getTrends()`, `researchTopic()`

## 建議的 Fallback 鏈

### 複雜處理階段（研究、大綱規劃）
```
deepseek-reasoner (DeepSeek 官方)
  ↓ (失敗)
openai/gpt-4o (OpenRouter)
  ↓ (失敗)
google/gemini-2.5-flash (OpenRouter)
  ↓ (失敗)
anthropic/claude-3.5-sonnet (OpenRouter)
```

### 簡單功能階段（寫作、分類、標籤）
```
deepseek-chat (DeepSeek 官方)
  ↓ (失敗)
openai/gpt-4o (OpenRouter)
  ↓ (失敗)
openai/gpt-4o-mini (OpenRouter)
  ↓ (失敗)
anthropic/claude-3.5-sonnet (OpenRouter)
```

## 實作需求

### 1. DeepSeek 官方 API 客戶端
- 建立 `src/lib/deepseek/client.ts`
- 實作 OpenAI 相容介面
- 支援 `deepseek-reasoner` 和 `deepseek-chat`
- 錯誤處理和 retry 機制

### 2. OpenAI 官方 API (圖片)
- 使用現有的 OpenAI SDK 或建立專用客戶端
- 實作 DALL-E 3 圖片生成
- 錯誤處理

### 3. Orchestrator 更新
- 根據 Agent 類型選擇 API 來源：
  - DeepSeek 模型 → DeepSeek 官方 API
  - 其他模型 → OpenRouter
  - 圖片生成 → OpenAI 官方 API
- 實作 fallback 鏈邏輯

### 4. 環境變數
需要配置以下 API Keys：
- ✅ `DEEPSEEK_API_KEY` (已配置)
- ✅ `OPENROUTER_API_KEY` (已配置)
- ✅ `OPENAI_API_KEY` (已配置 - 用於 gpt-image-1-mini)
- ✅ `PERPLEXITY_API_KEY` (已配置)

## Perplexity 整合驗證

### ✅ 整合狀態：完整且正常

#### 已實作功能
1. **基礎搜尋** (`search()`)
   - 支援自訂 model, temperature, max_tokens
   - 支援搜尋過濾（domain, recency）
   - 自動提取引用來源和圖片
   - 清理內容格式

2. **競爭對手分析** (`analyzeCompetitors()`)
   - 分析關鍵字排名前 5 的網站
   - 內容策略分析
   - 內容缺口識別

3. **趨勢分析** (`getTrends()`)
   - 支援 day/week/month 時間範圍
   - 熱門話題追蹤
   - 相關統計數據

4. **深度研究** (`researchTopic()`)
   - 全面概述
   - 關鍵要點提取
   - 專家觀點整合
   - 相關主題建議

#### 使用狀況
- **Research Agent**: ✅ 已使用 (src/lib/agents/research-agent.ts:154)
- **Strategy Agent**: ❓ 需要確認
- **其他 Agents**: 不需要（無搜尋需求）

#### 錯誤處理
- ✅ API Key 缺失 → 返回 Mock 資料
- ✅ API 錯誤 → 捕獲並返回 Mock 資料
- ✅ 響應格式驗證 (Zod Schema)

## 後續步驟

1. ✅ 驗證模型可用性 - 完成
2. ✅ 審查 Perplexity 整合 - 完成
3. 🔄 更新 OpenSpec 提案 - 進行中
4. ⏳ 建立 DeepSeek 官方 API 客戶端
5. ⏳ 實作 Database Migration
6. ⏳ 更新 Orchestrator 邏輯
7. ⏳ 開發 Frontend UI

## 參考文件
- 驗證腳本: `scripts/verify-models.ts`
- Perplexity 客戶端: `src/lib/perplexity/client.ts`
- Research Agent: `src/lib/agents/research-agent.ts`
