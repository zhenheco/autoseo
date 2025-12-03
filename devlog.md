# 開發日誌 (DevLog)

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

---
