## Why

文章生成的 multi-agent pipeline 存在多個嚴重問題，導致：

1. 產業/地區資訊在傳遞過程中遺失，影響文章相關性
2. SectionAgent fetch 錯誤導致 multi-agent flow 失敗，被迫 fallback 到 legacy 模式
3. 標題直接使用用戶輸入的關鍵字，而非由 AI 生成更吸引人的標題
4. H2 結構過於制式化，每篇文章結構雷同
5. JSON 解析錯誤頻繁發生
6. HTMLAgent 解析錯誤

## What Changes

### P0 - 必須修復

- **修復產業/地區資訊傳遞**：更新 `ArticleGenerationInput` 型別，確保 Orchestrator 從 input 讀取 industry/region/language
- **增強 SectionAgent 重試邏輯**：增加重試次數 (3→5)、擴展可重試錯誤類型、調整 timeout (90s→120s)

### P1 - 重要修復

- **標題完全由 AI 生成**：移除 `input.title` 優先邏輯，讓 StrategyAgent 基於研究結果生成標題
- **改進 JSON 解析**：強化 Prompt 格式要求，增強解析容錯能力
- **StrategyAgent 分析來源**：基於 ResearchAgent 總結而非搜索結果

### P2 - 優化

- **H2 結構彈性化**：移除制式模板，改為方向性指引
- **HTMLAgent 錯誤處理**：確保 HTML 結構完整，安全解析

### P3 - 調查/統計

- **tokenUsage 缺失**：確保 executionInfo 正確包含 tokenUsage

## Impact

- 受影響 specs: `article-generation`, `agent-retry`, `title-generation`
- 受影響程式碼:
  - `src/types/agents.ts`
  - `src/lib/agents/orchestrator.ts`
  - `src/lib/agents/strategy-agent.ts`
  - `src/lib/agents/content-plan-agent.ts`
  - `src/lib/agents/section-agent.ts`
  - `src/lib/agents/html-agent.ts`
  - `src/lib/agents/retry-config.ts`
  - `scripts/process-jobs.ts`
