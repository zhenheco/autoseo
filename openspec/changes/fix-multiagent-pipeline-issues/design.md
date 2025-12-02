## Context

文章生成使用 multi-agent 架構，包含：

- ResearchAgent: 研究主題
- StrategyAgent: 決定策略和標題
- ContentPlanAgent: 規劃內容結構
- SectionAgent: 生成各段落
- WritingAgent: 整合內容
- HTMLAgent: 格式化 HTML
- ImageAgent: 生成配圖

目前存在資料傳遞斷層、重試邏輯不足、標題生成邏輯錯誤等問題。

## Goals / Non-Goals

### Goals

- 確保 industry/region/language 正確傳遞到所有 Agent
- 提高 multi-agent flow 的穩定性，減少 fallback 到 legacy 的情況
- 讓 AI 自主生成吸引人的標題，而非直接使用關鍵字
- 讓 H2 結構根據主題動態決定，而非制式化
- 消除 JSON 解析和 HTML 解析錯誤

### Non-Goals

- 不改變 Agent 的執行順序
- 不改變 multi-agent 的整體架構
- 不改變 token 計費邏輯

## Decisions

### Decision 1: 資料傳遞方式

- **選擇**: 透過 `ArticleGenerationInput` 型別傳遞 industry/region/language
- **原因**: 型別安全、程式碼清晰、避免隱式依賴 websiteSettings
- **替代方案**: 從 metadata 讀取 → 需要額外的資料庫查詢

### Decision 2: 重試策略

- **選擇**: 增加重試次數到 5 次，擴展可重試錯誤類型
- **原因**: 網路不穩定是常見問題，增加容錯能提高成功率
- **替代方案**: 實作 Circuit Breaker → 複雜度高，目前不需要

### Decision 3: 標題生成

- **選擇**: 完全移除 `input.title` 優先邏輯，讓 AI 自主生成
- **原因**: 用戶確認希望 AI 生成更吸引人的標題
- **替代方案**: 用戶可選擇 → 增加 UI 複雜度

### Decision 4: H2 結構

- **選擇**: 提供方向性指引，讓 AI 自行決定
- **原因**: 用戶確認不希望制式化結構
- **替代方案**: 完全不給指引 → 可能導致結構混亂

## Risks / Trade-offs

| Risk                            | Mitigation                       |
| ------------------------------- | -------------------------------- |
| 增加重試次數可能延長總執行時間  | 使用指數退避，初始延遲較短       |
| AI 生成的標題可能不符合用戶預期 | 可考慮未來加入「regenerate」功能 |
| H2 結構過於自由可能導致不一致   | 提供方向性指引作為 guardrail     |

## Migration Plan

1. 更新型別定義
2. 修改 Orchestrator 資料傳遞
3. 修改 StrategyAgent 標題邏輯
4. 修改 ContentPlanAgent Prompt
5. 修改重試配置
6. 修改 HTMLAgent 錯誤處理
7. 驗證所有問題已修復

無需資料庫遷移，無 breaking changes。

## Open Questions

- 無
