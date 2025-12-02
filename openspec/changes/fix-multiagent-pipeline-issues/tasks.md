## 1. P0 - 產業/地區資訊傳遞

- [ ] 1.1 更新 `src/types/agents.ts` 中的 `ArticleGenerationInput` 型別，新增 `industry`, `region`, `language` 欄位
- [ ] 1.2 修改 `src/lib/agents/orchestrator.ts`，從 input 優先讀取 industry/region/language
- [ ] 1.3 修改 `scripts/process-jobs.ts`，從 metadata 傳遞 industry/region/language 給 Orchestrator
- [ ] 1.4 驗證：執行文章生成，確認 logs 顯示正確的 industry/region

## 2. P0 - SectionAgent 重試邏輯

- [ ] 2.1 修改 `src/lib/agents/retry-config.ts`，SECTION_AGENT 配置：
  - maxAttempts: 3 → 5
  - timeoutMs: 90000 → 120000
  - 新增 retryableErrors: 'fetch failed', 'network error', 'socket hang up', 'EHOSTUNREACH'
- [ ] 2.2 修改 `src/lib/agents/orchestrator.ts` 的 `isRetryableError()` 方法，更寬鬆的錯誤匹配
- [ ] 2.3 驗證：確認 multi-agent flow 不再輕易 fallback 到 legacy

## 3. P1 - 標題由 AI 生成

- [ ] 3.1 修改 `src/lib/agents/strategy-agent.ts`，移除 `input.title ||` 優先邏輯
- [ ] 3.2 改進 `generateTitleOptions()` Prompt：
  - 基於 ResearchAgent 的 recommendedStrategy 和 contentGaps
  - 要求標題不複製關鍵字
  - 強調只輸出 JSON，不要推理文字
- [ ] 3.3 確保 Orchestrator 不將用戶關鍵字直接傳給 StrategyAgent 作為 title
- [ ] 3.4 驗證：生成文章，確認標題非用戶輸入的關鍵字

## 4. P1 - JSON 解析增強

- [ ] 4.1 修改 `src/lib/agents/strategy-agent.ts` 的 Prompt，強調「只輸出 JSON」
- [ ] 4.2 修改 `src/lib/agents/content-plan-agent.ts` 的 Prompt，強調「只輸出 JSON」
- [ ] 4.3 增強 JSON 解析邏輯：
  - 嘗試直接解析
  - 提取 `{...}` JSON 區塊
  - 提取 `[...]` JSON 陣列
- [ ] 4.4 驗證：確認 logs 無 JSON 解析錯誤

## 5. P2 - H2 結構彈性化

- [ ] 5.1 修改 `src/lib/agents/content-plan-agent.ts` 的 Prompt：
  - 移除制式化模板（「基本定義與原理」「必要工具與資源」等）
  - 改為方向性指引（問題解決型、比較型、教學型、評測型）
  - 強調根據主題自行決定最適合的 H2 結構
- [ ] 5.2 驗證：生成多篇文章，確認 H2 結構多樣化

## 6. P2 - HTMLAgent 錯誤處理

- [ ] 6.1 修改 `src/lib/agents/html-agent.ts`：
  - 確保 HTML 結構完整（包含 `<!DOCTYPE>`, `<html>`, `<body>`）
  - 安全解析，處理 null documentElement
- [ ] 6.2 驗證：確認 logs 無 HTMLAgent 錯誤

## 7. P3 - tokenUsage 修復

- [ ] 7.1 修改 `src/lib/agents/orchestrator.ts`，確保 executionInfo 正確包含 tokenUsage
- [ ] 7.2 驗證：確認 logs 無「executionInfo 中沒有 tokenUsage 屬性」警告

## 8. 最終驗證

- [ ] 8.1 執行 `pnpm run build` 確保無編譯錯誤
- [ ] 8.2 手動觸發文章生成，觀察 GitHub Actions logs
- [ ] 8.3 確認所有問題已修復：
  - [ ] industry/region 正確傳遞
  - [ ] multi-agent flow 完成（無 fallback to legacy）
  - [ ] 標題由 AI 生成（非用戶關鍵字）
  - [ ] H2 結構多樣化（非制式化）
  - [ ] 無 JSON 解析錯誤
  - [ ] 無 HTMLAgent 錯誤
  - [ ] tokenUsage 正確記錄
