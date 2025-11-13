# Agent Orchestration

## MODIFIED Requirements

### Requirement: Multi-Agent Coordination
系統 SHALL 協調多個 agent 的執行順序、並行策略和資料傳遞。

**修改說明**：從單一 WritingAgent 改為協調多個專門 agent，支援分批並行執行和完整的錯誤追蹤。

#### Scenario: Feature Flag 控制系統選擇
- **GIVEN** 環境變數 `USE_MULTI_AGENT_ARCHITECTURE` 已設定
- **WHEN** Orchestrator 開始執行文章生成
- **THEN** SHALL 根據 Feature Flag 決定使用多 agent 系統或舊 WritingAgent 系統
- **AND** 如果 `USE_MULTI_AGENT_ARCHITECTURE=false`，SHALL 使用舊系統
- **AND** 如果 `USE_MULTI_AGENT_ARCHITECTURE=true`，SHALL 檢查 rollout percentage

#### Scenario: A/B 測試分流
- **GIVEN** `MULTI_AGENT_ROLLOUT_PERCENTAGE` 設定為小於 100 的值（如 10, 50）
- **WHEN** Orchestrator 決定使用哪個系統
- **THEN** SHALL 基於 articleJobId 的 hash 值計算 bucket（0-99）
- **AND** 如果 bucket < rolloutPercentage，SHALL 使用多 agent 系統
- **AND** 如果 bucket >= rolloutPercentage，SHALL 使用舊系統
- **AND** 同一個 articleJobId SHALL 始終被分配到同一個系統（保證一致性）

#### Scenario: 分批並行執行策略
- **GIVEN** 多 agent 系統已啟用
- **WHEN** Orchestrator 執行內容生成階段
- **THEN** Batch 1（IntroductionAgent, ConclusionAgent, QAAgent）SHALL 並行執行
- **AND** SHALL 使用 `Promise.all()` 等待所有 Batch 1 agent 完成
- **AND** Batch 2（SectionAgent ×N）SHALL 在 Batch 1 完成後順序執行
- **AND** 每個 batch 的執行時間 SHALL 被記錄用於效能分析

#### Scenario: Agent 間資料傳遞
- **GIVEN** 某個 agent 需要前序 agent 的輸出
- **WHEN** Orchestrator 調用該 agent
- **THEN** SHALL 確保所有依賴的 agent 已成功執行
- **AND** SHALL 傳遞完整且正確的資料結構
- **AND** 如果依賴的 agent 失敗，SHALL 中斷流程或使用 fallback

#### Scenario: 最終 Fallback 機制
- **GIVEN** 多 agent 系統執行過程中發生無法恢復的錯誤
- **WHEN** Orchestrator 捕獲到錯誤
- **THEN** SHALL 記錄錯誤詳情（agent 名稱、錯誤訊息、上下文）
- **AND** SHALL 呼叫 ErrorTracker.trackFallback()
- **AND** SHALL 切換到舊 WritingAgent 系統重新執行
- **AND** SHALL 返回舊系統的結果（確保用戶總能得到文章）

## ADDED Requirements

### Requirement: Retry Mechanism with Exponential Backoff
系統 SHALL 為每個 agent 提供可配置的重試機制。

#### Scenario: 可重試錯誤自動重試
- **GIVEN** 某個 agent 執行失敗且錯誤類型在 `retryableErrors` 列表中
- **WHEN** Orchestrator 檢測到錯誤
- **THEN** SHALL 檢查當前嘗試次數是否小於 `maxAttempts`
- **AND** 如果可以重試，SHALL 等待 `currentDelay` 毫秒後重試
- **AND** `currentDelay` SHALL 使用 exponential backoff 計算：`min(initialDelay * (backoffMultiplier ^ attempt), maxDelay)`
- **AND** SHALL 記錄重試資訊到 ErrorTracker

#### Scenario: 不可重試錯誤立即失敗
- **GIVEN** 某個 agent 執行失敗且錯誤類型不在 `retryableErrors` 列表中
- **WHEN** Orchestrator 檢測到錯誤
- **THEN** SHALL 立即拋出錯誤，不進行重試
- **AND** SHALL 記錄錯誤到 ErrorTracker
- **AND** 錯誤類型範例：ValidationError, LogicError（通常重試無意義）

#### Scenario: 達到最大重試次數後失敗
- **GIVEN** 某個 agent 已重試 `maxAttempts` 次仍失敗
- **WHEN** 最後一次嘗試失敗
- **THEN** SHALL 記錄錯誤到 ErrorTracker（severity: ERROR）
- **AND** SHALL 拋出錯誤給上層處理
- **AND** 錯誤訊息 SHALL 包含所有嘗試次數和最後的錯誤詳情

#### Scenario: 重試時調整參數
- **GIVEN** 某個 agent 配置了 `shouldAdjustParams: true` 和 `paramAdjustment` 函數
- **WHEN** 第二次或後續重試時
- **THEN** SHALL 呼叫 `paramAdjustment(attemptNumber)` 獲取參數調整
- **AND** SHALL 將調整應用到下一次執行（如增加 temperature）
- **AND** SHALL 記錄參數調整資訊

#### Scenario: Agent 執行超時處理
- **GIVEN** 某個 agent 配置了 `timeoutMs`
- **WHEN** 執行時間超過 `timeoutMs`
- **THEN** SHALL 取消執行並拋出 TimeoutError
- **AND** SHALL 將 TimeoutError 視為可重試錯誤（如果在 retryableErrors 中）
- **AND** SHALL 記錄超時事件到 ErrorTracker

### Requirement: Structured Error Tracking
系統 SHALL 追蹤和記錄所有 agent 的執行結果、錯誤和統計資訊。

#### Scenario: 追蹤 Agent 執行錯誤
- **GIVEN** 某個 agent 執行失敗
- **WHEN** Orchestrator 捕獲錯誤
- **THEN** ErrorTracker SHALL 記錄錯誤，包含：
  - 唯一錯誤 ID
  - 錯誤分類（network, ai_api, timeout, rate_limit, parsing, validation, logic, unknown）
  - 錯誤嚴重性（info, warning, error, critical）
  - 錯誤訊息和 stack trace
  - 上下文資訊（agentName, attemptNumber, maxAttempts, timestamp, articleJobId, userId, companyId）
- **AND** SHALL 根據錯誤類型和嘗試次數決定嚴重性

#### Scenario: 追蹤 Agent 成功執行
- **GIVEN** 某個 agent 成功執行
- **WHEN** 返回結果
- **THEN** ErrorTracker SHALL 記錄成功事件
- **AND** 如果是重試後成功（attemptNumber > 1），SHALL 記錄詳細日誌
- **AND** SHALL 更新該 agent 的成功計數器

#### Scenario: 錯誤分類自動判斷
- **GIVEN** 捕獲到一個錯誤
- **WHEN** ErrorTracker 分析錯誤
- **THEN** SHALL 根據錯誤碼（如 ETIMEDOUT, ECONNRESET）或錯誤訊息內容分類
- **AND** 分類規則：
  - `ETIMEDOUT` 或 message 包含 "timeout" → TIMEOUT
  - `ECONNRESET` → NETWORK
  - message 包含 "rate_limit" → RATE_LIMIT
  - message 包含 "parse" 或 "json" → PARSING
  - message 包含 "validation" → VALIDATION
  - message 包含 "model" 或 "api" → AI_API
  - 其他 → UNKNOWN

#### Scenario: 錯誤嚴重性自動判斷
- **GIVEN** 已分類的錯誤
- **WHEN** 決定嚴重性
- **THEN** SHALL 根據以下規則：
  - 最後一次嘗試失敗 → ERROR
  - Rate limit 或 Network 錯誤（可重試）→ WARNING
  - Timeout 錯誤 → WARNING
  - 第一次嘗試失敗 → INFO（可能是暫時性問題）
  - 其他情況 → WARNING

#### Scenario: 提供錯誤統計資訊
- **GIVEN** ErrorTracker 已記錄多個錯誤和成功事件
- **WHEN** 請求統計資訊（`errorTracker.getStats()`）
- **THEN** SHALL 返回：
  - 總錯誤數
  - 按分類（category）的錯誤數
  - 按嚴重性（severity）的錯誤數
  - 按 agent 的錯誤數
  - 每個 agent 的成功率（百分比）

#### Scenario: 記憶體中的錯誤數量限制
- **GIVEN** ErrorTracker 配置了 `maxErrorsInMemory`（如 1000）
- **WHEN** 記錄的錯誤數超過限制
- **THEN** SHALL 移除最舊的錯誤（FIFO）
- **AND** 計數器和統計資訊 SHALL 保持準確（不受影響）

#### Scenario: 外部錯誤追蹤服務整合
- **GIVEN** 環境變數 `ERROR_TRACKING_ENABLED=true` 且配置了外部服務（如 Sentry）
- **WHEN** 記錄 ERROR 或 CRITICAL 級別的錯誤
- **THEN** SHALL 發送錯誤到外部追蹤服務
- **AND** SHALL 包含完整的上下文和 tags
- **AND** 如果外部服務發送失敗，SHALL 不影響主流程（只記錄 warning）

### Requirement: Retry Configuration Management
系統 SHALL 為不同的 agent 提供獨立且可配置的重試策略。

#### Scenario: 關鍵 Agent 更多重試次數
- **GIVEN** StrategyAgent 是最關鍵的 agent（沒有 outline 無法繼續）
- **WHEN** 配置重試策略
- **THEN** StrategyAgent SHALL 有最多的重試次數（maxAttempts: 5）
- **AND** 其他內容 agent SHALL 有標準重試次數（maxAttempts: 3）

#### Scenario: 圖片生成特殊重試配置
- **GIVEN** ImageAgent 可能遇到 content_policy_violation 錯誤
- **WHEN** 配置重試策略
- **THEN** SHALL 包含 'content_policy_violation' 在 retryableErrors 中
- **AND** SHALL 配置 `paramAdjustment` 在重試時降低圖片品質（hd → standard）
- **AND** 初始延遲 SHALL 更長（5000ms，因為圖片生成較慢）

#### Scenario: 組合 Agent 較少重試
- **GIVEN** ContentAssemblerAgent 和 HTMLAgent 主要做邏輯處理（非 AI 調用）
- **WHEN** 配置重試策略
- **THEN** maxAttempts SHALL 設定為 2（較少）
- **AND** retryableErrors SHALL 為空陣列（邏輯錯誤通常重試無意義）
- **AND** 超時時間 SHALL 較短（30000ms）

#### Scenario: 從環境變數覆蓋預設配置
- **GIVEN** 環境變數設定了 `AGENT_RETRY_MAX_ATTEMPTS`, `AGENT_RETRY_INITIAL_DELAY_MS` 等
- **WHEN** 初始化 RetryConfig
- **THEN** SHALL 使用環境變數的值覆蓋預設值（如果存在）
- **AND** 如果環境變數未設定或無效，SHALL 使用預設值
- **AND** SHALL 記錄使用的配置（debug 模式）
