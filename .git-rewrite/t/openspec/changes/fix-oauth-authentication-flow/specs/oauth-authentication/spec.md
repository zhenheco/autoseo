# OAuth Authentication Specification

## 概述

此規格定義 OAuth 認證流程的完整行為，包括三層防護機制、資料完整性驗證、並發控制和錯誤處理。

---

## ADDED Requirements

### Requirement: OAuth Callback 資料完整性驗證

**描述**：OAuth callback MUST 驗證用戶擁有完整的關聯資料，包括公司、訂閱、tokens 和推薦碼，才能允許用戶登入系統。

**實作位置**：`src/app/auth/callback/route.ts`

**依賴**：

- Supabase Auth
- `oauth-setup` 模組

#### Scenario: 成功的 OAuth 登入（用戶已有完整資料）

**Given**：

- 用戶使用 Google OAuth 完成授權
- 用戶已存在於系統中
- 用戶已有公司、訂閱、tokens 和推薦碼

**When**：

- OAuth callback 接收 authorization code
- 交換 code 獲得 session
- 調用 `ensureUserHasCompany()`

**Then**：

- 系統應在 < 200ms 內驗證完成（Layer 1）
- 系統應記錄 metrics: `path='existing'`
- 用戶應被重定向到 `/dashboard`
- 不應建立任何新資料

#### Scenario: OAuth 登入失敗（Session 建立失敗）

**Given**：

- 用戶使用 Google OAuth 授權
- Authorization code 無效或過期

**When**：

- OAuth callback 嘗試交換 code

**Then**：

- 系統應返回錯誤
- 用戶應被重定向到 `/login?error=exchange_failed`
- 系統應記錄詳細錯誤日誌

#### Scenario: OAuth 登入失敗（公司建立失敗）

**Given**：

- 用戶使用 Google OAuth 授權
- Session 建立成功
- 所有三層防護都失敗

**When**：

- `ensureUserHasCompany()` 返回 `success: false`

**Then**：

- 用戶應被重定向到 `/login?error=company_creation_failed`
- 系統應記錄 metrics: `path='failed'`
- 系統應發送警報通知

---

### Requirement: 三層防護機制實作

**描述**：系統 MUST 實作三層漸進式防護機制，確保用戶在任何情況下都能獲得完整的公司資料。

**實作位置**：`src/lib/auth/oauth-setup.ts` (`ensureUserHasCompany`)

#### Scenario: Layer 1 成功（快速路徑）

**Given**：

- 用戶已存在
- 用戶已有公司資料

**When**：

- 調用 `ensureUserHasCompany(userId, email)`
- 執行 `getUserCompany(userId)`

**Then**：

- 應立即返回公司資料（< 100ms）
- 不應執行 Layer 2 或 Layer 3
- 應記錄 metrics: `path='existing'`, `delay < 100ms`

#### Scenario: Layer 2 成功（Trigger 正常）

**Given**：

- 新用戶首次 OAuth 登入
- Database Trigger 正常執行
- Trigger 在 700ms 內完成

**When**：

- Layer 1 檢查：無公司
- Layer 2 輪詢：使用指數退避
  - Poll 1 (100ms): 無公司
  - Poll 2 (200ms): 無公司
  - Poll 3 (400ms): 找到公司 ✅

**Then**：

- 應返回公司資料
- 不應執行 Layer 3
- 應記錄 metrics: `path='trigger_success'`, `delay ≈ 700ms`

#### Scenario: Layer 3 成功（Fallback）

**Given**：

- 新用戶首次 OAuth 登入
- Database Trigger 失敗或嚴重延遲
- 輪詢 3.1 秒後仍無公司

**When**：

- Layer 1 檢查：無公司
- Layer 2 輪詢：所有 5 次都無公司
- Layer 3 Fallback：調用 RPC `create_company_for_oauth_user`

**Then**：

- 應成功建立公司及所有相關資料
- 應返回新建立的公司資料
- 應記錄 metrics: `path='fallback_success'`, `delay > 3000ms`
- 應記錄警告日誌（Trigger 可能有問題）

#### Scenario: 所有層都失敗

**Given**：

- 新用戶首次 OAuth 登入
- Database Trigger 失敗
- RPC function 也失敗（例如資料庫不可用）

**When**：

- Layer 1-3 全部失敗

**Then**：

- 應返回 `success: false`
- 應記錄 metrics: `path='failed'`
- 應記錄錯誤詳情
- 應觸發即時警報

---

### Requirement: 指數退避輪詢策略

**描述**：Layer 2 MUST 使用指數退避演算法進行輪詢，以平衡響應速度和資料庫負載。

**實作位置**：`src/lib/auth/oauth-setup.ts` (`waitForCompanySetup`)

**配置**：

- Poll 間隔：`[100ms, 200ms, 400ms, 800ms, 1600ms]`
- 總超時時間：`3100ms`

#### Scenario: Trigger 在第一次輪詢就完成

**Given**：

- Database Trigger 執行速度很快（< 100ms）

**When**：

- 第一次輪詢（100ms 後）

**Then**：

- 應找到公司
- 應立即返回，不進行後續輪詢
- 總延遲：≈ 100-200ms

#### Scenario: Trigger 在第三次輪詢完成

**Given**：

- Database Trigger 延遲約 600ms

**When**：

- Poll 1 (100ms): 無公司
- Poll 2 (200ms): 無公司
- Poll 3 (400ms): 找到公司

**Then**：

- 應返回公司資料
- 不應進行 Poll 4 和 5
- 總延遲：≈ 700ms

#### Scenario: 輪詢超時

**Given**：

- Database Trigger 嚴重延遲（> 3100ms）

**When**：

- 所有 5 次輪詢都無公司

**Then**：

- 應返回 `null`
- 應進入 Layer 3 Fallback
- 總延遲：≈ 3100ms

---

### Requirement: RPC Function 原子性建立

**描述**：`create_company_for_oauth_user` RPC function MUST 使用 PostgreSQL 事務原子性建立所有相關資料，確保全有或全無。

**實作位置**：`supabase/migrations/*_create_oauth_setup_rpc.sql`

**建立資料**：

1. `companies` (公司)
2. `subscriptions` (訂閱)
3. `company_subscriptions` (公司訂閱關聯)
4. `company_members` (成員，role='owner')
5. `one_time_tokens` (50 免費 tokens)
6. `referral_codes` (推薦碼)
7. `activity_logs` (活動記錄)

#### Scenario: 成功建立所有資料

**Given**：

- 用戶不存在公司
- 資料庫正常運作
- 無並發衝突

**When**：

- 調用 `create_company_for_oauth_user(userId, email, companyName)`

**Then**：

- 應建立公司
- 應建立訂閱（plan='free', status='active'）
- 應建立公司訂閱關聯
- 應建立成員（role='owner'）
- 應建立 50 個免費 tokens
- 應建立推薦碼
- 應記錄活動日誌
- 所有操作應在同一事務中
- 應返回建立的資料（company_id, subscription_id, tokens_balance, referral_code）

#### Scenario: 部分建立失敗（事務回滾）

**Given**：

- 公司建立成功
- 推薦碼建立失敗（例如 unique constraint violation）

**When**：

- 事務執行到推薦碼建立時失敗

**Then**：

- 應回滾整個事務
- 不應建立任何資料（包括已成功的公司）
- 應拋出錯誤
- 應記錄錯誤詳情

#### Scenario: 用戶已有公司（雙重檢查）

**Given**：

- RPC function 被調用
- 用戶已有公司（另一個請求剛建立）

**When**：

- Advisory lock 獲得後執行雙重檢查

**Then**：

- 應檢測到現有公司
- 不應建立新公司
- 應返回現有公司資料
- 應設定 `created_new = false`

---

### Requirement: Advisory Lock 並發控制

**描述**：系統 MUST 使用 PostgreSQL advisory lock 防止並發請求建立多個公司。

**實作位置**：`create_company_for_oauth_user` RPC function

**Lock Key**：`hashtext(user_id::text)`

#### Scenario: 並發請求（多個 Tab）

**Given**：

- 用戶在兩個瀏覽器 tab 同時完成 OAuth 授權
- 兩個 callback 同時調用 `create_company_for_oauth_user`

**When**：

- Request 1: 獲得 advisory lock ✅
- Request 2: 等待 lock ⏳

**Then**：

- Request 1 應建立公司並提交事務
- Request 1 提交後釋放 lock
- Request 2 獲得 lock，執行雙重檢查
- Request 2 檢測到公司已存在，返回現有資料
- **結果**：只建立一個公司 ✅

#### Scenario: Lock 超時

**Given**：

- Request 1 持有 lock 但因資料庫問題卡住
- Request 2 等待 lock

**When**：

- PostgreSQL lock wait timeout 觸發

**Then**：

- Request 2 應收到 timeout 錯誤
- 應記錄錯誤
- 用戶應看到錯誤提示
- Request 1 的事務應最終回滾或完成

---

### Requirement: 監控和指標記錄

**描述**：所有 OAuth 登入 MUST 記錄詳細的指標資料，用於效能分析和警報。

**實作位置**：

- `src/lib/auth/oauth-setup.ts` (`recordMetrics`)
- `oauth_login_metrics` 表

**記錄欄位**：

- `user_id`: 用戶 ID
- `provider`: OAuth provider ('google', 'github', etc.)
- `path`: 成功路徑 ('existing' | 'trigger_success' | 'fallback_success' | 'failed')
- `trigger_delay_ms`: 總延遲時間（毫秒）
- `created_at`: 時間戳記

#### Scenario: Layer 1 成功的指標記錄

**Given**：

- OAuth 登入通過 Layer 1 成功

**When**：

- `ensureUserHasCompany` 返回成功
- 總延遲 50ms

**Then**：

- 應插入記錄到 `oauth_login_metrics`
- `path` 應為 'existing'
- `trigger_delay_ms` 應為 50
- `provider` 應為 'google'

#### Scenario: Fallback 觸發的指標記錄

**Given**：

- OAuth 登入通過 Layer 3 Fallback 成功

**When**：

- Trigger 超時，RPC 成功
- 總延遲 3500ms

**Then**：

- 應插入記錄到 `oauth_login_metrics`
- `path` 應為 'fallback_success'
- `trigger_delay_ms` 應為 3500
- 應同時記錄警告日誌

---

### Requirement: 錯誤處理和用戶提示

**描述**：系統 MUST 提供清晰的錯誤訊息和重試機制，不暴露內部實作細節。

**實作位置**：`src/app/auth/callback/route.ts`

#### Scenario: 用戶可見的錯誤訊息

**Given**：

- OAuth 登入失敗

**When**：

- 用戶被重定向到 `/login?error=<error_code>`

**Then**：

- 錯誤訊息應清晰且對用戶友好
- 不應包含技術細節（例如 SQL 錯誤）
- 應提供重試按鈕或建議

**錯誤碼對應**：

- `oauth_cancelled`: "您已取消 Google 授權，請重試"
- `exchange_failed`: "登入驗證失敗，請重新登入"
- `company_creation_failed`: "無法建立帳戶，請稍後再試或聯繫客服"

#### Scenario: 開發者日誌記錄

**Given**：

- OAuth 登入失敗（任何原因）

**When**：

- 錯誤發生

**Then**：

- 應記錄完整的錯誤堆疊
- 應包含用戶 ID、email（脫敏）
- 應包含失敗的層級（Layer 1/2/3）
- 應包含時間戳記和延遲
- 日誌應僅後端可見

---

## MODIFIED Requirements

（無，這是新增的規格）

---

## REMOVED Requirements

（無）

---

## 跨規格關聯

### 與 `user-registration` 規格的關係

- OAuth 認證流程使用與 Email 註冊相同的公司建立邏輯
- 兩者應建立相同的資料結構
- 參見：`user-registration` 規格的 Requirement 3（統一公司建立）

### 與 `secrets-management` 規格的關係

- OAuth callback 不應記錄敏感資訊（email 需脫敏）
- 參見：`secrets-management` 規格的 Requirement 2

---

## 測試覆蓋率要求

### 單元測試

- `getUserCompany`: 100% 覆蓋率
- `waitForCompanySetup`: 測試所有輪詢情境
- `createCompanyForUser`: 測試成功和失敗
- `ensureUserHasCompany`: 測試所有三層路徑

### 整合測試

- 完整 OAuth 流程：從 Google 授權到登入成功
- Database Trigger 觸發和驗證
- RPC function 原子性測試

### 手動測試

8 個必測場景：

1. ✅ 新用戶首次 Google OAuth 登入
2. ✅ 已存在用戶再次 OAuth 登入
3. ✅ Database Trigger 延遲執行
4. ✅ Database Trigger 完全失敗
5. ✅ 並發登入（多個 tab）
6. ✅ 網路不穩定情況
7. ✅ 用戶取消 Google 授權
8. ✅ 已有公司的用戶使用 OAuth 登入

---

## 效能指標

### 目標延遲

- **Layer 1 成功**: < 100ms (P95)
- **Layer 2 成功**: < 1000ms (P95)
- **Layer 3 成功**: < 4000ms (P95)

### 路徑分佈目標

- **existing**: > 90% （成熟產品）
- **trigger_success**: 5-10%
- **fallback_success**: < 5% （警報閾值）
- **failed**: 0% （絕對不可接受）

---

## 安全要求

### 權限控制

- RPC function 使用 `SECURITY DEFINER`
- 必須驗證 `auth.uid() = user_id`
- Rate limiting: 5 分鐘內同一用戶只能調用一次

### 資料保護

- 日誌中的 email 必須脫敏（`user@***.com`）
- 不記錄 user_id 以外的敏感資訊
- 錯誤訊息不暴露內部細節

---

## 相依性

### 外部依賴

- Supabase Auth
- Supabase Database
- Google OAuth 2.0

### 內部依賴

- `user-registration` 規格（共用公司建立邏輯）
- `secrets-management` 規格（敏感資料處理）

---

## 變更歷史

- **2025-11-10**: 初始版本，定義 OAuth 認證的完整規範

---

**規格版本**: 1.0
**最後更新**: 2025-11-10
**狀態**: 草案
