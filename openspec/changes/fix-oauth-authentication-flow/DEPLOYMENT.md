# OAuth 認證流程修復 - 部署指南

## 概述

本文檔說明如何將 OAuth 認證流程修復部署到生產環境。

---

## 已完成的實作

### Phase 1: 基礎設施 ✅

1. **RPC Function Migration** - `supabase/migrations/20251110203508_create_oauth_setup_rpc.sql`
   - 建立 `create_company_for_oauth_user()` RPC function
   - 包含 advisory lock 防止並發建立
   - 建立完整的公司資料（companies, subscriptions, tokens, referral_codes）

2. **Database Trigger Migration** - `supabase/migrations/20251110203552_update_oauth_trigger.sql`
   - 更新 `handle_new_oauth_user` trigger
   - 建立 one_time_tokens 和 referral_codes
   - 與 RPC function 邏輯一致

3. **監控表 Migration** - `supabase/migrations/20251110203624_create_oauth_metrics_table.sql`
   - 建立 `oauth_login_metrics` 表
   - 包含 RLS policies 和索引
   - 包含 30 天資料保留清理函數

### Phase 2: 核心邏輯 ✅

4. **OAuth Setup 模組** - `src/lib/auth/oauth-setup.ts`
   - 實作三層防護機制
   - Layer 1: 檢查現有公司（快速路徑）
   - Layer 2: 輪詢等待 Database Trigger（指數退避）
   - Layer 3: Fallback 手動建立（調用 RPC）
   - 監控指標記錄

5. **OAuth Callback Route** - `src/app/auth/callback/route.ts`
   - 整合 `ensureUserHasCompany`
   - 完整的錯誤處理
   - 詳細的結構化日誌

---

## 部署步驟

### 第一步：部署 Database Migrations

**選項 A：使用 Supabase Dashboard（建議）**

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 前往 "SQL Editor"
4. 依序執行以下 migrations：

   a. **建立 RPC Function**
   ```sql
   -- 複製並執行 supabase/migrations/20251110203508_create_oauth_setup_rpc.sql 的內容
   ```

   b. **更新 Database Trigger**
   ```sql
   -- 複製並執行 supabase/migrations/20251110203552_update_oauth_trigger.sql 的內容
   ```

   c. **建立監控表**
   ```sql
   -- 複製並執行 supabase/migrations/20251110203624_create_oauth_metrics_table.sql 的內容
   ```

5. 確認每個 migration 都成功執行（無錯誤訊息）

**選項 B：使用 Supabase CLI（如已安裝）**

```bash
# 確保 Supabase CLI 已安裝
npm install -g supabase

# 登入
supabase login

# 連接到專案
supabase link --project-ref <your-project-ref>

# 推送 migrations
supabase db push
```

### 第二步：驗證 Migrations

在 Supabase Dashboard 的 SQL Editor 執行以下驗證查詢：

```sql
-- 1. 驗證 RPC function 存在
SELECT
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'create_company_for_oauth_user';

-- 2. 驗證 Trigger 存在
SELECT
  tgname,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 3. 驗證監控表存在
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'oauth_login_metrics';

-- 4. 測試 RPC function（使用測試資料）
-- 注意：這會建立真實資料，測試後請刪除
SELECT * FROM create_company_for_oauth_user(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'test@example.com',
  'Test Company'
);

-- 清理測試資料
DELETE FROM companies WHERE email = 'test@example.com';
```

預期結果：
- ✅ RPC function 定義存在且包含完整邏輯
- ✅ Trigger 綁定到 `auth.users` 表
- ✅ `oauth_login_metrics` 表包含所有欄位
- ✅ RPC function 可成功建立公司資料

### 第三步：部署應用程式代碼

```bash
# 確保所有變更已 commit
git add .
git commit -m "新增: 實作 OAuth 認證流程三層防護機制

完成 Phase 1 & 2:
- 建立 RPC function, Database Trigger, 監控表
- 實作 OAuth Setup 模組（三層防護）
- 整合 OAuth Callback Route

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 推送到遠端
git push origin main
```

Vercel 會自動偵測並部署新代碼。

### 第四步：驗證部署

部署完成後（約 2-3 分鐘），執行以下測試：

1. **測試 OAuth 登入**
   - 前往您的應用 `/login` 頁面
   - 點擊「使用 Google 登入」
   - 完成 Google 授權
   - 驗證是否成功進入 dashboard

2. **檢查監控指標**
   在 Supabase Dashboard SQL Editor 執行：
   ```sql
   SELECT
     path,
     COUNT(*) as count,
     AVG(trigger_delay_ms) as avg_delay_ms
   FROM oauth_login_metrics
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY path;
   ```

   預期看到以下其中一種路徑：
   - `existing`: 現有用戶登入（最快，< 200ms）
   - `trigger_success`: Trigger 成功（通常 < 1s）
   - `fallback_success`: Fallback 成功（約 3-4s）
   - `failed`: **不應該出現**

3. **檢查應用日誌**
   在 Vercel Dashboard 查看 Function Logs，搜尋 `[OAuth]`，應該看到：
   ```
   [OAuth] Starting company setup for user <user-id>
   [OAuth] Layer X success: ... (<delay>ms)
   [OAuth Callback] Company setup succeeded via <path> (<delay>ms)
   ```

---

## 監控和維護

### 關鍵指標

在 Supabase Dashboard 建立以下查詢作為監控：

1. **路徑分佈（過去 24 小時）**
   ```sql
   SELECT
     path,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
   FROM oauth_login_metrics
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY path
   ORDER BY count DESC;
   ```

   **健康狀態**：
   - `existing` > 80%（成熟產品）
   - `trigger_success` 5-15%（新用戶）
   - `fallback_success` < 5%
   - `failed` = 0%

2. **延遲分析**
   ```sql
   SELECT
     percentile_cont(0.50) WITHIN GROUP (ORDER BY trigger_delay_ms) as p50,
     percentile_cont(0.95) WITHIN GROUP (ORDER BY trigger_delay_ms) as p95,
     percentile_cont(0.99) WITHIN GROUP (ORDER BY trigger_delay_ms) as p99
   FROM oauth_login_metrics
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

   **健康狀態**：
   - P50 < 500ms
   - P95 < 1000ms
   - P99 < 3000ms

### 警報設定

建議設定以下警報（使用 Supabase Webhooks 或外部監控）：

- **嚴重**: 任何 `failed` 事件 → 立即通知
- **警告**: Fallback 觸發率 > 5% → 檢查 Database Trigger
- **警告**: P95 延遲 > 3000ms → 檢查資料庫效能

### 資料清理

監控表會自動保留 30 天資料。可以手動執行清理：

```sql
SELECT cleanup_old_oauth_metrics();
```

或設定 cron job（需要 Supabase Pro 計畫）：

```sql
SELECT cron.schedule(
  'cleanup-oauth-metrics',
  '0 2 * * *',
  'SELECT cleanup_old_oauth_metrics()'
);
```

---

## 故障排除

### 問題 1: OAuth 登入後被重定向回登入頁面

**可能原因**：
- Database Trigger 和 RPC function 都失敗
- Supabase 權限問題

**診斷步驟**：
1. 檢查 `oauth_login_metrics` 表中的最新記錄
2. 查看應用日誌中的 `[OAuth]` 訊息
3. 在 Supabase Dashboard 的 Logs 查看資料庫錯誤

**解決方案**：
- 如果 `path = 'failed'`：檢查 RPC function 是否正確部署
- 如果沒有 metrics 記錄：檢查應用代碼是否正確部署

### 問題 2: Fallback 觸發率過高（> 5%）

**可能原因**：Database Trigger 執行緩慢或失敗

**診斷步驟**：
1. 檢查 Trigger 延遲：
   ```sql
   SELECT AVG(trigger_delay_ms), MAX(trigger_delay_ms)
   FROM oauth_login_metrics
   WHERE path = 'fallback_success'
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

2. 檢查 Supabase Database Logs

**解決方案**：
- 如果延遲過高：考慮資料庫升級或優化
- 如果 Trigger 失敗：檢查 Trigger 函數日誌

### 問題 3: 用戶缺少 tokens 或 referral_codes

**可能原因**：使用舊版 Trigger 建立的用戶

**解決方案**：執行資料補償腳本
```sql
-- 找出缺少 tokens 的 OAuth 用戶
SELECT u.id, u.email, cm.company_id
FROM auth.users u
JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN one_time_tokens ott ON cm.company_id = ott.company_id
WHERE ott.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';

-- 補充 tokens
INSERT INTO one_time_tokens (company_id, balance)
SELECT cm.company_id, 50
FROM auth.users u
JOIN company_members cm ON u.id = cm.user_id
LEFT JOIN one_time_tokens ott ON cm.company_id = ott.company_id
WHERE ott.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';

-- 補充 referral_codes（需要先建立 generate_referral_code function）
INSERT INTO referral_codes (user_id, code)
SELECT u.id, generate_referral_code()
FROM auth.users u
LEFT JOIN referral_codes rc ON u.id = rc.user_id
WHERE rc.id IS NULL
  AND u.raw_app_meta_data->>'provider' != 'email';
```

---

## 回滾計畫

如果發現嚴重問題需要回滾：

### 回滾應用代碼

```bash
# 方法 1: Git revert
git revert <commit-hash>
git push origin main

# 方法 2: Vercel Dashboard
# 前往 Deployments → 選擇先前版本 → Promote to Production
```

### 回滾資料庫（不建議）

**警告**：如果已有用戶透過新流程建立資料，回滾資料庫可能導致資料丟失。

建議做法：
1. **保留** migrations（不回滾資料庫）
2. **回滾** 應用代碼
3. **監控** 是否有新用戶受影響
4. 問題修復後重新部署

---

## 下一步

完成部署後，建議：

1. **監控 24-48 小時**
   - 每 2-4 小時檢查監控指標
   - 確保 `failed` 事件為 0
   - Fallback 觸發率 < 5%

2. **執行完整測試場景**
   - 新用戶 OAuth 登入
   - 現有用戶 OAuth 登入
   - 並發登入測試

3. **準備 Phase 3: 測試**
   - 撰寫單元測試
   - 撰寫整合測試
   - 執行 8 個手動測試場景

4. **文檔更新**
   - 更新 README
   - 更新 CHANGELOG
   - 建立 OAuth 流程文檔

---

## 聯絡和支援

如有問題或需要協助：

1. 檢查本文檔的「故障排除」章節
2. 查看 `openspec/changes/fix-oauth-authentication-flow/` 目錄下的其他文檔
3. 檢查應用日誌和資料庫日誌

---

**建立日期**: 2025-11-10
**最後更新**: 2025-11-10
**狀態**: Phase 1-2 完成，待部署
