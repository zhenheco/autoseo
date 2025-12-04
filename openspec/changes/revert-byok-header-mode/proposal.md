# Proposal: revert-byok-header-mode

## Summary

回滾 Cloudflare AI Gateway 的 header 處理邏輯，恢復同時傳送 `Authorization` 和 `cf-aig-authorization` 的模式。

## Problem Statement

自 2025-12-03 下午起，所有文章生成任務都失敗，錯誤訊息：

```json
{ "code": 2005, "message": "Failed to get response from provider" }
```

### 時間線

| 時間 (UTC) | 時間 (+0800) | 事件                                 |
| ---------- | ------------ | ------------------------------------ |
| 12/3 10:10 | 12/3 18:10   | **最後一次成功**完成文章生成         |
| 12/3 15:54 | 12/3 23:54   | 第一個失敗的任務開始                 |
| 12/3 18:24 | 12/4 02:24   | Commit `67d776c`：嘗試修復 BYOK 模式 |

### 調查發現

1. **API Key 狀態**：用戶確認 Cloudflare Dashboard 中 DeepSeek API Key 為 **Active**
2. **Gateway Authentication**：已啟用
3. **程式碼變更**：Commit `67d776c` 將 header 邏輯改為「純 BYOK 模式」（只傳 `cf-aig-authorization`）
4. **舊版本行為**：同時傳送 `Authorization` + `cf-aig-authorization`

### 根本原因

Commit `67d776c` 按照 Cloudflare BYOK 文檔的建議，移除了 provider 的 `Authorization` header。但實際測試顯示，這個系統需要**同時傳送兩個 header** 才能正常運作。

可能的底層原因：

1. Cloudflare AI Gateway 的 DeepSeek provider 實作問題
2. BYOK 存儲的 API Key 沒有正確轉發給 DeepSeek
3. Gateway 配置需要特定的 header 組合

**重要**：這不是重試、timeout、或 fallback 能解決的問題。根本原因是 header 邏輯的變更。

## Solution

回滾到 12/3 中午前的 header 邏輯：**總是傳送 Authorization，Gateway 模式下額外傳送 cf-aig-authorization**。

### 修改前（壞掉的）

```typescript
// ai-gateway.ts
export function buildDeepSeekHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders()); // 只傳 cf-aig-authorization
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  return headers;
}

// ai-client.ts
const headers = buildDeepSeekHeaders(); // 不傳 apiKey
```

### 修改後（恢復）

```typescript
// ai-gateway.ts
export function buildDeepSeekHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`, // 總是傳
  };

  if (isGatewayEnabled()) {
    Object.assign(headers, getGatewayHeaders()); // Gateway 模式額外傳
  }

  return headers;
}

// ai-client.ts
const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");
const headers = buildDeepSeekHeaders(apiKey); // 傳入 apiKey
```

## Scope

### In Scope

- 回滾 `src/lib/cloudflare/ai-gateway.ts` 的 5 個 header 建構函式
- 回滾 `src/lib/ai/ai-client.ts` 的 API 呼叫邏輯
- 回滾其他受影響的檔案

### Out of Scope

- 不調查 Cloudflare Gateway 的底層問題
- 不修改 Gateway Dashboard 設定
- 不增加重試邏輯（這不是解決方案）

## Success Criteria

1. 文章生成任務能成功完成
2. 不再出現 Error 2005
3. 回滾後的行為與 12/3 中午前一致

## Risks

| Risk                       | Mitigation                                                           |
| -------------------------- | -------------------------------------------------------------------- |
| 回滾後仍失敗               | 如果失敗，表示問題不在程式碼，可能是 Cloudflare 或 DeepSeek 服務問題 |
| 不符合 Cloudflare 最佳實踐 | 這是 workaround，未來 Cloudflare 修復後可以再調整                    |
