# 修復 DeepSeek JSON 截斷問題

## 問題

"Unexpected end of JSON input" - 模型輸出被截斷導致 JSON 不完整

## 修復計劃

- [ ] 1. 上調 maxTokens 默認值（2000 → 8000）
  - 檔案：`src/lib/ai/ai-client.ts`

- [ ] 2. 改進錯誤處理（安全解析 JSON）
  - 在 `response.json()` 前檢查 Content-Type
  - 捕獲 JSON 解析錯誤並提供更清楚的錯誤訊息

- [ ] 3. 檢查 finish_reason
  - 如果是 `"length"` 表示被截斷，記錄警告
  - 可考慮自動重試或拋出明確錯誤

- [ ] 4. Prompt 優化
  - 在需要 JSON 輸出的 prompt 中加上「請確保輸出完整的 JSON」

- [ ] 5. 加日誌
  - 記錄實際使用的 max_tokens
  - 記錄 finish_reason
  - 方便排查問題

## 測試

- [ ] 本地測試 Gateway 調用
- [ ] 創建測試任務驗證修復
