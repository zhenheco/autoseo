# token-billing Specification

## Purpose
TBD - created by archiving change implement-idempotent-token-billing. Update Purpose after archive.
## Requirements
### Requirement: Implement idempotent token deduction

Token 扣款操作 **MUST** 實作冪等性（idempotency），確保相同的請求不會導致重複扣款，即使發生網路重試或系統錯誤也能保證「至多一次」的扣款保證。

#### Scenario: System prevents duplicate deductions using idempotency keys

**Given** 文章任務已建立（article_job_id = "abc-123"）
**And** 系統將 article_job_id 作為 idempotency_key
**When** 文章生成完成，觸發 Token 扣款
**And** 因網路問題導致請求重試
**Then** 系統 **MUST** 檢查 `token_deduction_records` 表中是否存在相同的 idempotency_key
**And** 如果已存在 `status = 'completed'` 的記錄，返回先前的扣款結果（不重複扣款）
**And** 如果已存在 `status = 'pending'` 的記錄，拒絕請求並返回「處理中」錯誤
**And** 如果已存在 `status = 'failed'` 的記錄，允許重試
**And** 如果不存在記錄，建立新的 `status = 'pending'` 記錄並執行扣款

#### Scenario: System returns original result for duplicate requests

**Given** 文章生成完成後已成功扣款 500 tokens
**And** 扣款記錄（idempotency_key = "job-123"）狀態為 'completed'
**And** 扣款後餘額為 9,500 tokens
**When** 同樣的請求再次調用（使用相同的 idempotency_key）
**Then** 系統 **MUST** 返回原始的扣款結果
**And** 返回結果包含 `idempotent: true` 標記
**And** 返回的 `balance_after` 為 9,500（與原始結果相同）
**And** 公司實際餘額保持 9,500（未再次扣款）
**And** 不應拋出錯誤或建立新的扣款記錄

#### Scenario: System rejects concurrent requests with same idempotency key

**Given** 第一個扣款請求正在處理中（狀態為 'pending'）
**And** idempotency_key = "job-456"
**When** 同時收到第二個請求（使用相同的 idempotency_key）
**Then** 系統 **MUST** 拒絕第二個請求
**And** 返回 `DeductionInProgressError` 錯誤
**And** 錯誤訊息應包含「扣款正在處理中，請稍後再試」
**And** 不應建立新的扣款記錄
**And** 第一個請求應繼續正常處理

### Requirement: Use database transaction for atomic deduction

Token 扣款操作 **MUST** 在資料庫事務中執行，確保扣款和餘額更新的原子性，任何步驟失敗都會回滾整個操作。

#### Scenario: System uses database transaction for atomic deduction

**Given** 系統準備扣除 500 tokens
**When** 執行扣款操作
**Then** 系統 **MUST** 在資料庫事務（transaction）中執行以下操作：
  1. 使用 `SELECT ... FOR UPDATE` 鎖定公司訂閱記錄（防止併發扣款）
  2. 檢查當前餘額是否足夠
  3. 更新 `monthly_quota_balance` 和/或 `purchased_token_balance`
  4. 插入 `token_usage_logs` 記錄
  5. 更新 `token_deduction_records.status` 為 'completed'
**And** 如果任何步驟失敗，**MUST** 回滾整個事務
**And** 確保扣款的原子性（atomicity）

#### Scenario: System rolls back transaction on insufficient balance

**Given** 公司的 Token 餘額為 100
**And** 文章生成預計需要 500 tokens
**When** 執行扣款操作
**And** 在檢查餘額時發現不足
**Then** 系統 **MUST** 回滾整個事務
**And** `token_deduction_records` 狀態應更新為 'failed'
**And** 錯誤訊息應記錄「Insufficient balance: required 500, available 100」
**And** 公司餘額保持 100（未改變）
**And** 不應插入 `token_usage_logs` 記錄
**And** 拋出 `InsufficientBalanceError` 錯誤

#### Scenario: System locks subscription record to prevent concurrent updates

**Given** 兩個文章生成任務同時完成
**And** 兩個任務都嘗試扣款（各 500 tokens）
**And** 公司當前餘額為 600 tokens
**When** 系統處理兩個併發的扣款請求
**Then** 第一個請求 **MUST** 使用 `FOR UPDATE` 鎖定訂閱記錄
**And** 第一個請求成功扣款 500 tokens，餘額變為 100
**And** 第二個請求等待鎖釋放後，檢查餘額發現不足（需要 500，只剩 100）
**And** 第二個請求 **MUST** 失敗並回滾
**And** 最終餘額為 100（只扣款一次）

### Requirement: Implement exponential backoff retry strategy

系統 **MUST** 實作指數退避（exponential backoff）重試策略，對暫時性錯誤自動重試，對永久性錯誤不重試。

#### Scenario: System retries on transient database errors

**Given** Token 扣款因暫時性錯誤失敗（如資料庫連接逾時）
**When** 系統準備重試
**Then** 系統 **MUST** 實作指數退避（exponential backoff）策略
**And** 第一次重試等待 1 秒
**And** 第二次重試等待 2 秒
**And** 第三次重試等待 4 秒
**And** 最多重試 3 次
**And** 每次重試都應記錄日誌（包含 attempt, delay, error message）

#### Scenario: System does not retry on permanent errors

**Given** Token 扣款因餘額不足失敗（永久性錯誤）
**When** 系統接收到 `InsufficientBalanceError`
**Then** 系統 **MUST NOT** 重試
**And** 直接拋出錯誤給調用方
**And** 記錄錯誤日誌
**And** 不應浪費資源重試註定失敗的操作

#### Scenario: System retries successfully after transient error

**Given** 第一次扣款因資料庫連接逾時失敗
**And** 系統配置為最多重試 3 次
**When** 系統執行第二次重試（等待 2 秒後）
**And** 資料庫連接恢復正常
**Then** 第二次重試 **MUST** 成功完成扣款
**And** `token_deduction_records.retry_count` 應記錄為 1
**And** 返回成功結果
**And** 不應執行第三次重試

### Requirement: Track deduction state and audit trail

系統 **MUST** 使用 `token_deduction_records` 表記錄每次扣款的完整狀態，提供詳細的審計追蹤。

#### Scenario: System records deduction state in token_deduction_records

**Given** 文章生成完成並準備扣款
**When** 扣款操作執行
**Then** 系統 **MUST** 在 `token_deduction_records` 表中建立記錄，包含：
  - `id`: UUID 扣款記錄 ID
  - `idempotency_key`: 冪等性金鑰（= article_job_id）
  - `company_id`: 公司 ID
  - `article_id`: 文章 ID
  - `amount`: 扣款數量
  - `status`: 狀態（pending/completed/failed/compensated）
  - `balance_before`: 扣款前餘額
  - `balance_after`: 扣款後餘額（completed 時）
  - `error_message`: 錯誤訊息（failed 時）
  - `retry_count`: 重試次數
  - `created_at`: 建立時間
  - `completed_at`: 完成時間（completed 時）
  - `metadata`: 額外資訊（JSONB，如 deducted_from_monthly, deducted_from_purchased）

#### Scenario: System provides complete audit trail for successful deduction

**Given** 扣款成功完成
**When** 管理員查看 `token_deduction_records` 表
**Then** 記錄 **MUST** 包含：
  - `status = 'completed'`
  - `balance_before`: 扣款前的實際餘額
  - `balance_after`: 扣款後的實際餘額
  - `completed_at`: 扣款完成時間戳
  - `metadata.deducted_from_monthly`: 從月配額扣除的數量
  - `metadata.deducted_from_purchased`: 從購買的 Token 扣除的數量
**And** 記錄 **MUST** 永久保存供審計使用
**And** 應能透過 `idempotency_key` 快速查詢

#### Scenario: System records failure details for failed deduction

**Given** 扣款因錯誤失敗
**When** 管理員查看失敗的扣款記錄
**Then** 記錄 **MUST** 包含：
  - `status = 'failed'`
  - `error_message`: 詳細的錯誤訊息（如「Insufficient balance: required 500, available 100」）
  - `balance_before`: 失敗時的餘額
  - `retry_count`: 嘗試的重試次數
**And** 記錄應包含足夠的資訊供後續除錯和對帳

### Requirement: Reconcile stuck deductions periodically

系統 **MUST** 定期執行對帳任務，處理卡住的 pending 扣款記錄，確保系統最終一致性。

#### Scenario: System reconciles stuck pending deductions

**Given** 系統定期執行對帳任務（每小時）
**When** 對帳任務執行
**Then** 系統 **MUST** 查找所有 `status = 'pending'` 且超過 1 小時的扣款記錄
**And** 對於每筆卡住的記錄：
  - 檢查對應的文章是否存在於 `generated_articles` 表
  - 如果文章存在，重試扣款操作
  - 如果文章不存在，標記扣款為 'failed'
**And** 記錄對帳結果（處理數量、成功數量、失敗數量）
**And** 如果出現異常情況，通知管理員需要人工處理

#### Scenario: System retries deduction for article that exists

**Given** 扣款記錄（idempotency_key = "job-789"）卡在 'pending' 狀態超過 2 小時
**And** 對應的文章（article_id = "article-xyz"）存在於 `generated_articles` 表
**When** 對帳任務執行
**Then** 系統 **MUST** 重新調用扣款函數（使用相同的 idempotency_key）
**And** PostgreSQL 函數會檢測到 pending 狀態並增加 `retry_count`
**And** 如果重試成功，狀態更新為 'completed'
**And** 如果重試失敗，記錄錯誤訊息並保持 'failed' 狀態

#### Scenario: System marks deduction as failed when article does not exist

**Given** 扣款記錄（idempotency_key = "job-999"）卡在 'pending' 狀態超過 3 小時
**And** 對應的文章不存在（可能文章生成失敗）
**When** 對帳任務執行
**Then** 系統 **MUST** 標記扣款為 'failed'
**And** 錯誤訊息應記錄「Article not found, likely generation failed」
**And** 不應扣除 Token（因為文章未成功生成）
**And** 記錄對帳日誌供後續審計

### Requirement: Prevent article generation when token balance is insufficient

系統 **MUST** 在建立文章生成任務前檢查 Token 餘額，避免浪費資源生成無法支付的文章。

#### Scenario: System checks balance before creating article job

**Given** 使用者請求生成文章
**And** 預估生成文章需要 500 tokens
**When** 系統接收到請求
**Then** 系統 **MUST** 在建立 `article_jobs` 記錄前查詢公司的 Token 餘額
**And** 如果餘額 < 500，**MUST** 拒絕請求
**And** 返回 HTTP 402 (Payment Required) 錯誤
**And** 錯誤訊息應包含：
  - 明確說明餘額不足
  - 當前餘額數量
  - 需要的 Token 數量
  - 升級方案連結（`upgradeUrl: '/dashboard/billing/upgrade'`）
**And** 不應建立 `article_jobs` 記錄
**And** 不應觸發 GitHub Actions workflow

#### Scenario: System allows job creation when balance is sufficient

**Given** 使用者的公司有 10,000 tokens 餘額
**And** 預估生成文章需要 500 tokens
**When** 使用者請求生成文章
**Then** 系統 **MUST** 允許建立文章任務
**And** 建立 `article_jobs` 記錄
**And** 觸發 GitHub Actions workflow
**And** 返回 HTTP 200 和任務資訊

#### Scenario: Frontend displays friendly error for insufficient balance

**Given** 使用者嘗試生成文章但餘額不足
**When** API 返回 HTTP 402 錯誤
**Then** 前端 **MUST** 顯示友善的錯誤提示
**And** 錯誤訊息應使用繁體中文
**And** 提供「升級方案」按鈕連結到 `/dashboard/billing/upgrade`
**And** 使用 toast 或 modal 顯示（持續 10 秒或使用者手動關閉）
**And** 不應顯示技術性的錯誤訊息

### Requirement: Update dashboard token balance in real-time

Dashboard **MUST** 即時顯示公司的 Token 餘額，確保使用者了解當前可用額度。

#### Scenario: Dashboard refreshes balance every 5 seconds

**Given** 使用者正在查看 Dashboard
**When** TokenBalanceDisplay 組件載入
**Then** 組件 **MUST** 使用 SWR 每 5 秒自動刷新餘額
**And** 調用 `/api/billing/balance` API 查詢最新餘額
**And** 顯示月配額和購買的 Token 分別（如「月配額: 5,000 | 購買: 2,000 | 總計: 7,000」）
**And** 當餘額更新時，UI 應平滑更新（無閃爍）

#### Scenario: Dashboard warns user when balance is low

**Given** 公司的 Token 餘額 < 1,000
**When** Dashboard 顯示餘額
**Then** 系統 **MUST** 使用紅色文字顯示餘額
**And** 顯示警告圖示
**And** 顯示「升級方案」按鈕（連結到 `/dashboard/billing/upgrade`）
**And** 使用友善的提示訊息「Token 即將用完，請考慮升級方案」

#### Scenario: Balance updates immediately after article generation

**Given** 使用者剛完成一篇文章生成（消耗 500 tokens）
**And** Dashboard 正在顯示
**When** 扣款完成後的下一次刷新（最多 5 秒）
**Then** 顯示的餘額 **MUST** 反映最新的扣款
**And** 餘額應減少 500 tokens
**And** 使用者能即時看到扣款結果

