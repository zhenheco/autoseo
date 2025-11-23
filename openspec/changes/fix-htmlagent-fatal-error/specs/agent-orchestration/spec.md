# Agent Orchestration - Spec Delta

## ADDED Requirements

### Requirement: Agent 模型配置可觀察性

系統 SHALL 在執行文章生成流程時記錄所有 Agent 使用的 AI 模型，確保配置正確且可追蹤。

#### Scenario: 記錄完整模型配置

- **GIVEN** Orchestrator 準備執行文章生成
- **WHEN** 在 `execute` 方法開始時
- **THEN** 系統 SHALL 記錄 "Agent Models Configuration" 日誌（INFO 級別），包含：
  - `research_model`: ResearchAgent 使用的模型名稱
  - `strategy_model`: StrategyAgent 使用的模型名稱
  - `writing_model`: WritingAgent 使用的模型名稱
  - `meta_model`: MetaAgent 使用的模型名稱
  - `image_model`: ImageAgent 使用的模型名稱

#### Scenario: MetaAgent 模型配置優先順序

- **GIVEN** 系統配置可能來自多個來源（資料庫 `agent_configs`, 環境變數, 代碼預設）
- **WHEN** 決定 MetaAgent 使用的模型
- **THEN** 系統 SHALL 按以下優先順序選擇：
  1. `agentConfig.meta_model`（如果存在）
  2. `agentConfig.simple_processing_model`（如果 meta_model 為空）
  3. `'deepseek-chat'`（預設值）
- **AND** 記錄最終選擇的模型名稱

#### Scenario: 檢測意外的模型使用

- **GIVEN** 日誌已記錄模型配置
- **WHEN** 運維人員或監控系統檢查日誌
- **THEN** 應能快速識別是否有 Agent 使用非預期的模型（如 `gpt-3.5-turbo`, `gpt-4`）
- **AND** 如有異常，可追溯到具體的 Agent 和請求

#### Scenario: 模型配置與成本關聯

- **GIVEN** 系統使用不同成本的模型（DeepSeek < GPT-3.5 < GPT-4）
- **WHEN** 記錄模型配置日誌
- **THEN** 運維人員應能根據日誌計算預期成本
- **AND** 監控實際成本是否與配置一致

### Requirement: Agent 配置驗證

系統 SHALL 確保 Agent 配置來自正確的來源，避免硬編碼或錯誤配置。

#### Scenario: 禁止硬編碼昂貴模型

- **GIVEN** 代碼庫中可能存在硬編碼的模型名稱
- **WHEN** 開發人員進行代碼審查或靜態分析
- **THEN** 應能搜尋並移除任何硬編碼的 `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo` 等昂貴模型
- **AND** 確保所有模型配置來自 `agent_configs` 表或環境變數

#### Scenario: 資料庫配置優先

- **GIVEN** `agent_configs` 表包含特定 website 的模型配置
- **WHEN** Orchestrator 初始化 Agents
- **THEN** 系統 SHALL 優先使用資料庫中的配置
- **AND** 僅在資料庫配置缺失時使用代碼預設值

#### Scenario: 模型配置變更的即時生效

- **GIVEN** 運維人員更新 `agent_configs` 表中的 `meta_model` 或其他模型配置
- **WHEN** 新的文章生成請求到達
- **THEN** 系統 SHALL 讀取最新的資料庫配置
- **AND** 使用更新後的模型
- **AND** 無需重啟服務或重新部署

### Requirement: 錯誤處理與流程韌性

系統 SHALL 確保單一 Agent 失敗不會導致整個文章生成流程中斷。

#### Scenario: Agent 執行失敗的隔離

- **GIVEN** 某個 Agent（如 HTMLAgent）執行失敗
- **WHEN** Orchestrator 捕獲該錯誤
- **THEN** 系統 SHALL 記錄詳細錯誤（包含 Agent 名稱、錯誤訊息、堆疊）
- **AND** 評估是否可以繼續流程（如 HTMLAgent 失敗但已有基本 HTML）
- **AND** 如果可以繼續，使用降級版本的輸出（如未優化的 HTML）

#### Scenario: 關鍵 Agent 失敗時中止流程

- **GIVEN** 關鍵 Agent（如 WritingAgent）完全失敗
- **WHEN** 無法產生必要的輸出（如文章內容）
- **THEN** 系統 SHALL 中止流程
- **AND** 返回明確的錯誤訊息給用戶
- **AND** 不儲存不完整的文章到資料庫

#### Scenario: 非關鍵 Agent 失敗時繼續

- **GIVEN** 非關鍵 Agent（如 HTMLAgent 的 FAQ Schema 功能）失敗
- **WHEN** 仍有可用的基本輸出
- **THEN** 系統 SHALL 繼續流程
- **AND** 儲存文章（即使缺少部分優化）
- **AND** 記錄警告，供後續改進

### Requirement: 流程執行時間監控

系統 SHALL 記錄每個 Agent 的執行時間，協助性能優化和問題診斷。

#### Scenario: 記錄 Agent 執行時長

- **GIVEN** Orchestrator 執行文章生成流程
- **WHEN** 每個 Agent 完成執行
- **THEN** 系統 SHALL 記錄該 Agent 的執行時間（毫秒）
- **AND** 包含 Agent 名稱和請求 ID

#### Scenario: 識別性能瓶頸

- **GIVEN** 某個 Agent 執行時間異常長（如 >10 秒）
- **WHEN** 檢查日誌
- **THEN** 運維人員應能快速識別該 Agent
- **AND** 進行針對性的性能優化

#### Scenario: 總流程時間統計

- **GIVEN** 文章生成流程完成
- **WHEN** 記錄最終日誌
- **THEN** 系統 SHALL 記錄總執行時間
- **AND** 包含各 Agent 時間的摘要（可選）
