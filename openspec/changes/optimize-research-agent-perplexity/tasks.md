## Implementation Tasks

### Phase 1: ResearchAgent Perplexity 優化（優先級：高）

- [x] **Task 1.1**: 新增 `executeUnifiedResearch()` 方法
  - 合併 `performDeepResearch()` 的 3 個查詢為單一查詢
  - 合併 `fetchExternalReferences()` 的邏輯
  - 確保只呼叫 Perplexity API 一次
  - 檔案：`src/lib/agents/research-agent.ts`

- [x] **Task 1.2**: 更新外部來源搜尋 prompt
  - 移除對 Wikipedia/學術/官方來源的硬性要求
  - 改為請求「5-8 個最相關、最實用的來源」
  - 允許服務商網站、產業部落格、新聞報導等
  - 檔案：`src/lib/agents/research-agent.ts`

- [x] **Task 1.3**: 擴展 `ExternalReferenceType`
  - 新增 `service`（服務商）、`industry`（產業網站）、`tutorial`（教學）類型
  - 更新 `categorizeUrl()` 方法
  - 檔案：`src/types/agents.ts`, `src/lib/agents/research-agent.ts`

- [x] **Task 1.4**: 修改 `ResearchAgent.process()` 流程
  - 使用新的 `executeUnifiedResearch()` 替代舊方法
  - 保留舊方法但標記為 @deprecated
  - 確保輸出格式相容現有 HTMLAgent

### Phase 2: StrategyAgent 標題優化（優先級：中）

- [x] **Task 2.1**: 移除 `getFallbackTitles()` 模板邏輯
  - 備份現有模板（作為測試對照）
  - 移除硬編碼的標題模板
  - 檔案：`src/lib/agents/strategy-agent.ts`

- [x] **Task 2.2**: 新增 `generateTitlesFromResearch()` 方法
  - 根據 ResearchAgent 的研究結果生成標題
  - 使用 AI 分析 trends、userQuestions 資料
  - 生成 3-5 個自然、有針對性的標題
  - 檔案：`src/lib/agents/strategy-agent.ts`

- [x] **Task 2.3**: 更新標題生成 prompt
  - 要求自然語言、避免公式化
  - 包含關鍵字但不生硬
  - 反映文章核心價值

### Phase 3: HTML 轉換修復（優先級：高 - 阻斷用戶使用）

- [x] **Task 3.1**: 調查 HTML 轉換失敗的根本原因
  - 檢查 `saveArticle()` 中的 `marked.parse()` 呼叫
  - 檢查最近的代碼變更
  - 確認 marked 庫版本和配置
  - 檔案：`src/lib/services/article-storage.ts`

- [x] **Task 3.2**: 增加錯誤處理和日誌
  - 在 HTML 轉換前後加入日誌
  - 記錄輸入 Markdown 長度和輸出 HTML 長度
  - 捕獲並記錄任何轉換錯誤
  - 檔案：`src/lib/services/article-storage.ts`

- [x] **Task 3.3**: 實作 fallback 機制
  - 如果 HTML 轉換返回空結果，使用 fallback
  - Fallback 選項：直接使用 Markdown 或簡單格式化
  - 確保用戶永遠不會看到空白編輯器

- [x] **Task 3.4**: 修復現有空白文章
  - 編寫一次性腳本重新轉換現有文章
  - 從 `markdown_content` 重新生成 `html_content`
  - 驗證轉換結果（已修復 1 篇文章）

### Phase 4: 測試驗證

- [x] **Task 4.1**: 測試商業服務主題
  - 使用「春酒活動快剪快播」等商業主題測試
  - 驗證可以找到外部來源
  - 驗證來源類型分類正確

- [x] **Task 4.2**: 測試 API 呼叫次數
  - 確認每篇文章只有 1 次 Perplexity 呼叫
  - 監控 token 使用量

- [x] **Task 4.3**: 測試標題生成
  - 驗證標題不再使用模板
  - 驗證標題自然且有針對性

- [x] **Task 4.4**: 測試 HTML 轉換
  - 驗證新文章有正確的 HTML 內容
  - 驗證錯誤處理正常運作
  - Build 成功通過

## Dependencies

- Phase 3 應與 Phase 1/2 並行進行（因為是阻斷問題）
- Phase 4 需要在 Phase 1-3 完成後執行

## Rollback Plan

如果出現問題：

1. ResearchAgent: 保留的 @deprecated 方法可立即回滾
2. StrategyAgent: 恢復 `getFallbackTitles()` 邏輯
3. ArticleStorage: 日誌可幫助診斷問題
