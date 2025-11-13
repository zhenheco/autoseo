# StrategyAgent JSON Parser 增強

## MODIFIED Requirements

### Requirement: JSON Parser 必須嘗試多種提取方法
**ID**: `strategy-agent-multi-parser`
**Priority**: High
**Component**: StrategyAgent

StrategyAgent 的 JSON Parser **MUST** 依序嘗試多種提取方法，直到成功解析或回退到 fallback outline。

#### Scenario: 依序嘗試多種 Parser

**Given** AI 回應的格式不確定
**When** 嘗試解析 outline JSON
**Then** 應該依序嘗試以下方法：
  1. DirectJSONParser（直接 JSON.parse）
  2. NestedJSONParser（提取 {...} 內容）
  3. MarkdownCodeBlockParser（提取 ```json...``` 代碼塊）
  4. MarkdownStructuredParser（解析 Markdown 結構）
  5. FallbackOutline（回退方案）
**And** 只要任一 Parser 成功，應立即返回結果
**And** 所有 Parser 都失敗時，使用 FallbackOutline

#### Scenario: Parser 失敗時提供詳細日誌

**Given** 某個 Parser 嘗試解析失敗
**When** Parser 拋出錯誤或返回 null
**Then** 系統應該記錄：
  - Parser 名稱
  - 失敗原因
  - AI 回應的前 200 字元
**And** 繼續嘗試下一個 Parser
**And** 不應中斷整個處理流程

## ADDED Requirements

### Requirement: 增加 Markdown 代碼塊 Parser
**ID**: `strategy-agent-markdown-parser`
**Priority**: Medium
**Component**: StrategyAgent

系統 **SHALL** 新增一個 Parser 專門處理 AI 在 JSON 外包裹 Markdown 代碼塊的情況（如 ```json...```）。

#### Scenario: 解析 Markdown JSON 代碼塊

**Given** AI 回應格式為 "```json\n{...}\n```"
**When** 執行 MarkdownCodeBlockParser
**Then** 應該正確提取 {...} 內容
**And** 解析為有效的 JSON 物件
**And** 返回包含 mainSections 的 outline

#### Scenario: 處理多種代碼塊標記

**Given** AI 使用不同的代碼塊標記（```json, ```JSON, ```）
**When** 執行 MarkdownCodeBlockParser
**Then** 應該能夠識別並提取所有變體
**And** 解析為有效的 JSON 物件

### Requirement: 改進 AI Prompt 以減少解析失敗
**ID**: `strategy-agent-better-prompt`
**Priority**: High
**Component**: StrategyAgent

AI Prompt **MUST** 明確指示輸出格式，減少需要複雜 Parser 的情況。

#### Scenario: Prompt 明確要求純 JSON 輸出

**Given** 系統需要生成 outline
**When** 構建 AI Prompt
**Then** Prompt 應該包含以下指示：
  - "請直接輸出 JSON，不要包含任何額外說明"
  - "不要使用 Markdown 代碼塊"
  - "輸出必須以 { 開頭，以 } 結尾"
  - 提供正確和錯誤輸出的範例
**And** 使用 `format: 'json'` 參數提示 AI

#### Scenario: Prompt 提供明確的 JSON Schema

**Given** 系統需要生成 outline
**When** 構建 AI Prompt
**Then** Prompt 應該包含完整的 JSON Schema 範例
**And** Schema 應該包含所有必要欄位
**And** 每個欄位應該有清楚的說明和範例值

### Requirement: 增強錯誤日誌以利診斷
**ID**: `strategy-agent-better-logging`
**Priority**: Medium
**Component**: StrategyAgent

Parser **SHALL** 記錄詳細的診斷資訊，幫助開發者理解失敗原因。

#### Scenario: 記錄 AI 回應摘要

**Given** Parser 開始處理 AI 回應
**When** 開始解析過程
**Then** 應該記錄：
  - 回應總長度
  - 前 200 字元
  - 後 200 字元
  - 是否包含 JSON 標記（{ 和 }）
  - 是否包含 Markdown 標記
**And** 日誌應該使用一致的前綴 `[StrategyAgent]`

#### Scenario: 記錄每個 Parser 的嘗試結果

**Given** 依序執行多個 Parser
**When** 每個 Parser 完成執行
**Then** 應該記錄：
  - Parser 名稱
  - 成功或失敗狀態
  - 如果成功，記錄 mainSections 數量
  - 如果失敗，記錄錯誤原因
**And** 使用視覺化符號（✅ 成功，⚠️ 警告，❌ 失敗）
