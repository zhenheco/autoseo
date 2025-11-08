-- =====================================================
-- 完整重置腳本：創建 FREE 方案 + 重置 ace 帳號
-- =====================================================

-- 步驟 1: 創建或更新 FREE 方案
INSERT INTO subscription_plans (
  name,
  slug,
  monthly_price,
  yearly_price,
  base_tokens,
  is_lifetime,
  lifetime_price,
  features,
  limits
) VALUES (
  'FREE',
  'free',
  0,
  0,
  20000, -- 20k tokens (一次性，不再每月重置)
  false,
  NULL,
  '{
    "models": ["deepseek-chat", "gemini-2-flash"],
    "wordpress_sites": 0,
    "images_per_article": 3,
    "team_members": 1,
    "user_seats": 1,
    "brand_voices": 0,
    "api_access": false,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "community",
    "article_generation": true
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false,
    "wordpress_connection": false
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  base_tokens = 20000,
  monthly_price = 0,
  yearly_price = 0,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

-- 步驟 2: 重置 ace@zhenhe-co.com 帳號為 FREE 方案
DO $$
DECLARE
  v_company_id UUID;
  v_free_plan_id UUID;
  v_current_sub_id UUID;
  v_company_name TEXT;
BEGIN
  -- 查找公司 ID 和名稱
  SELECT cm.company_id, c.name INTO v_company_id, v_company_name
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  JOIN companies c ON cm.company_id = c.id
  WHERE u.email = 'ace@zhenhe-co.com'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION '找不到 ace@zhenhe-co.com 的公司';
  END IF;

  RAISE NOTICE '✓ 找到公司: % (ID: %)', v_company_name, v_company_id;

  -- 查找 FREE 方案 ID
  SELECT id INTO v_free_plan_id
  FROM subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RAISE EXCEPTION '找不到 FREE 方案 (應該已在步驟 1 創建)';
  END IF;

  RAISE NOTICE '✓ 找到 FREE 方案 ID: %', v_free_plan_id;

  -- 查找當前活躍訂閱
  SELECT id INTO v_current_sub_id
  FROM company_subscriptions
  WHERE company_id = v_company_id
    AND status = 'active'
  LIMIT 1;

  -- 更新或創建訂閱為 FREE 方案
  IF v_current_sub_id IS NOT NULL THEN
    RAISE NOTICE '✓ 找到現有訂閱: %', v_current_sub_id;

    -- 更新現有訂閱
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

    RAISE NOTICE '✓ 訂閱已更新';
  ELSE
    RAISE NOTICE '✓ 沒有現有訂閱，創建新訂閱';

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

    RAISE NOTICE '✓ 新訂閱已創建';
  END IF;

  -- 更新 companies 表的 subscription_tier
  UPDATE companies
  SET subscription_tier = 'free'
  WHERE id = v_company_id;

  RAISE NOTICE '✓ 公司方案已更新為 free';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 重置完成！';
  RAISE NOTICE '========================================';

END $$;

-- 步驟 3: 驗證最終結果
SELECT
  c.name AS "公司名稱",
  c.subscription_tier AS "方案類型",
  sp.name AS "方案名稱",
  cs.monthly_token_quota AS "月配額",
  cs.monthly_quota_balance AS "月餘額",
  cs.purchased_token_balance AS "購買餘額 (一次性)",
  (cs.monthly_quota_balance + cs.purchased_token_balance) AS "總餘額"
FROM companies c
JOIN company_members cm ON c.id = cm.company_id
JOIN auth.users u ON cm.user_id = u.id
JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.status = 'active'
JOIN subscription_plans sp ON cs.subscription_plan_id = sp.id
WHERE u.email = 'ace@zhenhe-co.com';
