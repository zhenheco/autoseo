## Why

ResearchAgent 目前的外部來源搜尋邏輯存在以下問題：

1. **過於嚴格的來源優先順序**：目前的 Perplexity 搜尋 prompt 要求優先找「Wikipedia、學術研究、官方文檔」，但對於商業服務類主題（如「春酒活動快剪快播」），這類來源根本不存在，導致 agent 無法找到任何有用的外部來源。

2. **多次 Perplexity 呼叫**：`performDeepResearch()` 執行 3 個並行查詢（trends、userQuestions、authorityData），加上 `fetchExternalReferences()` 又呼叫一次，總共 4 次 Perplexity API 呼叫，造成成本過高且可能有重複資料。

3. **來源類型判斷過於簡單**：`categorizeUrl()` 僅根據 URL 片段判斷類型，無法準確分類商業網站、產業部落格等實用來源。

## What Changes

### 1. 重新設計外部來源搜尋策略

- 移除對學術/官方來源的硬性要求
- 改為**接受 Perplexity 搜尋結果中的所有相關來源**
- 優先順序調整為：實用性 > 權威性 > 來源類型

### 2. 合併 Perplexity 呼叫

- 將 `performDeepResearch()` 的 3 個查詢合併為 1 個綜合查詢
- 確保 ResearchAgent 對 Perplexity **只呼叫一次**
- 從單次查詢的 citations 提取所有外部來源

### 3. 優化來源處理邏輯

- 擴展 `categorizeUrl()` 支援更多類型：`service`（服務商）、`industry`（產業網站）
- 直接使用 Perplexity 返回的 citation metadata（如有）
- 移除對特定來源類型的硬性限制

### 4. 整合用戶 n8n 工作流程的最佳實踐

參考用戶現有的 n8n 工作流程 prompt 設計：

- 外部來源從 Perplexity 研究數據中提取，不設類型限制
- 優先使用實際可訪問的來源
- 接受商業服務網站作為有效來源

## Impact

- Affected specs: `research-agent`（新增 spec）
- Affected code:
  - `src/lib/agents/research-agent.ts`：主要修改
  - `src/types/agents.ts`：`ExternalReference.type` 擴展
