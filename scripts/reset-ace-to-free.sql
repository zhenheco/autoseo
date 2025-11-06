-- 重置 ace@zhenhe-co.com 帳號為 FREE 方案
-- 執行前請先確認環境

DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_free_plan_id UUID;
  v_current_sub_id UUID;
BEGIN
  -- 1. 查找用戶 (需要在 Supabase Dashboard 手動查詢 auth.users)
  -- SELECT id FROM auth.users WHERE email = 'ace@zhenhe-co.com';

  -- 2. 通過 company_members 查找公司 ID
  SELECT cm.company_id INTO v_company_id
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'ace@zhenhe-co.com'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION '找不到公司';
  END IF;

  RAISE NOTICE '找到公司 ID: %', v_company_id;

  -- 3. 查找 FREE 方案 ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RAISE EXCEPTION '找不到 FREE 方案';
  END IF;

  RAISE NOTICE 'FREE 方案 ID: %', v_free_plan_id;

  -- 4. 查找當前活躍訂閱
  SELECT id INTO v_current_sub_id
  FROM company_subscriptions
  WHERE company_id = v_company_id
    AND status = 'active'
  LIMIT 1;

  -- 5. 更新或創建訂閱為 FREE 方案
  IF v_current_sub_id IS NOT NULL THEN
    -- 更新現有訂閱
    UPDATE company_subscriptions
    SET subscription_plan_id = v_free_plan_id,
        monthly_token_quota = 0,
        monthly_quota_balance = 0,
        purchased_token_balance = 20000, -- 一次性 20k tokens
        current_period_start = NULL,
        current_period_end = NULL,
        status = 'active',
        updated_at = NOW()
    WHERE id = v_current_sub_id;

    RAISE NOTICE '訂閱已更新: %', v_current_sub_id;
  ELSE
    -- 創建新訂閱
    INSERT INTO company_subscriptions (
      company_id,
      subscription_plan_id,
      monthly_token_quota,
      monthly_quota_balance,
      purchased_token_balance,
      current_period_start,
      current_period_end,
      status
    ) VALUES (
      v_company_id,
      v_free_plan_id,
      0,
      0,
      20000,
      NULL,
      NULL,
      'active'
    );

    RAISE NOTICE '新訂閱已創建';
  END IF;

  -- 6. 更新 companies 表的 subscription_tier
  UPDATE companies
  SET subscription_tier = 'free'
  WHERE id = v_company_id;

  RAISE NOTICE '公司方案已更新為 free';

  -- 7. 顯示最終狀態
  RAISE NOTICE '-------------------';
  RAISE NOTICE '重置完成！';
  RAISE NOTICE '最終狀態:';

  FOR v_current_sub_id IN
    SELECT
      cs.id,
      sp.name as plan_name,
      cs.monthly_token_quota,
      cs.monthly_quota_balance,
      cs.purchased_token_balance,
      (cs.monthly_quota_balance + cs.purchased_token_balance) as total_balance
    FROM company_subscriptions cs
    JOIN subscription_plans sp ON cs.subscription_plan_id = sp.id
    WHERE cs.company_id = v_company_id
      AND cs.status = 'active'
  LOOP
    RAISE NOTICE 'Subscription ID: %', v_current_sub_id;
  END LOOP;

END $$;
