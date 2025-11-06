# 重置 ace@zhenhe-co.com 帳號為 FREE 方案

## 📋 概況

將 `ace@zhenhe-co.com` 帳號從 PRO 方案重置為 FREE 方案，提供一次性 20,000 tokens。

## ✅ 前端顯示確認

前端所有顯示**完全由資料庫驅動**：

### 1. 訂閱頁面 (`/dashboard/subscription`)
- 從 `companies.subscription_tier` 讀取方案類型
- 從 `company_subscriptions` 讀取：
  - `monthly_quota_balance` (月配額餘額)
  - `purchased_token_balance` (購買的 tokens)
  - `monthly_token_quota` (月配額總額)
  - `current_period_end` (配額重置日)

### 2. Token 餘額卡片 (Dashboard)
- 調用 `/api/token-balance` API
- API 從資料庫查詢 `company_subscriptions` 和 `companies` 表
- 完全實時顯示資料庫數據

### 3. 其他頁面
- 所有權限檢查基於 `companies.subscription_tier`
- 所有 token 扣款基於 `company_subscriptions` 表

## 🔧 重置方法

### 選項 1: 使用 Supabase Dashboard (推薦)

1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 執行以下 SQL：

```sql
-- 重置 ace@zhenhe-co.com 為 FREE 方案
DO $$
DECLARE
  v_company_id UUID;
  v_free_plan_id UUID;
  v_current_sub_id UUID;
BEGIN
  -- 查找公司 ID
  SELECT cm.company_id INTO v_company_id
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'ace@zhenhe-co.com'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION '找不到公司';
  END IF;

  -- 查找 FREE 方案 ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  -- 查找當前活躍訂閱
  SELECT id INTO v_current_sub_id
  FROM company_subscriptions
  WHERE company_id = v_company_id
    AND status = 'active'
  LIMIT 1;

  -- 更新或創建訂閱為 FREE 方案
  IF v_current_sub_id IS NOT NULL THEN
    UPDATE company_subscriptions
    SET subscription_plan_id = v_free_plan_id,
        monthly_token_quota = 0,          -- FREE 方案沒有月配額
        monthly_quota_balance = 0,
        purchased_token_balance = 20000,  -- 一次性 20k tokens
        current_period_start = NULL,
        current_period_end = NULL,
        status = 'active',
        updated_at = NOW()
    WHERE id = v_current_sub_id;
  ELSE
    INSERT INTO company_subscriptions (
      company_id, subscription_plan_id,
      monthly_token_quota, monthly_quota_balance, purchased_token_balance,
      current_period_start, current_period_end, status
    ) VALUES (
      v_company_id, v_free_plan_id,
      0, 0, 20000,
      NULL, NULL, 'active'
    );
  END IF;

  -- 更新 companies 表
  UPDATE companies
  SET subscription_tier = 'free'
  WHERE id = v_company_id;

  -- 顯示結果
  RAISE NOTICE '✅ 重置完成';
  RAISE NOTICE 'Company ID: %', v_company_id;

END $$;

-- 驗證結果
SELECT
  c.name,
  c.subscription_tier,
  cs.monthly_token_quota,
  cs.monthly_quota_balance,
  cs.purchased_token_balance,
  (cs.monthly_quota_balance + cs.purchased_token_balance) as total_balance
FROM companies c
JOIN company_members cm ON c.id = cm.company_id
JOIN auth.users u ON cm.user_id = u.id
JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.status = 'active'
WHERE u.email = 'ace@zhenhe-co.com';
```

### 選項 2: 使用準備好的 SQL 腳本

執行以下文件：
```bash
# 在 Supabase SQL Editor 中執行
scripts/reset-ace-to-free.sql
```

## 📊 預期結果

重置後，`ace@zhenhe-co.com` 帳號應顯示：

| 欄位 | 值 |
|------|-----|
| 方案類型 | FREE (免費方案) |
| 月配額 | 0 / 0 |
| 購買 Tokens (一次性) | 20,000 |
| 總餘額 | 20,000 |
| 配額重置日 | - (FREE 方案無重置) |

## 🔍 驗證步驟

1. 登入 `ace@zhenhe-co.com` 帳號
2. 前往 `/dashboard/subscription`
3. 確認顯示：
   - 方案類型：免費方案
   - 購買 Tokens: 20,000
   - 總餘額：20,000
4. 檢查 Dashboard Token 餘額卡片
   - 應顯示「一次性 Token 餘額」
   - 總餘額：20,000

## 🎯 FREE 方案特性

根據目前實現：
- ✅ **一次性 20,000 tokens** (不會每月重置)
- ✅ 可以寫文章
- ❌ **不能連接 WordPress 網站** (wordpress_sites: 0)
- ❌ 沒有月配額 (monthly_token_quota: 0)
- ❌ 沒有配額重置日期

## 📝 技術細節

### 資料庫變更

**company_subscriptions 表：**
```sql
subscription_plan_id: <FREE plan UUID>
monthly_token_quota: 0
monthly_quota_balance: 0
purchased_token_balance: 20000
current_period_start: NULL
current_period_end: NULL
status: 'active'
```

**companies 表：**
```sql
subscription_tier: 'free'
```

### 前端自動更新

重置後，前端會自動從資料庫讀取新數據：
- TokenBalanceCard 組件會顯示「一次性 Token 餘額」
- 訂閱頁面會顯示「免費方案」
- 權限檢查會阻止連接網站功能

---

## 🚨 注意事項

1. **推薦系統已啟用**：此帳號會有推薦碼，可以邀請朋友獲得獎勵
2. **Token 不會過期**：20k tokens 是永久有效的
3. **無法連接網站**：FREE 方案無法使用 WordPress 連接功能
4. **資料庫驅動**：所有前端顯示都從資料庫實時讀取，不會有快取問題
