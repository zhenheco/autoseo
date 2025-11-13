# GitHub Actions 環境變數處理

## MODIFIED Requirements

### Requirement: 環境變數必須自動清理換行符
**ID**: `github-actions-env-cleanup`
**Priority**: High
**Component**: GitHub Actions Workflows

環境變數在傳遞給應用程式之前，**MUST** 自動移除所有換行符（`\n` 和 `\r`），確保驗證步驟能夠正確通過。

#### Scenario: 環境變數包含換行符時自動清理

**Given** GitHub Secrets 中的環境變數包含換行符
**When** workflow 執行時載入環境變數
**Then** 系統應自動移除所有 `\n` 和 `\r` 字元
**And** 環境變數驗證步驟應該通過
**And** 不應出現 "包含換行符" 的錯誤訊息

#### Scenario: 正常環境變數不受影響

**Given** GitHub Secrets 中的環境變數不包含換行符
**When** workflow 執行時載入環境變數
**Then** 環境變數值應保持不變
**And** 環境變數驗證步驟應該通過

### Requirement: 所有關鍵環境變數都必須清理
**ID**: `github-actions-env-all-vars`
**Priority**: High
**Component**: GitHub Actions Workflows

所有用於文章生成系統的環境變數都 **MUST** 經過清理處理，包括但不限於：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `USE_MULTI_AGENT_ARCHITECTURE`

#### Scenario: 批次清理所有環境變數

**Given** workflow 需要載入多個環境變數
**When** 環境變數清理步驟執行
**Then** 所有上述列出的環境變數都應被清理
**And** 清理後的環境變數應可用於後續步驟
**And** 驗證步驟應該全部通過

## ADDED Requirements

### Requirement: 環境變數清理步驟必須在驗證之前執行
**ID**: `github-actions-env-cleanup-order`
**Priority**: High
**Component**: GitHub Actions Workflows

環境變數清理 **MUST** 在任何使用環境變數的步驟之前執行，特別是在驗證步驟之前。

#### Scenario: 清理步驟的執行順序

**Given** workflow 定義了多個步驟
**When** workflow 開始執行
**Then** 環境變數清理應該在 "Process pending article jobs" 之前執行
**And** 環境變數清理應該在 "驗證環境變數" 之前執行
**And** 清理後的環境變數應該對所有後續步驟可用
