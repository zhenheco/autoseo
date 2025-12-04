# 開發日誌 (DevLog)

---

## 2025-12-04: 修復圖片重複插入 Bug

### 問題描述

前端 HTML 中出現 8 張圖片，但實際只生成 4 張。每張圖片都被重複插入了 2 次。

### 根因分析

圖片在兩個地方被插入：

1. **SectionAgent** (section-agent.ts) - 在生成 markdown 時透過 prompt 和後處理插入圖片
2. **orchestrator.ts** 的 `insertImagesToHtml` - 再次將圖片插入到 HTML

### 解決方案

**刪除 SectionAgent 的圖片插入邏輯**，保留 `insertImagesToHtml` 作為唯一的圖片插入點。

理由：

- `insertImagesToHtml` 有更智能的分配邏輯（根據 H2/H3 位置分配）
- 單一責任原則：圖片插入只在一個地方處理
- 更簡單 = 更穩定

### 修改內容

**section-agent.ts**：

- 移除 prompt 中的圖片插入指令
- 移除後處理的圖片插入邏輯

**orchestrator.ts**：

- 移除先前加入的重複檢查邏輯（因為 SectionAgent 不再插入圖片，檢查不需要了）

### 修改檔案

- `src/lib/agents/section-agent.ts`
- `src/lib/agents/orchestrator.ts`

---

## 2025-12-04: 5 層 AI Provider Fallback 機制

### 問題描述

DeepSeek API 在半夜時段不穩定，導致文章生成失敗。

### 解決方案

將 3 層 Fallback 擴展為 5 層，新增 OpenAI 作為最後防線：

```
Step 1: Gateway DeepSeek     ← 主要（成本最低）
Step 2: Gateway OpenRouter   ← DeepSeek v3.2 via OpenRouter
Step 3: 直連 DeepSeek        ← 繞過 Gateway
Step 4: Gateway OpenAI       ← GPT-5/GPT-5-mini（新增）
Step 5: 直連 OpenAI          ← 最後防線（新增）
```

### 模型映射

| DeepSeek 模型       | OpenAI Fallback |
| ------------------- | --------------- |
| `deepseek-chat`     | `gpt-5-mini`    |
| `deepseek-reasoner` | `gpt-5`         |

### 修改內容

- 新增 `callOpenAIAPI()` 方法
- 在 `callDeepSeekAPI()` 新增 Step 4-5

**Commit**: `7d2a1aa`

**修改檔案**：

- `src/lib/ai/ai-client.ts`

---

## 2025-12-04: 修復 DeepSeek JSON 截斷問題

### 問題描述

文章生成失敗，錯誤訊息：

```
Unexpected end of JSON input
```

### 根本原因

1. **maxTokens 預設值過小**：預設 2000 tokens 不足以完成複雜 JSON 輸出（如 ContentPlanAgent）
2. **缺乏截斷偵測**：DeepSeek 在 token 限制時會設 `finish_reason="length"`，但程式未檢查
3. **錯誤處理不完善**：直接使用 `response.json()` 解析，失敗時無法看到原始響應內容

### 修復內容

| 修改                  | 描述                                               |
| --------------------- | -------------------------------------------------- |
| maxTokens 2000 → 8000 | 足夠大部分 JSON 輸出                               |
| 安全 JSON 解析        | 先 `text()` 再 `JSON.parse()`，失敗時輸出前 500 字 |
| finish_reason 檢查    | 如果是 `"length"` 輸出警告                         |
| Prompt 優化           | 4 個 agent 加入「請確保輸出完整的 JSON」提示       |
| 類型補全              | DeepSeekResponse 加入 `finish_reason` 欄位         |

**Commit**: `43c7fb3`

**修改檔案**：

- `src/lib/ai/ai-client.ts`
- `src/lib/agents/category-agent.ts`
- `src/lib/agents/meta-agent.ts`
- `src/lib/agents/content-plan-agent.ts`
- `src/lib/agents/unified-strategy-agent.ts`

### 參考資料

- [DeepSeek JSON 模式文檔](https://api-docs.deepseek.com/zh-cn/guides/json_mode)

---

## 2025-12-04: Cloudflare AI Gateway Error 2005 調查與修復嘗試

### 問題描述

文章生成持續失敗，錯誤訊息：

```
Error 2005: "Failed to get response from provider"
```

### 調查過程

#### 1. 時間線分析

通過資料庫查詢，發現錯誤時間線：

| 時間 (UTC) | 狀態    | 錯誤類型      | Commit  |
| ---------- | ------- | ------------- | ------- |
| 10:00      | ✅ 成功 | -             | 2b88462 |
| 12:00      | ❌ 失敗 | HTML 錯誤頁面 | 2b88462 |
| 14:11+     | ❌ 失敗 | Error 2005    | -       |
| 17:54+     | ❌ 失敗 | Error 2005    | 67d776c |

**關鍵發現**：12:00 UTC 的失敗使用的是同一個 commit `2b88462`（與 10:00 成功的相同），說明問題不完全是程式碼導致。

#### 2. 錯誤類型統計

- **Error 2005**: Gateway 無法從 provider 取得回應
- **Error 2014**: Provider 請求超時
- **HTML 錯誤頁面**: Cloudflare 錯誤頁面（<!DOCTYPE）
- **terminated**: 連接中斷
- **Unexpected end of JSON**: JSON 被截斷

### 修復嘗試

#### 嘗試 1: 回滾 BYOK Header 模式 ❌

**假設**：commit `67d776c` 改為純 BYOK 模式（只傳 `cf-aig-authorization`）導致問題

**修改**：回滾到雙 Header 模式（同時傳 `Authorization` + `cf-aig-authorization`）

**結果**：失敗，錯誤持續

**Commit**: `d4c9fa8`

#### 嘗試 2: 修復 URL 路徑 ❌

**假設**：對比 Cloudflare 官方文檔，發現 URL 路徑問題

|      | 官方文檔                        | 我們的程式碼                       |
| ---- | ------------------------------- | ---------------------------------- |
| URL  | `.../deepseek/chat/completions` | `.../deepseek/v1/chat/completions` |
| 差異 | ✅ 正確                         | ❌ 多了 `/v1`                      |

**修改**：

- ai-client.ts: 根據 Gateway 模式選擇 endpoint
- deepseek/client.ts: 在 makeRequest 中移除多餘的 `/v1`
- category-agent.ts: 根據 Gateway 模式選擇 endpoint

```typescript
const endpoint = isGatewayEnabled()
  ? `${baseUrl}/chat/completions` // Gateway 模式
  : `${baseUrl}/v1/chat/completions`; // 直連模式
```

**結果**：失敗，錯誤持續

**Commit**: `6c5c544`

### 待進一步調查

1. **Cloudflare Dashboard 設定**
   - 確認 Provider Keys 是否正確設定 DeepSeek API Key
   - 確認 Gateway Authentication 設定
   - 檢查 Gateway 日誌

2. **DeepSeek API 穩定性**
   - 同一程式碼有時成功有時失敗，可能是 DeepSeek API 不穩定
   - 考慮加入 Provider Fallback（DeepSeek → Gemini → OpenAI）

3. **繞過 Gateway 測試**
   - 設定 `CF_AI_GATEWAY_ENABLED=false` 直連 DeepSeek
   - 如果直連成功，問題在 Gateway 設定

4. **改用 OpenRouter**
   - OpenRouter 本身是 AI API 聚合器，有內建 fallback
   - 已有 OpenRouter client 可直接使用

### 參考資料

- [Cloudflare DeepSeek Provider 文檔](https://developers.cloudflare.com/ai-gateway/usage/providers/deepseek/)
- [Cloudflare BYOK 文檔](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)
- [Cloudflare Gateway Authentication](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)

### 相關 Commits

| Commit    | 描述                                       | 結果    |
| --------- | ------------------------------------------ | ------- |
| `67d776c` | 修復: BYOK 模式（純 cf-aig-authorization） | ❌ 失敗 |
| `d4c9fa8` | 回滾: 恢復雙 Header 模式                   | ❌ 失敗 |
| `6c5c544` | 修復: Gateway URL 路徑問題                 | ❌ 失敗 |

#### 嘗試 3: Gateway 自動 Fallback 到直連 🔄

**假設**：Error 2005 可能是 Cloudflare AI Gateway 與 DeepSeek 之間的連線問題，而非我們程式碼的問題

**分析**：

- Perplexity API 通過同樣的 Gateway 可以正常運作
- DeepSeek API 通過 Gateway 持續失敗
- 可能是 Gateway 的 DeepSeek Provider 設定問題

**修改**：加入自動 fallback 機制

- 當 Gateway 返回 Error 2005 時，自動切換到直連 DeepSeek API
- 這樣可以：
  1. 確保服務不中斷
  2. 診斷問題是否在 Gateway

**修改檔案**：

- `src/lib/ai/ai-client.ts`: 加入 `callDeepSeekAPIInternal` 支援 Gateway/直連切換
- `src/lib/deepseek/client.ts`: 加入 `makeRequestInternal` 支援 fallback
- `src/lib/agents/category-agent.ts`: 加入 `callDeepSeekAPIInternal` 支援 fallback

**關鍵程式碼**：

```typescript
// 先嘗試 Gateway 模式
if (useGateway) {
  try {
    return await this.callDeepSeekAPIInternal(params, apiKey, true);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // 如果是 Error 2005，嘗試直連
    if (
      err.message.includes("2005") ||
      err.message.includes("Failed to get response from provider")
    ) {
      console.log(
        "[AIClient] ⚠️ Gateway Error 2005, 自動切換到直連 DeepSeek API...",
      );
      return await this.callDeepSeekAPIInternal(params, apiKey, false);
    }
    throw error;
  }
}
```

**預期結果**：

- 如果日誌顯示「✅ 直連 DeepSeek API 成功」→ 問題在 Gateway 設定
- 如果直連也失敗 → 問題在 DeepSeek API 本身

#### 嘗試 4: 完整多層 Fallback 機制 🔄

**目標**：確保服務穩定性，即使單一 Provider 失敗也能繼續運作

**Fallback 鏈**：

```
Step 1: Gateway DeepSeek (deepseek-reasoner/chat)
   ↓ 失敗
Step 2: Gateway OpenRouter (deepseek/deepseek-v3.2)
   ↓ 失敗
Step 3: 直連 DeepSeek API
   ↓ 失敗
Step 4: OpenAI (gpt-5 或 gpt-5-mini)
```

**修改檔案**：

- `src/lib/ai/ai-client.ts`: 完整重寫 `callDeepSeekAPI`，加入 4 層 fallback

**日誌輸出範例**：

```
[AIClient] 🔄 Step 1: Gateway DeepSeek (deepseek-reasoner)
[AIClient] ⚠️ Step 1 失敗: Error 2005
[AIClient] 🔄 Step 2: Gateway OpenRouter (deepseek/deepseek-v3.2)
[AIClient] ✅ Step 2 成功: Gateway OpenRouter (deepseek/deepseek-v3.2)
```

**環境變數要求**：

- `DEEPSEEK_API_KEY`: DeepSeek API 金鑰
- `OPENROUTER_API_KEY`: OpenRouter API 金鑰
- `OPENAI_API_KEY`: OpenAI API 金鑰（最後備援）

---
