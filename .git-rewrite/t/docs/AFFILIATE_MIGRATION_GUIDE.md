# 聯盟行銷系統 Migration 執行指南

## 📋 執行步驟

### 方式 1：Supabase Dashboard（推薦）

1. **登入 Supabase Dashboard**
   - 前往：https://supabase.com/dashboard
   - 選擇您的專案

2. **打開 SQL Editor**
   - 左側選單點擊 "SQL Editor"
   - 點擊 "New query"

3. **複製並執行 SQL**
   - 打開檔案：`supabase/migrations/20250115_affiliate_system.sql`
   - 複製全部內容
   - 貼到 SQL Editor
   - 點擊 "Run" 執行

4. **驗證執行結果**
   - 應該看到 "Success" 訊息
   - 檢查是否有錯誤訊息

---

### 方式 2：使用 Supabase CLI

```bash
# 1. 確保已安裝 Supabase CLI
supabase --version

# 2. 登入
supabase login

# 3. Link 到專案
supabase link --project-ref YOUR_PROJECT_REF

# 4. 執行 migration
supabase db push

# 或者直接執行單一檔案
supabase db execute --file supabase/migrations/20250115_affiliate_system.sql
```

---

### 方式 3：使用 psql（進階）

```bash
# 需要資料庫連線字串
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/20250115_affiliate_system.sql
```

---

## ✅ 驗證 Migration 成功

執行以下 SQL 查詢來確認資料表已建立：

```sql
-- 1. 檢查所有新資料表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'affiliate%'
ORDER BY table_name;
```

**應該看到以下資料表**：
- `affiliates`
- `affiliate_commissions`
- `affiliate_referrals`
- `affiliate_tracking_logs`
- `affiliate_withdrawals`

```sql
-- 2. 檢查 companies 表是否新增欄位
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('referred_by_affiliate_code', 'referred_at')
ORDER BY column_name;
```

**應該看到**：
- `referred_by_affiliate_code` (character varying)
- `referred_at` (timestamp with time zone)

```sql
-- 3. 檢查函數是否建立
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('generate_affiliate_code', 'check_inactive_affiliates', 'unlock_commissions')
ORDER BY routine_name;
```

**應該看到**：
- `check_inactive_affiliates`
- `generate_affiliate_code`
- `unlock_commissions`

---

## 🐛 常見問題排除

### 問題 1：`uuid_generate_v4()` 函數不存在

**錯誤訊息**：
```
ERROR: function uuid_generate_v4() does not exist
```

**解決方案**：
```sql
-- 在 migration 檔案最前面加上：
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

### 問題 2：外鍵約束失敗

**錯誤訊息**：
```
ERROR: foreign key constraint "affiliates_company_id_fkey" cannot be implemented
```

**原因**：`companies` 表不存在或欄位型別不符

**解決方案**：
1. 先確認 `companies` 表存在
2. 檢查 `id` 欄位是否為 UUID 型別

---

### 問題 3：RLS 政策建立失敗

**錯誤訊息**：
```
ERROR: role "auth.uid()" does not exist
```

**原因**：Supabase auth schema 未正確設定

**解決方案**：
- 確認使用的是 Supabase 專案，不是普通 PostgreSQL
- RLS 政策需要 Supabase 的 auth schema

---

### 問題 4：函數權限問題

**錯誤訊息**：
```
ERROR: permission denied for function xxx
```

**解決方案**：
```sql
-- 使用 service role key 執行，或在 SQL 中加上：
GRANT EXECUTE ON FUNCTION generate_affiliate_code() TO authenticated;
GRANT EXECUTE ON FUNCTION check_inactive_affiliates() TO service_role;
GRANT EXECUTE ON FUNCTION unlock_commissions() TO service_role;
```

---

## 🔍 測試資料庫功能

### 測試 1：生成推薦碼

```sql
SELECT generate_affiliate_code();
```

**預期結果**：返回 8 位大寫英數字，例如 `ABCD1234`

---

### 測試 2：創建測試聯盟夥伴

```sql
-- 替換 YOUR_COMPANY_ID 為實際的 company_id
INSERT INTO affiliates (
  company_id,
  affiliate_code,
  full_name,
  id_number,
  phone,
  email,
  address,
  is_resident,
  tax_rate,
  status
) VALUES (
  'YOUR_COMPANY_ID',
  (SELECT generate_affiliate_code()),
  '測試用戶',
  'A123456789',
  '0912345678',
  'test@example.com',
  '台北市信義區',
  true,
  10.00,
  'active'
) RETURNING *;
```

---

### 測試 3：查詢聯盟夥伴

```sql
SELECT
  id,
  affiliate_code,
  full_name,
  status,
  pending_commission,
  locked_commission,
  created_at
FROM affiliates
ORDER BY created_at DESC
LIMIT 5;
```

---

### 測試 4：測試佣金解鎖函數

```sql
-- 呼叫解鎖函數
SELECT unlock_commissions();

-- 查看執行結果
SELECT status, COUNT(*)
FROM affiliate_commissions
GROUP BY status;
```

---

### 測試 5：測試不活躍檢測

```sql
-- 呼叫檢測函數
SELECT check_inactive_affiliates();

-- 查看結果
SELECT status, COUNT(*)
FROM affiliates
GROUP BY status;
```

---

## 📊 Migration 完成檢查清單

執行完 Migration 後，請確認以下項目：

- [ ] ✅ 5 個資料表已建立（affiliates, affiliate_referrals, affiliate_commissions, affiliate_withdrawals, affiliate_tracking_logs）
- [ ] ✅ companies 表新增 2 個欄位（referred_by_affiliate_code, referred_at）
- [ ] ✅ 3 個函數已建立（generate_affiliate_code, check_inactive_affiliates, unlock_commissions）
- [ ] ✅ RLS 政策已啟用
- [ ] ✅ 索引已建立
- [ ] ✅ 觸發器已建立（update_updated_at）
- [ ] ✅ 測試推薦碼生成功能正常
- [ ] ✅ 測試創建聯盟夥伴成功

---

## 🚀 Migration 完成後的下一步

1. **設定 Cron Job 環境變數**
   ```bash
   # 在 Vercel 或 .env.local 中加入
   CRON_SECRET=your_random_secret_here
   ```

2. **配置 Vercel Cron Jobs**
   - 在 `vercel.json` 中加入：
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/unlock-commissions",
         "schedule": "0 * * * *"
       },
       {
         "path": "/api/cron/check-inactive-affiliates",
         "schedule": "0 2 * * *"
       }
     ]
   }
   ```

3. **測試 API 端點**
   ```bash
   # 本地測試
   npm run dev

   # 訪問測試頁面
   http://localhost:3168/dashboard/affiliate/apply
   ```

4. **整合付款 Webhook**
   - 參考 `docs/AFFILIATE_SYSTEM_DESIGN.md` 的整合說明

---

## 📞 需要協助？

如果 Migration 執行遇到問題：

1. **檢查錯誤訊息**並參考上方「常見問題排除」
2. **查看 Supabase Dashboard Logs**
3. **確認 SQL 語法正確**（複製時可能有格式問題）
4. **備份資料庫**後重新執行

---

**最後更新**：2025-01-15
