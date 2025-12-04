# 開發日誌 (DevLog)

---

## 2025-12-04: 修復文章內外部連結未插入問題

### 問題描述

文章生成後，HTML 編輯器中看不到任何內外部連結。經調查發現：

- 10 篇文章中只有 1 篇有連結
- 連結存在於 `external_references` 但未被插入到 `html_content`

### 根因分析

`ResearchAgent` 生成的 `externalReferences` 品質不穩定：

| 文章            | external_references.title  | 連結插入結果 |
| --------------- | -------------------------- | ------------ |
| ✅ 1440精選圖片 | `"測試1440精選圖片重複"`   | 3 個連結     |
| ❌ 測試1811     | `"Head116"`, `"114%E5..."` | 0 個連結     |

**問題**：當 `title` 只是 URL 路徑片段（如 `Head116`）時，`LinkProcessorAgent` 無法在文章內容中找到匹配的關鍵字來插入連結。

### 解決方案

在 `LinkProcessorAgent` 中加入 **主關鍵字 fallback 機制**：

```typescript
// link-processor-agent.ts
interface LinkProcessorInput {
  // ...
  primaryKeyword?: string; // 新增：文章主關鍵字
}

// extractKeywordsFromReference() 優先使用主關鍵字
if (primaryKeyword && primaryKeyword.length >= 2) {
  keywords.push(primaryKeyword);
}
```

### 修改檔案

| 檔案                                     | 修改內容                                   |
| ---------------------------------------- | ------------------------------------------ |
| `src/lib/agents/link-processor-agent.ts` | 新增 `primaryKeyword` 參數和 fallback 邏輯 |
| `src/lib/agents/orchestrator.ts`         | 傳入 `primaryKeyword: input.title`         |

### 預期效果

即使 `external_references.title` 是無意義的 URL 片段，也能使用文章的主關鍵字（如「測試1811」）作為錨點文字插入連結。

---

## 2025-12-04: 文章生成系統穩定運行確認

### 狀態

經測試確認，文章生成系統各項功能均正常運行：

- ✅ **HTML 輸出**：無殘留 Markdown 語法
- ✅ **Markdown 轉換**：正確轉為 HTML
- ✅ **JSON 解析**：AI 輸出正確解析，無截斷問題
- ✅ **段落生成**：Section agents 正常輸出完整內容
- ✅ **圖片生成**：精選圖片與內文圖片正常產出
- ✅ **FAQ 生成**：數量控制在 3-5 個，token 限制適當

### 最近修正

| Commit    | 修改內容                                                      |
| --------- | ------------------------------------------------------------- |
| `be19f7b` | FAQ token 限制與數量控制（移除 maxTokens: 1000，統一 3-5 個） |
| `8cd6064` | HTML 中殘留 Markdown 語法問題                                 |
| `7239ec4` | website_configs UUID 驗證                                     |

---

## 2025-12-04: 修復 HTML 中殘留 Markdown 語法問題

### 問題描述

文章生成後的 HTML 中仍然殘留 Markdown 語法（如 `**粗體**`、`## 標題`），導致前端顯示異常。

### 根因分析

**兩個獨立問題**：

1. **JSON 截斷**：Section agents 的 `maxTokens` 設定過低（400 字段落只有 800 tokens），導致 AI 輸出被截斷（`finish_reason=length`），JSON 解析失敗，原始 markdown 直接流入後續處理。

2. **Markdown 清理不完整**：`marked.js` 有時會遺漏嵌套在 HTML 區塊內的 markdown（[by design](https://github.com/markedjs/marked/issues/488)），特別是 `<p>## 標題</p>` 這類情況。

### 解決方案（三層防線架構）

```
Layer 1: PREVENTION（預防）
├── 提高 token 限制：maxTokens = max(wordCount * 3, 2000)
└── 自動重試截斷輸出：檢測 finish_reason=length 時增加 50% token 重試

Layer 2: REPAIR（修復）
├── 使用 jsonrepair 修復截斷/格式錯誤的 JSON
└── Fallback regex 提取 content 欄位

Layer 3: CLEANUP（清理）
├── OutputAdapter：先清理再驗證，只對嚴重問題觸發重新轉換
└── ArticleStorage：最終防線，處理 <p> 內的 markdown 標題
```

### 修改檔案

| 檔案                                  | 修改內容                                          |
| ------------------------------------- | ------------------------------------------------- |
| `package.json`                        | 新增 `jsonrepair` 依賴                            |
| `src/lib/agents/orchestrator.ts`      | 提高 Section agent token 限制                     |
| `src/lib/agents/section-agent.ts`     | 使用 jsonrepair 修復 JSON                         |
| `src/lib/agents/output-adapter.ts`    | 新增 `hasSeriousMarkdownIssues()`、增強清理函數   |
| `src/lib/ai/ai-client.ts`             | 新增截斷自動重試機制                              |
| `src/lib/services/article-storage.ts` | 增強 `isValidHTML()` 和 `cleanMarkdownFromHtml()` |

### 參考資料

- [jsonrepair (npm)](https://github.com/josdejong/jsonrepair) - LLM JSON 修復套件
- [DeepSeek JSON Output Docs](https://api-docs.deepseek.com/guides/json_mode) - 官方建議設定足夠的 max_tokens

---

## 2025-12-04: 修復文章重複執行問題

### 問題描述

文章生成完成後，系統又重新執行一次相同的任務。

### 根因分析

`scripts/process-jobs.ts` 的 job 鎖定機制存在 **Race Condition（競態條件）**：

1. GitHub Actions 每 2 分鐘執行一次 workflow
2. 查詢條件：`started_at.is.null` 或 `started_at.lt.${3分鐘前}`
3. 鎖定邏輯：直接 UPDATE，**沒有檢查 `started_at` 是否仍符合條件**

**問題場景**：

```
T=0:  Workflow A 查詢，找到 Job X（started_at = null）
T=1s: Workflow B 啟動，也找到 Job X（started_at 仍為 null）
T=2s: Workflow A 鎖定 Job X（started_at = T+2s）
T=3s: Workflow B 也鎖定 Job X（覆蓋 started_at）← 重複執行！
```

### 解決方案

使用**樂觀鎖定**：UPDATE 時加入與查詢相同的條件，確保只有第一個 workflow 能鎖定成功。

```typescript
// 修復前：直接更新，沒有條件檢查
.update({ status: "processing", started_at: now })
.eq("id", job.id)

// 修復後：加入樂觀鎖定條件
.update({ status: "processing", started_at: now })
.eq("id", job.id)
.in("status", ["pending", "processing"])
.or(`started_at.is.null,started_at.lt.${threeMinutesAgo}`)
```

### 修改檔案

- `scripts/process-jobs.ts`

---

## 2025-12-04: 修復精選圖片重複插入（Introduction/UnifiedWriting）

### 問題描述

精選圖片在 HTML 中出現兩次。

### 根因分析

圖片在多個地方被插入：

1. **IntroductionAgent** - prompt 指令 + 後處理插入
2. **UnifiedWritingAgent** - prompt 指令 + 後處理插入
3. **orchestrator.ts** 的 `insertImagesToHtml` - 再次插入

### 解決方案

與 SectionAgent 相同，移除 IntroductionAgent 和 UnifiedWritingAgent 的圖片插入邏輯，保留 `insertImagesToHtml` 作為唯一插入點。

### 修改檔案

- `src/lib/agents/introduction-agent.ts`
- `src/lib/agents/unified-writing-agent.ts`

---

## 2025-12-04: 修復外部連結關鍵字提取問題

### 問題描述

LinkProcessorAgent 拒絕插入外部連結，因為提取到的關鍵字是 "H3"、"https" 等無效詞彙。

### 根因分析

1. `research-agent.ts` 的 `extractTitleFromUrl()` 從 URL 路徑提取標題
2. URL 如 `/blog/h3-styling` 會提取出 "H3 Styling" 作為標題
3. 這些無效標題被用於關鍵字比對，導致語義相似度過低被拒絕

### 解決方案

1. 新增 `extractTitleFromContent()` 從 Perplexity 內容中提取真實標題
2. 新增 `isInvalidTitle()` 過濾無效標題
3. 在 `link-processor-agent.ts` 新增技術詞彙黑名單

### 修改檔案

- `src/lib/agents/research-agent.ts`
- `src/lib/agents/link-processor-agent.ts`

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
