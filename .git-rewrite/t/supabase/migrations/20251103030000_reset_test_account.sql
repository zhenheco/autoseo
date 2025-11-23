-- =====================================================
-- 重置測試帳號 acejou27@gmail.com 到 free tier
-- =====================================================

-- 此腳本用於開發和測試環境，用於清除測試帳號的購買記錄並重置為免費方案

-- 1. 取得測試帳號的 company_id
DO $$
DECLARE
  test_company_id UUID;
BEGIN
  -- 查詢測試帳號的公司 ID
  SELECT c.id INTO test_company_id
  FROM companies c
  JOIN company_members cm ON c.id = cm.company_id
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'acejou27@gmail.com'
  LIMIT 1;

  IF test_company_id IS NULL THEN
    RAISE NOTICE '找不到測試帳號 acejou27@gmail.com 的公司記錄';
    RETURN;
  END IF;

  RAISE NOTICE '找到測試公司 ID: %', test_company_id;

  -- 2. 刪除 payment_orders 記錄
  DELETE FROM payment_orders
  WHERE company_id = test_company_id;
  RAISE NOTICE '已刪除 payment_orders 記錄';

  -- 3. 刪除 recurring_mandates 記錄
  DELETE FROM recurring_mandates
  WHERE company_id = test_company_id;
  RAISE NOTICE '已刪除 recurring_mandates 記錄';

  -- 4. 刪除 company_subscriptions 記錄
  DELETE FROM company_subscriptions
  WHERE company_id = test_company_id;
  RAISE NOTICE '已刪除 company_subscriptions 記錄';

  -- 5. 刪除 token_balance_changes 記錄（保留購買和配額更新類型）
  DELETE FROM token_balance_changes
  WHERE company_id = test_company_id
    AND change_type IN ('purchase', 'quota_renewal');
  RAISE NOTICE '已刪除 token_balance_changes 記錄';

  -- 6. 重置 companies 表為 free tier
  UPDATE companies
  SET
    subscription_tier = 'free',
    subscription_ends_at = NULL,
    seo_token_balance = 10000,
    updated_at = NOW()
  WHERE id = test_company_id;
  RAISE NOTICE '已重置 companies 表為 free tier';

  RAISE NOTICE '===== 測試帳號重置完成 =====';
  RAISE NOTICE '公司 ID: %', test_company_id;
  RAISE NOTICE '方案: free';
  RAISE NOTICE 'Token 餘額: 10000';
  RAISE NOTICE '到期日: NULL';
END $$;
