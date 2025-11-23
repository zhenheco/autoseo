# user-registration Specification (Updated)

## 變更摘要

此次更新統一 Email 註冊和 OAuth 註冊的公司建立流程，確保所有用戶獲得相同的資料結構。

---

## ADDED Requirements

### Requirement: 統一公司建立流程

**描述**：Email 註冊和 OAuth 註冊 MUST 使用相同的公司建立邏輯，確保所有用戶擁有相同的資料結構和功能。

**實作位置**：

- `src/lib/auth.ts` (重構 `signUp` 函數)
- `src/lib/auth/oauth-setup.ts` (共用 `createCompanyForUser`)

**涉及資料**：

1. `companies` - 公司基本資料
2. `subscriptions` - 訂閱方案
3. `company_subscriptions` - 公司訂閱關聯
4. `company_members` - 成員資料 (role='owner')
5. `one_time_tokens` - 免費 tokens (50 個)
6. `referral_codes` - 推薦碼
7. `activity_logs` - 活動記錄

#### Scenario: Email 註冊建立完整資料

**Given**：

- 新用戶通過 Email 註冊
- 提供 email, password, company name

**When**：

- 調用 `signUp(email, password, companyName)`
- 使用共用的 `createCompanyData` 函數

**Then**：

- 應建立用戶帳號
- 應建立公司記錄
- 應建立免費訂閱 (plan='free', status='active')
- 應建立公司訂閱關聯
- 應建立成員記錄 (role='owner')
- 應建立 50 個免費 tokens
- 應建立推薦碼
- 應記錄活動日誌（method='email_signup'）

#### Scenario: OAuth 註冊建立完整資料

**Given**：

- 新用戶通過 Google OAuth 登入
- Fallback 邏輯觸發（Trigger 失敗）

**When**：

- 調用 RPC `create_company_for_oauth_user(userId, email, companyName)`

**Then**：

- 應建立公司記錄（與 Email 註冊相同結構）
- 應建立免費訂閱 (plan='free', status='active')
- 應建立公司訂閱關聯
- 應建立成員記錄 (role='owner')
- 應建立 50 個免費 tokens
- 應建立推薦碼
- 應記錄活動日誌（method='oauth_rpc'）
- **資料結構應與 Email 註冊完全一致**

#### Scenario: 資料一致性驗證

**Given**：

- 一個用戶通過 Email 註冊
- 另一個用戶通過 Google OAuth 登入

**When**：

- 兩個用戶完成註冊流程
- 查詢兩個用戶的資料

**Then**：

- 兩個用戶應擁有相同的表結構
- 兩個用戶應擁有相同數量的 one_time_tokens (50)
- 兩個用戶都應有 referral_codes
- 兩個用戶都應有 activity_logs
- 唯一差異應該只在 `activity_logs.details.method` 欄位

---

### Requirement: 公司建立函數提取

**描述**：系統 SHALL 將公司建立邏輯提取為共用函數，避免 Email 和 OAuth 流程的重複代碼。

**實作位置**：`src/lib/auth/company-setup.ts` (新建) 或 `src/lib/auth.ts` (重構)

**函數簽名**：

```typescript
interface CompanySetupData {
  userId: string;
  email: string;
  companyName: string;
  plan?: string; // 預設 'free'
  billingCycle?: string; // 預設 'monthly'
}

interface CompanySetupResult {
  companyId: string;
  subscriptionId: string;
  tokensBalance: number;
  referralCode: string;
}

async function createCompanyData(
  data: CompanySetupData,
): Promise<CompanySetupResult>;
```

#### Scenario: Email 註冊使用共用函數

**Given**：

- 用戶提交 Email 註冊表單

**When**：

- `signUp` 函數被調用
- Supabase 建立用戶帳號成功
- 調用 `createCompanyData({ userId, email, companyName })`

**Then**：

- 應返回完整的公司設定資料
- Email 註冊流程無需直接操作資料庫

#### Scenario: RPC Function 使用相同邏輯

**Given**：

- RPC function `create_company_for_oauth_user` 被調用

**When**：

- 在資料庫內執行公司建立邏輯

**Then**：

- SQL 邏輯應與 `createCompanyData` TypeScript 函數一致
- 建立的表和欄位應完全相同
- 預設值應完全相同 (plan='free', tokens=50, etc.)

---

### Requirement: Database Trigger 資料完整性

**描述**：Database Trigger `handle_new_oauth_user` MUST 建立與 RPC function 和 Email 註冊相同的資料結構。

**實作位置**：`supabase/migrations/*_update_oauth_trigger.sql`

**變更**：

- **ADDED**: 建立 `one_time_tokens` (50 tokens)
- **ADDED**: 建立 `referral_codes`
- **ADDED**: 記錄 `activity_logs` (method='database_trigger')

#### Scenario: Trigger 建立完整資料

**Given**：

- 新用戶通過 Google OAuth 登入
- `auth.users` 表插入新記錄
- Trigger 被觸發

**When**：

- `handle_new_oauth_user` 函數執行

**Then**：

- 應建立 `companies` 記錄
- 應建立 `subscriptions` 記錄 (plan='free', status='active')
- 應建立 `company_subscriptions` 關聯
- 應建立 `company_members` 記錄 (role='owner')
- **應建立 `one_time_tokens` 記錄 (balance=50)** ← 新增
- **應建立 `referral_codes` 記錄** ← 新增
- **應記錄 `activity_logs`** ← 新增
- 所有資料應在同一事務中建立

#### Scenario: Trigger 與 RPC 資料一致性

**Given**：

- User A: Trigger 成功建立資料
- User B: Trigger 失敗，RPC fallback 建立資料

**When**：

- 查詢兩個用戶的資料

**Then**：

- 兩個用戶應擁有完全相同的資料結構
- 唯一差異應在 `activity_logs.details.method`:
  - User A: 'database_trigger'
  - User B: 'oauth_rpc'

---

## MODIFIED Requirements

### Requirement: Signup Flow Logic Clarity (Updated)

**原始描述**：註冊流程 SHALL 在 try block 中明確檢查用戶狀態，而非依賴 catch block 進行流程控制。

**更新**：加入公司建立邏輯的明確性要求。

#### Scenario: 先檢查後註冊（更新）

**Given**：

- 用戶提交註冊表單

**When**：

- 系統首先使用 RPC 查詢用戶是否存在
- 如果用戶不存在，執行 `signUp(email, password, companyName)`

**Then**：

- `signUp` 函數應：
  1. 建立 Supabase 用戶
  2. **調用 `createCompanyData` 建立公司及所有相關資料**
  3. 返回成功結果
- 如果任何步驟失敗，應回滾（如果可能）或記錄錯誤

---

## REMOVED Requirements

（無）

---

## 跨規格關聯

### 與 `oauth-authentication` 規格的關係

- OAuth 認證流程使用與 `user-registration` 相同的公司建立邏輯
- 兩者必須建立相同的資料結構
- 參見：`oauth-authentication` 規格的 Requirement 4 (RPC Function 原子性建立)

---

## 實作變更摘要

### 需要修改的檔案

1. **`src/lib/auth.ts`**
   - 重構 `signUp` 函數
   - 提取 `createCompanyData` 共用函數
   - 或建立新檔案 `src/lib/auth/company-setup.ts`

2. **`supabase/migrations/*_update_oauth_trigger.sql`**
   - 更新 `handle_new_oauth_user` 函數
   - 加入 `one_time_tokens` 建立
   - 加入 `referral_codes` 建立
   - 加入 `activity_logs` 記錄

3. **`supabase/migrations/*_create_oauth_setup_rpc.sql`**
   - 確保 RPC function 建立所有必要資料
   - 與 Trigger 和 Email 註冊保持一致

### 資料庫 Schema 要求

所有三種註冊方式（Email、OAuth Trigger、OAuth Fallback）都必須建立：

```sql
-- 1. 公司
INSERT INTO companies (name, email, plan, billing_cycle)
VALUES (...);

-- 2. 訂閱
INSERT INTO subscriptions (plan_name, status, billing_cycle, ...)
VALUES ('free', 'active', 'monthly', ...);

-- 3. 公司訂閱關聯
INSERT INTO company_subscriptions (company_id, subscription_id)
VALUES (...);

-- 4. 成員
INSERT INTO company_members (company_id, user_id, role)
VALUES (..., ..., 'owner');

-- 5. ✅ One-time Tokens (50 個)
INSERT INTO one_time_tokens (company_id, balance)
VALUES (..., 50);

-- 6. ✅ 推薦碼
INSERT INTO referral_codes (user_id, code)
VALUES (..., generate_referral_code());

-- 7. ✅ 活動日誌
INSERT INTO activity_logs (company_id, user_id, action, details)
VALUES (...);
```

---

## 測試要求

### 新增測試場景

1. **資料一致性測試**
   - Email 註冊用戶和 OAuth 用戶應有相同資料結構
   - 查詢並比較兩個用戶的所有關聯表

2. **Trigger 更新測試**
   - 驗證 Trigger 建立 `one_time_tokens`
   - 驗證 Trigger 建立 `referral_codes`
   - 驗證 Trigger 記錄 `activity_logs`

3. **共用函數測試**
   - 單元測試 `createCompanyData` 函數
   - 模擬各種成功和失敗情境

---

## 遷移策略

### 對現有用戶的影響

**問題**：已存在的 OAuth 用戶可能缺少 `one_time_tokens` 和 `referral_codes`

**解決方案**：建立資料補償腳本

```sql
-- 找出缺少 tokens 的用戶
SELECT u.id, u.email, cm.company_id
FROM auth.users u
JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN one_time_tokens ott ON cm.company_id = ott.company_id
WHERE ott.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';

-- 補充 tokens
INSERT INTO one_time_tokens (company_id, balance)
SELECT DISTINCT cm.company_id, 50
FROM auth.users u
JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN one_time_tokens ott ON cm.company_id = ott.company_id
WHERE ott.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';

-- 補充推薦碼
INSERT INTO referral_codes (user_id, code)
SELECT u.id, generate_referral_code()
FROM auth.users u
LEFT JOIN referral_codes rc ON u.id = rc.user_id
WHERE rc.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';
```

### 部署順序

1. **階段 1**: 部署 Database Migration（Trigger 更新、RPC function）
2. **階段 2**: 執行資料補償腳本
3. **階段 3**: 部署應用代碼（重構後的 `signUp`）
4. **階段 4**: 驗證新註冊用戶的資料完整性
5. **階段 5**: 監控 24-48 小時

---

## 成功指標

### 資料完整性

- ✅ 100% 新註冊用戶（Email 和 OAuth）擁有 `one_time_tokens`
- ✅ 100% 新註冊用戶（Email 和 OAuth）擁有 `referral_codes`
- ✅ Email 和 OAuth 用戶的資料結構完全相同

### 代碼質量

- ✅ Email 和 OAuth 註冊共用 >80% 的公司建立代碼
- ✅ 無重複邏輯
- ✅ 單元測試覆蓋率 > 90%

---

## 變更歷史

- **2025-11-10**: 加入統一公司建立流程的 requirements
- **原始版本**: 用戶存在檢查（RPC 函數）

---

**規格版本**: 2.0
**最後更新**: 2025-11-10
**狀態**: 草案
