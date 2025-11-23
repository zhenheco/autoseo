# 🚀 聯盟行銷系統 Migration 執行指南

## 方法一：使用 Supabase Dashboard（推薦 ✅）

這是**最簡單**且**最安全**的方式！

### 步驟：

1. **前往 Supabase Dashboard**
   - 打開：https://supabase.com/dashboard/project/vdjzeregvyimgzflfalv
   - 點擊左側 **SQL Editor**

2. **執行步驟 1：創建 affiliates 表**

   ```sql
   -- 複製 supabase/migrations/step1_affiliates.sql 的內容
   -- 貼到 SQL Editor
   -- 點擊 Run
   ```

3. **執行步驟 2：創建 affiliate_referrals 表**

   ```sql
   -- 複製 supabase/migrations/step2_referrals.sql 的內容
   -- 貼到 SQL Editor
   -- 點擊 Run
   ```

4. **執行步驟 3：創建其他表和函數**

   ```sql
   -- 複製 supabase/migrations/step3_others.sql 的內容
   -- 貼到 SQL Editor
   -- 點擊 Run
   ```

5. **驗證結果**
   - 每個步驟執行後會顯示成功訊息
   - 最後會看到：`All tables created! | table_count: 5`

---

## 方法二：使用 psql CLI

### 前置需求：

需要資料庫連接字串，格式：

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 取得連接字串：

1. 前往 Supabase Dashboard
2. 點擊 **Settings** → **Database**
3. 找到 **Connection string** → **URI**
4. 複製並將 `[YOUR-PASSWORD]` 替換為你的資料庫密碼

### 執行指令：

```bash
# 方式 A：使用準備好的腳本
chmod +x /tmp/run_migration.sh
/tmp/run_migration.sh "你的資料庫連接字串"

# 方式 B：手動執行
psql "你的資料庫連接字串" -f supabase/migrations/step1_affiliates.sql
psql "你的資料庫連接字串" -f supabase/migrations/step2_referrals.sql
psql "你的資料庫連接字串" -f supabase/migrations/step3_others.sql
```

---

## 常見問題排查

### ❌ 如果步驟 1 失敗：

**錯誤**: `ERROR: 42703: column "company_id" does not exist`

**原因**: 可能是 PostgreSQL 版本或 schema 問題

**解決**:

1. 檢查 step1_affiliates.sql 的內容
2. 確認沒有任何 FOREIGN KEY 約束
3. 嘗試逐行執行 SQL

### ❌ 如果步驟 2 失敗：

**錯誤**: `relation "affiliates" does not exist`

**解決**: 確認步驟 1 已成功執行

### ❌ 如果步驟 3 失敗：

**錯誤**: `relation "affiliate_referrals" does not exist`

**解決**: 確認步驟 1 和 2 都已成功執行

---

## 執行完成後的驗證

在 SQL Editor 執行以下查詢來驗證所有表都已創建：

```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'affiliate%'
ORDER BY table_name;
```

**預期結果**：應該看到 5 個表

- affiliates
- affiliate_commissions
- affiliate_referrals
- affiliate_tracking_logs
- affiliate_withdrawals

---

## 🎯 建議執行順序

1. **先用 Supabase Dashboard** 執行步驟 1
2. 如果成功，繼續執行步驟 2 和 3
3. 如果失敗，把錯誤訊息告訴我，我會幫你修正

---

## 📝 SQL 檔案位置

- `supabase/migrations/step1_affiliates.sql` - 創建 affiliates 表
- `supabase/migrations/step2_referrals.sql` - 創建 affiliate_referrals 表
- `supabase/migrations/step3_others.sql` - 創建其他表和函數
