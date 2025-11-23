# Token Billing and Deduction

## MODIFIED Requirements

### Requirement: Deduct tokens after article generation

文章生成成功後，系統 **MUST** 從公司的 Token 餘額中扣除實際使用的 Token 數量，確保計費系統正常運作。

#### Scenario: System deducts tokens after successful article generation

**Given** 使用者的公司有足夠的 Token 餘額（例如 10,000 tokens）
**And** 使用者請求生成一篇文章
**When** 文章生成成功完成
**And** 文章使用了 500 tokens（包含 research、writing、meta 等所有 AI 操作）
**Then** 系統應從公司的 Token 餘額扣除 500 tokens
**And** 公司的 `monthly_quota_balance` 或 `purchased_token_balance` 應更新為 9,500
**And** 系統應記錄一筆 Token 使用日誌到 `token_usage_logs` 表
**And** Dashboard 顯示的 Token 餘額應即時更新為 9,500

#### Scenario: System prevents article generation when token balance is insufficient

**Given** 使用者的公司 Token 餘額只有 100 tokens
**And** 預估生成文章需要 500 tokens
**When** 使用者請求生成文章
**Then** 系統應拒絕請求
**And** 返回 HTTP 402 或 403 錯誤
**And** 錯誤訊息應明確說明「Token 餘額不足，請升級方案或購買 Token」
**And** 不應建立 `article_jobs` 記錄
**And** 不應觸發 GitHub Actions workflow

#### Scenario: System records token usage logs for audit

**Given** 文章生成成功
**And** 系統已扣除 Token
**When** 管理員查看 Token 使用記錄
**Then** `token_usage_logs` 表應包含以下資訊：

- `company_id`: 公司 ID
- `user_id`: 觸發生成的使用者 ID
- `article_id`: 生成的文章 ID（如果有）
- `token_amount`: 扣除的 Token 數量
- `usage_type`: 使用類型（例如 `article_generation`）
- `model_name`: 使用的 AI 模型名稱
- `created_at`: 扣款時間戳
  **And** 記錄應包含足夠的詳細資訊供後續審計和除錯

#### Scenario: System handles token deduction failures gracefully

**Given** 文章生成成功
**When** Token 扣款過程中發生錯誤（例如資料庫更新失敗）
**Then** 系統應記錄錯誤日誌
**And** 應重試扣款操作（最多 3 次）
**Or** 標記該文章任務為「待補扣款」狀態
**And** 不應讓使用者無限制使用 Token
**And** 應通知管理員進行人工處理

## ADDED Requirements

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

#### Scenario: System uses database transaction for atomic deduction

**Given** 系統準備扣除 Token
**When** 執行扣款操作
**Then** 系統 **MUST** 在資料庫事務（transaction）中執行以下操作：

1. 使用 `SELECT ... FOR UPDATE` 鎖定公司訂閱記錄（防止併發扣款）
2. 檢查當前餘額是否足夠
3. 更新 `monthly_quota_balance` 和/或 `purchased_token_balance`
4. 插入 `token_usage_logs` 記錄
5. 更新 `token_deduction_records.status` 為 'completed'
   **And** 如果任何步驟失敗，**MUST** 回滾整個事務
   **And** 確保扣款的原子性（atomicity）

#### Scenario: System implements exponential backoff retry strategy

**Given** Token 扣款因暫時性錯誤失敗（如資料庫連接逾時）
**When** 系統準備重試
**Then** 系統 **MUST** 實作指數退避（exponential backoff）策略
**And** 第一次重試等待 1 秒
**And** 第二次重試等待 2 秒
**And** 第三次重試等待 4 秒
**And** 最多重試 3 次
**And** 如果錯誤是永久性的（如餘額不足），**MUST NOT** 重試
**And** 如果所有重試都失敗，標記為 'failed' 並記錄錯誤

#### Scenario: System reconciles stuck deductions periodically

**Given** 系統定期執行對帳任務（每小時）
**When** 對帳任務執行
**Then** 系統 **MUST** 查找所有 `status = 'pending'` 且超過 1 小時的扣款記錄
**And** 對於每筆卡住的記錄：

- 檢查對應的文章是否存在於 `generated_articles` 表
- 如果文章存在，重試扣款操作
- 如果文章不存在，標記扣款為 'failed'
  **And** 記錄對帳結果和異常情況
  **And** 通知管理員需要人工處理的案例

#### Scenario: System provides detailed audit trail

**Given** Token 扣款已完成或失敗
**When** 管理員查看審計日誌
**Then** `token_deduction_records` 表 **MUST** 包含：

- `id`: 扣款記錄 UUID
- `idempotency_key`: 冪等性金鑰（= article_job_id）
- `company_id`: 公司 ID
- `article_id`: 文章 ID（可為 null）
- `amount`: 扣款數量
- `status`: 狀態（pending/completed/failed/compensated）
- `balance_before`: 扣款前餘額
- `balance_after`: 扣款後餘額（completed 時）
- `error_message`: 錯誤訊息（failed 時）
- `retry_count`: 重試次數
- `created_at`: 建立時間
- `completed_at`: 完成時間（completed 時）
  **And** 記錄 **MUST** 永久保存供審計使用

## REMOVED Requirements

### Requirement: Remove batch clear pending jobs functionality

系統應移除「清除進行中任務」的批次操作功能，因為此功能無法正常運作且誤導使用者。

#### Scenario: Batch clear button is removed from article list page

**Given** 使用者查看文章列表頁面
**When** 頁面載入完成
**Then** 不應顯示「清除進行中任務」或「Clear pending jobs」按鈕
**And** 不應有任何批次操作 UI 元素

#### Scenario: Batch clear API endpoint is removed

**Given** 系統已移除批次清除功能
**When** 有請求嘗試訪問 `/api/articles/jobs/clear` 端點
**Then** 應返回 HTTP 404 Not Found
**Or** 端點完全不存在（路由已刪除）

**移除原因**：批次清除功能無法正確識別和刪除 pending 狀態的任務，導致顯示「已清除 0 個任務」，誤導使用者以為功能正常但實際無效。為避免混淆，完全移除此功能。
