# 修復文章生成流程的多個問題

## Why

文章生成流程存在以下關鍵問題：

1. **jsdom/parse5 ESM 錯誤**: Vercel 部署環境中，jsdom 與 parse5 的 ESM/CommonJS 相容性問題導致文章生成失敗
2. **語言選擇無效**: 選擇非繁體中文時，生成流程不執行，未提供適當的錯誤訊息或語言驗證
3. **重複生成文章**: 選擇特定標題後，系統生成兩篇文章（一篇關鍵字、一篇選定標題），而非僅生成用戶選擇的標題
4. **Token 計數未更新**: 使用 token 過程中，資料庫和前端顯示的 token 數量未減少，導致無法正確追蹤使用量

這些問題嚴重影響系統的可用性和準確性，需要立即修復。

## What Changes

### 1. HTML 解析器替換

- **BREAKING**: 將 jsdom 替換為 linkedom（已在專案中使用但未完全遷移）
- 移除所有 jsdom 相關依賴和動態導入
- 確保所有 HTML 操作使用 linkedom 的穩定 API

### 2. 語言驗證機制

- 新增語言選擇驗證邏輯
- 在生成流程開始前檢查語言參數
- 提供清晰的錯誤訊息給不支援的語言

### 3. 文章生成邏輯修正

- 修正標題選擇邏輯，確保僅生成用戶選擇的標題
- 移除重複生成關鍵字文章的邏輯
- 加強生成流程的狀態追蹤

### 4. Token 計數系統

- 實作即時 token 扣除機制
- 確保每次 AI 呼叫後更新資料庫
- 同步前端顯示與資料庫狀態

## Impact

### Affected specs

- `article-generation` (新建)
- `token-management` (新建)

### Affected code

- `src/lib/agents/html-agent.ts` - HTML 解析邏輯
- `src/lib/agents/orchestrator.ts` - 文章生成流程
- `src/app/api/articles/generate` - API 路由（需查找）
- Token 計數相關服務（需查找）
- 前端文章生成介面（需查找）

### 相關日誌

```
Error: require() of ES Module /var/task/node_modules/jsdom/node_modules/parse5/dist/index.js
from /var/task/node_modules/jsdom/lib/jsdom/browser/parser/html.js not supported.
```

### Dependencies

- 需要驗證 linkedom 的完整相容性
- 可能需要更新 package.json 中的依賴版本
- 需要完整的端到端測試
