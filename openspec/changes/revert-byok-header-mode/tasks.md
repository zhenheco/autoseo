# Tasks: revert-byok-header-mode

## Implementation Tasks

### 1. 回滾 ai-gateway.ts 的 header 函式

- [ ] 1.1 回滾 `buildDeepSeekHeaders` - 恢復 apiKey 參數為必填，總是加入 Authorization header
- [ ] 1.2 回滾 `buildPerplexityHeaders` - 同上
- [ ] 1.3 回滾 `buildOpenAIHeaders` - 同上
- [ ] 1.4 回滾 `buildGeminiHeaders` - 恢復 apiKey 參數為必填，總是加入 x-goog-api-key header
- [ ] 1.5 回滾 `buildOpenRouterHeaders` - 同上

### 2. 回滾 ai-client.ts 的 API 呼叫

- [ ] 2.1 回滾 `callDeepSeekAPI` - 恢復 apiKey 檢查和傳入 buildDeepSeekHeaders
- [ ] 2.2 回滾 `generateImageWithModel` (OpenAI) - 恢復 apiKey 傳入
- [ ] 2.3 回滾 `generateImageWithModel` (DALL-E) - 同上
- [ ] 2.4 回滾 `callGeminiImagenAPI` - 恢復 apiKey 傳入和 URL 參數
- [ ] 2.5 回滾 `callGeminiImageAPI` - 同上

### 3. 回滾其他受影響的檔案

- [ ] 3.1 回滾 `src/lib/deepseek/client.ts` - 恢復 apiKey 傳入
- [ ] 3.2 回滾 `src/lib/perplexity/client.ts` - 恢復 apiKey 傳入
- [ ] 3.3 回滾 `src/lib/agents/category-agent.ts` - 如有修改則回滾
- [ ] 3.4 回滾 `src/app/api/articles/preview-titles/route.ts` - 如有修改則回滾

### 4. 驗證

- [ ] 4.1 執行 `pnpm run build` 確保沒有編譯錯誤
- [ ] 4.2 提交並推送到 main
- [ ] 4.3 觸發一個新的文章生成任務
- [ ] 4.4 確認任務成功完成

## Verification Checklist

回滾後的 headers 應該是：

```
{
  "Content-Type": "application/json",
  "Authorization": "Bearer sk-xxx...",           // Provider API Key
  "cf-aig-authorization": "Bearer cf-xxx..."    // Gateway Token (when enabled)
}
```

## Rollback Plan

如果回滾後仍然失敗：

1. 檢查 Cloudflare AI Gateway Dashboard 的 DeepSeek API Key 是否真的有效
2. 暫時禁用 Gateway（設定 `CF_AI_GATEWAY_ENABLED=false`）直連 DeepSeek API 測試
3. 檢查 DeepSeek API 的狀態頁面
