# OAuth 認證流程修復 - 實作任務清單

## 概述

本文檔列出 OAuth 認證流程修復的所有實作任務，按照 4 個 Phase 組織，總計 15 個任務。

**總時間估算**: 6-9 個工作天

---

## Phase 1: 基礎設施（1-2 天）

### Task 1.1: 建立 RPC Function Migration

**描述**：建立 PostgreSQL RPC function `create_company_for_oauth_user`，包含 advisory lock 和完整的資料建立邏輯。

**檔案**：`supabase/migrations/YYYYMMDDHHMMSS_create_oauth_setup_rpc.sql`

**實作內容**：
- [x] 定義 function 簽名和返回類型
- [x] 權限驗證：`IF auth.uid() != p_user_id THEN RAISE EXCEPTION`
- [x] Advisory lock：`pg_advisory_xact_lock(hashtext(p_user_id::text))`
- [x] 雙重檢查：查詢用戶是否已有公司
- [x] 建立 companies, subscriptions, company_subscriptions
- [x] 建立 company_members (role='owner')
- [x] 建立 one_time_tokens (balance=50)
- [x] 建立 referral_codes
- [x] 記錄 activity_logs
- [x] 錯誤處理和日誌
- [x] GRANT EXECUTE 給 authenticated 角色

**驗證標準**：
```sql
-- 測試調用
SELECT * FROM create_company_for_oauth_user(
  'test-user-id',
  'test@example.com',
  'Test Company'
);

-- 驗證建立的資料
SELECT * FROM companies WHERE email = 'test@example.com';
SELECT * FROM one_time_tokens WHERE company_id = ...;
SELECT * FROM referral_codes WHERE user_id = 'test-user-id';
```

**估計時間**：2-3 小時

---

### Task 1.2: 更新 Database Trigger Migration

**描述**：更新 `handle_new_oauth_user` trigger 以建立 one_time_tokens 和 referral_codes。

**檔案**：`supabase/migrations/YYYYMMDDHHMMSS_update_oauth_trigger.sql`

**實作內容**：
- [x] 修改 `handle_new_oauth_user` 函數
- [x] 加入 one_time_tokens 建立邏輯（50 tokens）
- [x] 加入 referral_codes 建立邏輯
- [x] 加入 activity_logs 記錄（method='database_trigger'）
- [x] 確保與 RPC function 邏輯一致
- [x] 錯誤處理不阻止用戶建立

**驗證標準**：
```sql
-- 模擬 OAuth 用戶插入
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES (
  'test-oauth-user',
  'oauth@example.com',
  '{"provider": "google"}'
);

-- 驗證 Trigger 建立的資料
SELECT * FROM companies WHERE email = 'oauth@example.com';
SELECT * FROM one_time_tokens WHERE company_id = ...;
SELECT * FROM referral_codes WHERE user_id = 'test-oauth-user';
```

**估計時間**：1-2 小時

---

### Task 1.3: 建立監控表 Migration

**描述**：建立 `oauth_login_metrics` 表用於記錄 OAuth 登入的效能指標。

**檔案**：`supabase/migrations/YYYYMMDDHHMMSS_create_oauth_metrics_table.sql`

**實作內容**：
- [x] 建立 oauth_login_metrics 表
  - `id UUID PRIMARY KEY`
  - `user_id UUID REFERENCES auth.users`
  - `provider TEXT NOT NULL`
  - `path TEXT CHECK (path IN (...))`
  - `trigger_delay_ms INTEGER NOT NULL`
  - `created_at TIMESTAMP DEFAULT NOW()`
- [x] 建立索引（created_at, path, provider）
- [x] 啟用 RLS
- [x] 建立 policies（用戶可讀自己的，service_role 可寫）
- [x] 建立清理舊資料的 function（30 天保留）

**驗證標準**：
```sql
-- 測試插入
INSERT INTO oauth_login_metrics (user_id, provider, path, trigger_delay_ms)
VALUES ('test-user', 'google', 'existing', 50);

-- 驗證 RLS
SELECT * FROM oauth_login_metrics WHERE user_id = auth.uid();

-- 驗證清理 function
SELECT cleanup_old_oauth_metrics();
```

**估計時間**：1 小時

---

### Task 1.4: 部署 Migrations 到測試環境

**描述**：將三個 migrations 部署到 Supabase 測試環境並驗證。

**實作內容**：
- [ ] 執行 `supabase db push` 或手動執行 SQL
- [ ] 驗證 RPC function 存在：`SELECT * FROM pg_proc WHERE proname = 'create_company_for_oauth_user'`
- [ ] 驗證 Trigger 已更新：`SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
- [ ] 驗證監控表存在：`\d oauth_login_metrics`
- [ ] 執行 Task 1.1-1.3 的驗證標準
- [ ] 檢查無錯誤訊息

**驗證標準**：
- ✅ RPC function 可正常調用
- ✅ Trigger 可正常觸發
- ✅ 監控表可寫入
- ✅ 所有資料正確建立

**估計時間**：1 小時

---

## Phase 2: 核心邏輯（2-3 天）

### Task 2.1: 建立 OAuth Setup 模組

**描述**：建立 `src/lib/auth/oauth-setup.ts` 模組，實作三層防護機制。

**檔案**：`src/lib/auth/oauth-setup.ts`

**實作內容**：
- [x] Types 和 Constants
  - `OAuthProvider`, `CompanyData`, `OAuthSetupResult`
  - `OAUTH_PROVIDERS` 配置
  - `EXPONENTIAL_BACKOFF_DELAYS = [100, 200, 400, 800, 1600]`
- [x] Layer 1: `getUserCompany(userId)`
  - 查詢 company_members JOIN companies
  - 返回 CompanyData 或 null
- [x] Layer 2: `waitForCompanySetup(userId)`
  - 指數退避輪詢
  - 每次 sleep 後調用 getUserCompany
  - 超時返回 null
- [x] Layer 3: `createCompanyForUser(userId, email, name)`
  - 調用 RPC: `create_company_for_oauth_user`
  - 錯誤處理
  - 重新查詢返回公司資料
- [x] Main: `ensureUserHasCompany(userId, email, userName)`
  - 執行三層邏輯
  - 記錄 metrics
  - 詳細日誌
  - 返回 OAuthSetupResult
- [x] Helpers:
  - `recordMetrics(data)`
  - `getProviderFromUser(user)`
  - `isOAuthProvider(provider)`
  - `getDefaultCompanyName(user, provider)`

**驗證標準**：
```typescript
// 單元測試
import { ensureUserHasCompany } from '@/lib/auth/oauth-setup';

// Test Layer 1
const result1 = await ensureUserHasCompany('existing-user', 'user@example.com');
expect(result1.path).toBe('existing');

// Test Layer 2 (mock Trigger delay)
// Test Layer 3 (mock Trigger failure)
```

**估計時間**：4-5 小時

---

### Task 2.2: 修改 OAuth Callback Route

**描述**：修改 `src/app/auth/callback/route.ts` 整合 `ensureUserHasCompany`。

**檔案**：`src/app/auth/callback/route.ts`

**實作內容**：
- [x] Import `ensureUserHasCompany` 和相關 helpers
- [x] 處理 OAuth 錯誤（用戶取消授權）
- [x] 驗證 authorization code 存在
- [x] Exchange code for session
- [x] 檢查 session 和 user
- [x] 判斷是否為 OAuth provider
- [x] 如果是 OAuth：
  - 調用 `ensureUserHasCompany(user.id, user.email, companyName)`
  - 檢查 result.success
  - 失敗：重定向到 `/login?error=company_creation_failed`
  - 成功：記錄日誌（path 和 delay）
- [x] 重定向到 `next` 或 `/dashboard`
- [x] 詳細錯誤處理和日誌

**驗證標準**：
- ✅ 成功的 OAuth 登入可以進入 dashboard
- ✅ 失敗的 OAuth 登入顯示錯誤訊息
- ✅ Metrics 正確記錄到 oauth_login_metrics 表
- ✅ 日誌包含完整資訊（userId, path, delay）

**估計時間**：2-3 小時

---

### Task 2.3: 重構 Email 註冊邏輯（可選）

**描述**：重構 `src/lib/auth.ts` 的 `signUp` 函數，提取公司建立邏輯為共用函數。

**檔案**：`src/lib/auth.ts`

**實作內容**：
- [ ] 提取 `createCompanyData` 函數
  - 建立 companies
  - 建立 subscriptions
  - 建立 company_subscriptions
  - 建立 company_members
  - 建立 one_time_tokens
  - 建立 referral_codes
  - 記錄 activity_logs
- [ ] 修改 `signUp` 函數
  - Supabase 建立用戶後
  - 調用 `createCompanyData({ userId, email, companyName })`
- [ ] 確保錯誤處理正確

**驗證標準**：
```typescript
// Email 註冊測試
const result = await signUp('test@example.com', 'password123', 'Test Company');

// 驗證資料
expect(result.company).toBeDefined();
expect(result.tokens).toBe(50);
expect(result.referralCode).toBeDefined();
```

**估計時間**：2-3 小時（可選任務）

---

## Phase 3: 測試（2-3 天）

### Task 3.1: 撰寫單元測試

**描述**：為 `oauth-setup.ts` 撰寫完整的單元測試。

**檔案**：`__tests__/oauth-setup.test.ts`

**實作內容**：
- [ ] 測試 `getUserCompany`
  - 用戶有公司
  - 用戶無公司
- [ ] 測試 `waitForCompanySetup`
  - 第一次輪詢成功
  - 第三次輪詢成功
  - 超時（所有輪詢失敗）
- [ ] 測試 `createCompanyForUser`
  - RPC 調用成功
  - RPC 調用失敗
- [ ] 測試 `ensureUserHasCompany`
  - Layer 1 成功
  - Layer 2 成功
  - Layer 3 成功
  - 所有層失敗
- [ ] Mock Supabase client
- [ ] 覆蓋率 > 90%

**驗證標準**：
```bash
npm run test oauth-setup.test.ts
# 所有測試通過
# 覆蓋率 > 90%
```

**估計時間**：3-4 小時

---

### Task 3.2: 撰寫整合測試

**描述**：測試完整的 OAuth 流程，包括 Database Trigger 和 RPC function。

**檔案**：`__tests__/integration/oauth-flow.test.ts`

**實作內容**：
- [ ] 設定測試環境（測試資料庫）
- [ ] 測試場景 1：新用戶 OAuth 登入（Trigger 成功）
  - 插入 auth.users 記錄
  - 驗證 Trigger 建立所有資料
  - 驗證資料完整性
- [ ] 測試場景 2：新用戶 OAuth 登入（Trigger 失敗，RPC 成功）
  - 禁用 Trigger
  - 調用 RPC function
  - 驗證資料完整性
- [ ] 測試場景 3：並發建立（advisory lock）
  - 同時調用兩次 RPC
  - 驗證只建立一個公司
- [ ] 清理測試資料

**驗證標準**：
```bash
npm run test:integration
# 所有整合測試通過
# 資料庫狀態正確
```

**估計時間**：4-5 小時

---

### Task 3.3: 執行手動測試（8 個場景）

**描述**：使用真實的 Google OAuth 執行 8 個關鍵測試場景。

**工具**：
- Chrome DevTools
- Supabase Dashboard
- 測試帳號（多個）

**測試場景**：
1. [ ] **新用戶首次 Google OAuth 登入**
   - 驗證：成功進入 dashboard
   - 驗證：公司、訂閱、tokens、推薦碼都已建立
   - 驗證：Metrics path = 'trigger_success' 或 'fallback_success'

2. [ ] **已存在用戶再次 OAuth 登入**
   - 驗證：成功進入 dashboard
   - 驗證：沒有建立新公司
   - 驗證：Metrics path = 'existing'
   - 驗證：延遲 < 200ms

3. [ ] **Database Trigger 延遲執行**
   - 模擬：在 Trigger 中加入 `pg_sleep(2)`
   - 驗證：系統等待並成功（Layer 2）
   - 驗證：Metrics path = 'trigger_success', delay ≈ 2000ms

4. [ ] **Database Trigger 完全失敗**
   - 模擬：禁用 Trigger
   - 驗證：Fallback 成功建立公司（Layer 3）
   - 驗證：Metrics path = 'fallback_success'
   - 驗證：所有資料完整

5. [ ] **並發登入（多個 tab）**
   - 操作：同時在兩個 tab 完成 OAuth 授權
   - 驗證：只建立一個公司
   - 驗證：兩個 tab 都成功進入 dashboard

6. [ ] **網路不穩定情況**
   - 模擬：DevTools → Network → Slow 3G
   - 驗證：系統能處理超時
   - 驗證：最終成功或顯示清晰錯誤

7. [ ] **用戶取消 Google 授權**
   - 操作：在 Google 授權頁面點擊「取消」
   - 驗證：返回登入頁面
   - 驗證：顯示「您已取消授權」訊息

8. [ ] **已有公司的用戶使用 OAuth 登入**
   - 前提：用戶之前用 Email 註冊
   - 操作：同一 email 使用 Google OAuth
   - 驗證：成功登入
   - 驗證：使用現有公司，不建立新的

**驗證資料完整性 SQL**：
```sql
SELECT
  u.id, u.email,
  c.id as company_id, c.name,
  s.plan_name,
  ott.balance as tokens,
  rc.code as referral_code
FROM auth.users u
LEFT JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN companies c ON cm.company_id = c.id
LEFT JOIN company_subscriptions cs ON c.id = cs.company_id
LEFT JOIN subscriptions s ON cs.subscription_id = s.id
LEFT JOIN one_time_tokens ott ON c.id = ott.company_id
LEFT JOIN referral_codes rc ON u.id = rc.user_id
WHERE u.email = 'test@example.com';

-- 預期：所有欄位都有值（非 NULL）
```

**估計時間**：3-4 小時

---

### Task 3.4: 效能測試

**描述**：測試 OAuth 登入的效能指標。

**工具**：
- Apache Bench 或 k6
- Supabase Dashboard (Metrics)

**測試內容**：
- [ ] 負載測試：模擬 10 個並發 OAuth 登入
- [ ] 測量 P50, P95, P99 延遲
- [ ] 測量資料庫連接數
- [ ] 測量 Trigger 平均執行時間
- [ ] 測量 RPC function 平均執行時間

**驗證標準**：
- ✅ P50 < 500ms
- ✅ P95 < 1000ms
- ✅ P99 < 3000ms
- ✅ 無資料庫連接耗盡
- ✅ 無逾時錯誤

**估計時間**：2-3 小時

---

## Phase 4: 部署和監控（1 天）

### Task 4.1: 部署到 Staging 環境

**描述**：將所有變更部署到 Staging 環境進行最終驗證。

**實作內容**：
- [ ] 部署 Migrations 到 Staging Supabase
- [ ] 部署應用代碼到 Vercel Preview
- [ ] 執行完整測試場景（Task 3.3 的 8 個場景）
- [ ] 檢查監控指標
- [ ] 檢查錯誤日誌

**驗證標準**：
- ✅ 所有 8 個測試場景通過
- ✅ Metrics 正確記錄
- ✅ 無錯誤日誌
- ✅ 效能符合預期

**估計時間**：2-3 小時

---

### Task 4.2: 生產環境資料補償

**描述**：為現有的 OAuth 用戶補充缺失的 `one_time_tokens` 和 `referral_codes`。

**檔案**：`scripts/backfill-oauth-users.sql` (建立臨時腳本)

**實作內容**：
- [ ] 建立補償 SQL 腳本
  ```sql
  -- 找出缺少 tokens 的 OAuth 用戶
  SELECT ...

  -- 補充 tokens
  INSERT INTO one_time_tokens ...

  -- 補充推薦碼
  INSERT INTO referral_codes ...
  ```
- [ ] 在 Staging 環境測試腳本
- [ ] 在 Production 執行前備份資料
- [ ] 執行補償腳本
- [ ] 驗證補償結果

**驗證標準**：
```sql
-- 檢查沒有缺失的資料
SELECT COUNT(*) FROM auth.users u
LEFT JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN one_time_tokens ott ON cm.company_id = ott.company_id
WHERE ott.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';
-- 預期：0
```

**估計時間**：1-2 小時

---

### Task 4.3: 部署到 Production

**描述**：將所有變更部署到 Production 環境。

**實作內容**：
- [ ] 建立部署計畫文檔
- [ ] 準備回滾腳本
- [ ] 部署 Migrations 到 Production Supabase
  - 執行 Migration 1: RPC function
  - 執行 Migration 2: Trigger 更新
  - 執行 Migration 3: 監控表
- [ ] 執行資料補償腳本（Task 4.2）
- [ ] 部署應用代碼到 Production Vercel
  - 使用 `vercel --prod`
  - 或合併到 main branch 觸發自動部署
- [ ] 驗證部署成功
  - 測試一次真實的 OAuth 登入
  - 檢查 Metrics 記錄
  - 檢查應用日誌

**驗證標準**：
- ✅ Migrations 成功執行
- ✅ 應用部署成功
- ✅ 真實 OAuth 登入測試通過
- ✅ Metrics 正確記錄

**估計時間**：1-2 小時

---

### Task 4.4: 配置監控和警報

**描述**：設定監控儀表板和警報規則。

**工具**：
- Supabase Dashboard (或 Metabase, Grafana)
- Email/Slack 通知

**實作內容**：
- [ ] 建立監控查詢
  - 路徑分佈（existing/trigger_success/fallback_success/failed）
  - Trigger 延遲（P50, P95, P99）
  - Fallback 觸發率
- [ ] 建立儀表板
  - 實時路徑分佈圓餅圖
  - 延遲時間線圖
  - Fallback 觸發率趨勢
- [ ] 配置警報規則
  - Fallback 觸發率 > 5% → 警告
  - 任何 `failed` 事件 → 嚴重警報
  - Trigger 延遲 > 3000ms → 警告
- [ ] 測試警報（手動觸發）

**驗證標準**：
- ✅ 儀表板顯示正確資料
- ✅ 警報規則可觸發
- ✅ 通知發送成功

**估計時間**：2-3 小時

---

### Task 4.5: 24-48 小時密集監控

**描述**：部署後進行密集監控，確保系統穩定運行。

**實作內容**：
- [ ] 每 2 小時檢查一次監控儀表板
- [ ] 記錄關鍵指標
  - 總 OAuth 登入次數
  - 路徑分佈
  - 平均延遲
  - Fallback 觸發次數
  - 失敗次數（必須為 0）
- [ ] 檢查錯誤日誌
- [ ] 如有異常，立即調查
- [ ] 準備回滾（如需要）

**驗證標準**（24 小時後）：
- ✅ Fallback 觸發率 < 5%
- ✅ 失敗次數 = 0
- ✅ P95 延遲 < 1000ms
- ✅ 無異常錯誤日誌

**估計時間**：分散在 24-48 小時內

---

### Task 4.6: 更新文檔

**描述**：更新專案文檔，記錄 OAuth 流程的變更。

**檔案**：
- `docs/OAUTH_FLOW.md` (新建)
- `README.md` (更新)
- `CHANGELOG.md` (更新)

**實作內容**：
- [ ] 撰寫 OAuth 流程文檔
  - 三層防護機制說明
  - 架構圖
  - 故障排除指南
- [ ] 更新 README
  - 加入 OAuth 設定說明
  - 加入環境變數說明
- [ ] 更新 CHANGELOG
  - 記錄此次變更
  - 版本號碼
  - 破壞性變更說明（如有）

**驗證標準**：
- ✅ 文檔清晰易懂
- ✅ 包含所有必要資訊
- ✅ 架構圖正確

**估計時間**：2-3 小時

---

## 附加任務（可選）

### Task A.1: 加入 Feature Flag

**描述**：加入 feature flag 以便快速切換新舊邏輯。

**實作內容**：
- [ ] 在環境變數加入 `ENABLE_OAUTH_TRIPLE_GUARD=true`
- [ ] 在 callback route 中檢查 flag
  ```typescript
  if (process.env.ENABLE_OAUTH_TRIPLE_GUARD === 'true') {
    await ensureUserHasCompany(...);
  } else {
    // 舊邏輯
  }
  ```
- [ ] 在 Vercel 配置環境變數

**估計時間**：30 分鐘

---

### Task A.2: 加入 Rate Limiting

**描述**：防止 OAuth callback 被濫用。

**實作內容**：
- [ ] 建立 `checkRateLimit(userId)` 函數
- [ ] 查詢 5 分鐘內的 oauth_login_metrics
- [ ] 如果次數 >= 1，拒絕請求
- [ ] 在 callback route 中整合

**估計時間**：1 小時

---

## 任務依賴關係

```
Phase 1 (基礎設施)
├─ Task 1.1 (RPC Function)
├─ Task 1.2 (Trigger Update)
└─ Task 1.3 (Metrics Table)
   └─ Task 1.4 (Deploy to Staging) ✓ 全部完成後

Phase 2 (核心邏輯)
├─ Task 2.1 (OAuth Setup Module) ← 依賴 Task 1.4
├─ Task 2.2 (Callback Route) ← 依賴 Task 2.1
└─ Task 2.3 (Refactor signUp) ← 可獨立，可選

Phase 3 (測試)
├─ Task 3.1 (Unit Tests) ← 依賴 Task 2.1
├─ Task 3.2 (Integration Tests) ← 依賴 Task 2.2
├─ Task 3.3 (Manual Tests) ← 依賴 Task 2.2
└─ Task 3.4 (Performance Tests) ← 依賴 Task 3.3

Phase 4 (部署)
├─ Task 4.1 (Staging Deploy) ← 依賴 Phase 3 全部完成
├─ Task 4.2 (Data Backfill Script) ← 可並行準備
├─ Task 4.3 (Production Deploy) ← 依賴 Task 4.1, 4.2
├─ Task 4.4 (Monitoring Setup) ← 可並行準備
├─ Task 4.5 (48h Monitoring) ← 依賴 Task 4.3
└─ Task 4.6 (Documentation) ← 可並行進行
```

---

## 檢查清單

### Phase 1 完成標準
- [ ] 所有 3 個 Migrations 已建立
- [ ] Migrations 已部署到測試環境
- [ ] RPC function 可正常調用
- [ ] Database Trigger 可正常觸發
- [ ] 監控表可寫入資料

### Phase 2 完成標準
- [ ] `oauth-setup.ts` 模組已完成
- [ ] 單元測試覆蓋率 > 90%
- [ ] OAuth callback route 已整合新邏輯
- [ ] TypeScript 編譯無錯誤
- [ ] Lint 檢查通過

### Phase 3 完成標準
- [ ] 所有單元測試通過
- [ ] 所有整合測試通過
- [ ] 8 個手動測試場景全部通過
- [ ] 效能測試達標（P95 < 1s）
- [ ] 無已知 bugs

### Phase 4 完成標準
- [ ] Staging 環境測試全部通過
- [ ] 資料補償腳本執行成功
- [ ] Production 部署成功
- [ ] 監控儀表板運作正常
- [ ] 48 小時監控無異常
- [ ] 文檔已更新

---

## 風險和緩解

| 任務 | 風險 | 緩解措施 |
|------|------|----------|
| 1.1-1.3 | Migration 錯誤 | 先在測試環境驗證，準備回滾腳本 |
| 2.1 | 邏輯錯誤 | 完整單元測試，代碼審查 |
| 3.3 | 測試不充分 | 8 個場景全部執行，記錄測試結果 |
| 4.2 | 資料補償錯誤 | 先備份，測試環境驗證，小批次執行 |
| 4.3 | 生產部署失敗 | 準備回滾計畫，分階段部署 |
| 4.5 | 未發現的問題 | 密集監控，快速回滾準備 |

---

## 時間分配建議

| Phase | 任務數 | 估計時間 | 建議日程 |
|-------|-------|----------|----------|
| Phase 1 | 4 | 1-2 天 | Day 1-2 |
| Phase 2 | 3 | 2-3 天 | Day 3-5 |
| Phase 3 | 4 | 2-3 天 | Day 6-8 |
| Phase 4 | 6 | 1 天 + 持續監控 | Day 9 + 2 天監控 |
| **總計** | **17** | **6-9 天** | - |

---

**建立日期**: 2025-11-10
**最後更新**: 2025-11-10
**狀態**: 待開始
