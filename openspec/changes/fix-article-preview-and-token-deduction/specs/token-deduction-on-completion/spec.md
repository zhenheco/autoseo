# Spec: 文章生成完成後 Token 扣除

## ADDED Requirements

### Requirement: System MUST automatically deduct tokens after article generation completes

當文章生成流程成功完成並儲存到 `generated_articles` 表後，系統 **MUST** 自動扣除該公司的 Token 餘額，扣除量基於實際消耗或預估值。

#### Scenario: 文章生成成功後扣除 Token

**Given** 一個公司的 Token 餘額為 50000
**And** 文章生成任務成功完成
**And** 文章已儲存到 `generated_articles` 表

**When** `ParallelOrchestrator.execute()` 完成

**Then** 應調用 `TokenBillingService.deductTokensIdempotent()`
**And** 使用 `articleJobId` 作為 idempotency key
**And** 扣除量應為實際消耗的 token 數量（或預設 15000）
**And** 公司 Token 餘額應減少相應數量
**And** 應在 `token_usage_logs` 表中建立記錄
**And** 應在 `token_balance_changes` 表中建立記錄

#### Scenario: Token 扣除失敗不阻止文章完成

**Given** 文章生成成功
**And** Token 扣除過程中發生錯誤（例如資料庫連接失敗）

**When** 嘗試扣除 Token

**Then** 錯誤應被捕獲並記錄
**And** 文章狀態仍應更新為 `completed`
**And** 不應回滾文章儲存
**And** 錯誤應記錄到 error tracking 系統
**And** 應在日誌中標記「Token 扣除失敗，需手動補扣」

### Requirement: Idempotency mechanism MUST prevent duplicate token deductions

系統 **MUST** 使用 idempotency key 機制確保同一篇文章即使重試多次，也只扣除一次 Token。

#### Scenario: 同一文章重複執行不重複扣除

**Given** 文章 A 已成功生成並扣除 15000 tokens
**And** 該文章的 idempotency key 為 `article-generation-{articleJobId}`

**When** 由於某種原因（如系統重試）再次執行同一 `articleJobId` 的生成流程

**Then** `deductTokensIdempotent()` 應識別出這是重複請求
**And** 不應再次扣除 Token
**And** 應返回 `{ idempotent: true }` 標記
**And** 原有的 Token 餘額不應改變

#### Scenario: 不同文章正常扣除

**Given** 已生成文章 A（扣除 15000 tokens）
**And** 現在生成文章 B（不同的 articleJobId）

**When** 文章 B 生成完成並嘗試扣除 Token

**Then** 應正常扣除 15000 tokens
**And** idempotency check 應識別出這是新請求
**And** Token 餘額應再次減少

### Requirement: Token usage MUST be logged to database

每次成功扣除 Token 時，系統 **MUST** 在 `token_usage_logs` 表中建立詳細記錄，包含模型資訊、文章 ID、消耗量等。

#### Scenario: Token 使用記錄完整性

**Given** 文章生成完成並扣除 15000 tokens

**When** 扣除成功

**Then** 應在 `token_usage_logs` 表中插入一筆記錄
**And** 記錄應包含 `company_id`
**And** 記錄應包含 `article_id`
**And** 記錄應包含 `charged_tokens = 15000`
**And** 記錄應包含 `usage_type = 'article_generation'`
**And** 記錄應包含 `model_name` 資訊
**And** 記錄應包含 `created_at` 時間戳記

#### Scenario: 餘額變更記錄到 token_balance_changes

**Given** 文章生成完成並扣除 15000 tokens
**And** 扣除前餘額為 50000

**When** 扣除成功

**Then** 應在 `token_balance_changes` 表中插入一筆記錄
**And** 記錄應包含 `change_type = 'usage'`
**And** 記錄應包含 `amount = -15000`
**And** 記錄應包含 `balance_before = 50000`
**And** 記錄應包含 `balance_after = 35000`
**And** 記錄應包含 `idempotency_key`
**And** 記錄應包含 `description` 說明

## MODIFIED Requirements

### Requirement: ParallelOrchestrator MUST integrate token deduction logic

`ParallelOrchestrator.execute()` 方法 **MUST** 在文章生成完成後調用 Token 扣除服務。

#### Scenario: Orchestrator 成功整合 Token 扣除

**Given** ParallelOrchestrator 正在執行文章生成

**When** 所有 agents 完成並儲存文章

**Then** 應初始化 `TokenBillingService`
**And** 應調用 `deductTokensIdempotent()` 方法
**And** 應傳遞正確的參數（companyId, articleId, amount, idempotency key）
**And** 應等待扣除完成（或捕獲錯誤）
**And** 最後才更新 job status 為 `completed`

#### Scenario: 扣除邏輯不影響現有錯誤處理

**Given** Orchestrator 的錯誤追蹤機制已存在
**And** Token 扣除邏輯已整合

**When** 文章生成過程中發生錯誤

**Then** 現有的錯誤處理流程應正常運作
**And** Token 不應扣除（因為文章未完成）
**And** job status 應更新為 `failed`
**And** 錯誤應記錄到 error tracker
