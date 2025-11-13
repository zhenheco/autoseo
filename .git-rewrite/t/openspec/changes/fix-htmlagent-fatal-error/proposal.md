# 修復 HTMLAgent Fatal Error 及相關系統問題

## Why

根據日誌分析和錯誤追蹤（Request ID: 7hjn8-1762866843622-c88459ce4490），文章生成系統存在阻塞性錯誤：

### P0 Critical Issue: HTMLAgent Fatal Error
```
TypeError: Cannot destructure property 'firstElementChild' of 'a' as it is null.
at D.insertFAQSchema (.next/server/chunks/2424.js:267:5197)
```

**根因鏈**:
1. WritingAgent 輸出僅為 HTML 片段（`<h2>`, `<p>` 等），無 `<html>`, `<head>`, `<body>` 結構
2. linkedom 的 `parseHTML` 在處理片段時不自動創建完整 DOM（不同於瀏覽器行為）
3. `insertFAQSchema` 假設 `document.head.firstElementChild` 存在
4. 錯誤導致整個文章生成流程中斷，資料庫無記錄，用戶看到空白預覽

**影響**:
- 文章生成成功率: 0%
- 用戶無法使用核心功能
- Token 已扣除但無產出

### P1 Issues
1. **R2 Upload Failed**: "Invalid character in header content" - 圖片無法永久儲存，依賴 1 小時過期的臨時 URL
2. **MetaAgent 錯誤模型**: 使用 `gpt-3.5-turbo` 而非 `deepseek-chat`，成本增加 10 倍
3. **UI 顯示問題**: 文章列表顯示「關鍵字 - 標題」而非單純標題

## What Changes

### 1. HTMLAgent 完整重構（P0 - 阻塞問題）
- 確保輸入 HTML 具備完整文檔結構（`<html>`, `<head>`, `<body>`）
- 重寫 `insertFAQSchema` 方法：
  - 移除對 `document.head` 的假設
  - 將 FAQ Schema 插入 `<body>` 末尾（因為最終只返回 `body.innerHTML`）
  - 增加多語言 FAQ 標題支援（常見問題/FAQ/Q&A 等）
- 防禦性錯誤處理：所有方法使用 try-catch，失敗時返回原始 HTML 而非拋出錯誤

### 2. R2 上傳診斷與修復（P1）
- 增強 ImageAgent 診斷日誌（環境變數狀態、credentials 驗證）
- 在 R2Client 中檢查非 ASCII 字符
- 提供清晰的錯誤訊息供運維排查

### 3. MetaAgent 模型配置修正（P1）
- 檢查資料庫 `agent_configs` 表中的 `meta_model` 配置
- 搜尋並移除代碼中的硬編碼 `gpt-3.5-turbo`
- 在 Orchestrator 中添加模型配置驗證日誌

### 4. 文章列表 UI 優化（P2）
- 移除關鍵字前綴，僅顯示標題
- 改進用戶體驗

## Impact

### Affected specs
- `article-generation` (現有變更已存在，將擴充)
- `image-processing` (新增)
- `agent-orchestration` (新增)

### Affected code
- `src/lib/agents/html-agent.ts` - **CRITICAL**: 核心重構
- `src/lib/agents/image-agent.ts` - 診斷增強
- `src/lib/storage/r2-client.ts` - 驗證邏輯
- `src/lib/agents/orchestrator.ts` - 配置日誌
- `src/lib/agents/meta-agent.ts` - 模型驗證
- `src/app/(dashboard)/dashboard/articles/page.tsx` - UI 修改

### Dependencies
- linkedom - 已在使用，需確保片段處理邏輯正確
- AWS SDK (S3Client) - R2 上傳相關

### Breaking Changes
無 - 所有修改向後兼容

### Migration Plan
無需遷移 - 修復部署後立即生效

### Success Metrics
- 文章生成成功率: 0% → 100%
- 預覽顯示正常率: 0% → 100%
- R2 上傳成功率: 0% → 目標 >90% (診斷後修復)
- DeepSeek 模型使用率: <100% → 100%
- 成本節省: ~80% (MetaAgent 模型修正)
