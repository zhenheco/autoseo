# Capability: 公司資料驗證和錯誤處理

## ADDED Requirements

### Requirement: Clear Error Messages for Missing Data
購買流程 SHALL 在資料不存在時回傳清楚的錯誤訊息。

**變更原因**：修正「找不到公司資料」錯誤，加強錯誤診斷能力

**變更內容**：
- 在查詢公司資料失敗時記錄詳細日誌
- 回傳更具體的錯誤訊息給前端
- 檢查 RLS 政策是否阻擋查詢

#### Scenario: 公司資料存在但 RLS 政策阻擋查詢

**Given**：
- 用戶 ID 為 `user-123`
- 公司 ID 為 `company-456`
- `companies` 表中存在 `company-456`
- RLS 政策設定錯誤，阻止用戶查詢該公司資料

**When**：
- 用戶調用 `POST /api/payment/recurring/create`
- API 嘗試查詢公司資料：
  ```typescript
  const { data: company } = await authClient
    .from('companies')
    .select('subscription_tier, subscription_period')
    .eq('id', companyId)
    .single()
  ```

**Then**：
- API 記錄錯誤日誌：
  ```
  [ERROR] 無法查詢公司資料
  User ID: user-123
  Company ID: company-456
  RLS enabled: true
  ```
- API 回傳 JSON：
  ```json
  {
    "error": "無法存取公司資料，請確認權限設定",
    "code": "COMPANY_ACCESS_DENIED",
    "details": "RLS policy may be blocking the query"
  }
  ```
- HTTP 狀態碼：403 Forbidden

#### Scenario: 公司資料不存在於資料庫

**Given**：
- 用戶 ID 為 `user-123`
- 用戶關聯的 `company_id` 為 `company-999`（不存在）

**When**：
- 用戶調用 `POST /api/payment/recurring/create`
- API 查詢公司資料但找不到

**Then**：
- API 記錄錯誤日誌：
  ```
  [ERROR] 公司資料不存在
  User ID: user-123
  Company ID: company-999
  ```
- API 回傳 JSON：
  ```json
  {
    "error": "找不到公司資料",
    "code": "COMPANY_NOT_FOUND",
    "details": "Company ID does not exist in database"
  }
  ```
- HTTP 狀態碼：404 Not Found

### Requirement: Purchase Flow Precondition Validation
系統 SHALL 驗證所有購買流程的前置條件。

**變更原因**：確保購買流程不會因為資料缺失而失敗

**變更內容**：
- 在建立訂單前驗證公司存在
- 驗證用戶有權限存取該公司
- 驗證訂閱方案存在且啟用

#### Scenario: 購買前驗證所有資料完整性

**Given**：
- 用戶準備購買 STARTER 方案

**When**：
- API 收到購買請求

**Then**：
- API MUST 依序驗證：
  1. 用戶已登入且 user ID 有效
  2. 用戶關聯的 company_id 存在於 `company_members` 表
  3. 公司記錄存在於 `companies` 表
  4. 訂閱方案存在於 `subscription_plans` 表且 `is_active = true`
  5. 升級規則允許從當前方案升級到目標方案
- 任一驗證失敗，API MUST 回傳具體的錯誤訊息和錯誤代碼
- 只有所有驗證通過後，才能建立支付訂單

#### Scenario: 驗證失敗時回傳詳細錯誤

**Given**：
- 用戶的 `company_members` 記錄不存在

**When**：
- API 嘗試取得 company_id

**Then**：
- API 回傳 JSON：
  ```json
  {
    "error": "找不到使用者所屬公司",
    "code": "MEMBERSHIP_NOT_FOUND",
    "details": "User is not a member of any company"
  }
  ```
- HTTP 狀態碼：403 Forbidden
- 前端顯示友善的錯誤訊息，引導用戶聯繫客服
