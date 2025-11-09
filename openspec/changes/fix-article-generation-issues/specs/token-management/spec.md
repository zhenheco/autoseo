# Token Management Specification

## ADDED Requirements

### Requirement: 即時 Token 扣除
系統 SHALL 在每次 AI 模型呼叫後立即扣除相應的 token 數量。

#### Scenario: AI 呼叫後扣除
- **WHEN** ResearchAgent、StrategyAgent、WritingAgent 等任何 Agent 完成 AI 呼叫
- **THEN** 系統計算實際使用的 token 數（input + output）
- **AND** 立即從資料庫中扣除對應的 token 數量
- **AND** 更新 `token_usage` 記錄

#### Scenario: 批次扣除
- **WHEN** 多個 Agent 並行執行（如 WritingAgent 和 ImageAgent）
- **THEN** 系統等待所有 Agent 完成
- **AND** 批次扣除所有使用的 token
- **AND** 確保資料庫只更新一次，避免競爭條件

#### Scenario: 扣除失敗回滾
- **WHEN** Token 扣除操作失敗
- **THEN** 系統記錄錯誤但不影響文章生成
- **OR** 如果 token 不足，提前中止生成流程並通知用戶

### Requirement: Token 計數準確性
系統 SHALL 準確計算和記錄每次 AI 呼叫的 token 使用量。

#### Scenario: 準確計算 Input/Output Tokens
- **WHEN** AI 模型回應包含 token 使用資訊
- **THEN** 系統擷取 `usage.prompt_tokens` 和 `usage.completion_tokens`
- **AND** 計算總使用量 = prompt_tokens + completion_tokens
- **AND** 將數據記錄到 `token_usage` 表

#### Scenario: 缺少 Token 資訊
- **WHEN** AI 回應不包含 token 使用資訊
- **THEN** 系統使用 tiktoken 或類似工具估算 token 數量
- **AND** 在記錄中標記為「估算值」

### Requirement: 前端 Token 顯示同步
系統 SHALL 確保前端顯示的 token 餘額與資料庫狀態同步。

#### Scenario: 即時更新前端顯示
- **WHEN** 資料庫中的 token 數量更新
- **THEN** 前端通過 API 或 WebSocket 獲取最新數據
- **AND** 更新用戶界面顯示的 token 餘額
- **AND** 顯示值與資料庫一致

#### Scenario: 生成過程中的顯示
- **WHEN** 文章生成正在進行中
- **THEN** 前端定期（每 2-5 秒）查詢 token 餘額
- **AND** 顯示即時的 token 消耗情況
- **AND** 在生成完成後顯示總消耗量

#### Scenario: 多用戶環境
- **WHEN** 同一公司有多個用戶同時生成文章
- **THEN** 系統確保 token 扣除不會重複或遺漏
- **AND** 每個用戶看到的是公司層級的 token 餘額
- **AND** 使用資料庫鎖定或事務確保一致性

### Requirement: Token 使用審計
系統 SHALL 記錄所有 token 使用的詳細資訊，用於審計和分析。

#### Scenario: 詳細使用記錄
- **WHEN** 任何 Agent 使用 token
- **THEN** 系統記錄以下資訊：
  - Agent 名稱和類型
  - 使用的 AI 模型
  - Input tokens 和 Output tokens
  - 時間戳
  - 相關的 article_job_id
- **AND** 資料可供後續查詢和報表

#### Scenario: 異常使用偵測
- **WHEN** Token 使用量異常高（如單次超過 50000 tokens）
- **THEN** 系統記錄警告訊息
- **AND** 可選：通知管理員
