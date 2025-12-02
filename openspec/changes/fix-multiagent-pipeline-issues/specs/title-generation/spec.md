## ADDED Requirements

### Requirement: 標題由 AI 自主生成

系統 SHALL 讓 StrategyAgent 基於研究結果生成吸引人的標題，而非使用用戶輸入的關鍵字。

#### Scenario: 移除關鍵字優先邏輯

- **WHEN** StrategyAgent 選擇標題
- **THEN** 不直接使用 input.title 作為標題
- **AND** 從 AI 生成的標題選項中選擇最佳標題
- **AND** 生成的標題與用戶輸入的關鍵字不完全相同

#### Scenario: 基於研究結果生成

- **WHEN** StrategyAgent 生成標題選項
- **THEN** 基於 ResearchAgent 的 recommendedStrategy
- **AND** 參考 contentGaps 和 searchIntent
- **AND** 不複述搜索結果的原始標題

#### Scenario: 標題與關鍵字差異化

- **WHEN** 文章生成完成
- **THEN** 文章標題與目標關鍵字不完全相同
- **AND** 標題具有吸引力和 SEO 價值
- **AND** 標題長度適中（15-30 個中文字）

### Requirement: JSON 格式正確輸出

系統 SHALL 確保 AI 返回正確的 JSON 格式，便於解析。

#### Scenario: Prompt 強調 JSON 格式

- **WHEN** StrategyAgent 或 ContentPlanAgent 發送 Prompt
- **THEN** 明確要求「只輸出 JSON，不要包含任何推理文字」
- **AND** 提供正確的 JSON 格式範例

#### Scenario: 增強 JSON 解析

- **WHEN** AI 返回內容需要解析為 JSON
- **THEN** 系統嘗試多種解析策略：
  1. 直接解析完整內容
  2. 提取 `{...}` JSON 區塊
  3. 提取 `[...]` JSON 陣列
- **AND** 任一策略成功即視為解析成功

#### Scenario: JSON 解析失敗處理

- **WHEN** 所有 JSON 解析策略都失敗
- **THEN** 系統記錄詳細錯誤日誌
- **AND** 使用 fallback 策略生成預設標題
- **AND** 不中斷文章生成流程
