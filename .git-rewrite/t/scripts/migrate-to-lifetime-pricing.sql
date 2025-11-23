-- ============================================================================
-- 終身定價重構：資料庫遷移腳本
-- 日期：2025-11-11
-- 說明：將定價模型從混合月費/年費/終身轉為純終身定價
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: 備份現有資料
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans_backup_20251111 AS
SELECT * FROM subscription_plans;

CREATE TABLE IF NOT EXISTS company_subscriptions_backup_20251111 AS
SELECT * FROM company_subscriptions;

-- 驗證備份
DO $$
DECLARE
  plans_count INT;
  subs_count INT;
BEGIN
  SELECT COUNT(*) INTO plans_count FROM subscription_plans_backup_20251111;
  SELECT COUNT(*) INTO subs_count FROM company_subscriptions_backup_20251111;

  RAISE NOTICE '備份完成：subscription_plans (% 筆), company_subscriptions (% 筆)', plans_count, subs_count;
END $$;

-- ============================================================================
-- STEP 2: 將使用月費方案的用戶遷移到對應的終身方案
-- ============================================================================

-- 2.1 遷移 STARTER 月費用戶到 LIFETIME_STARTER
UPDATE company_subscriptions
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-starter'),
  is_lifetime = true,
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'starter' AND is_lifetime = false);

-- 2.2 遷移 PROFESSIONAL 月費用戶到 LIFETIME_PROFESSIONAL
UPDATE company_subscriptions
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-professional'),
  is_lifetime = true,
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'professional' AND is_lifetime = false);

-- 2.3 遷移 BUSINESS 月費用戶到 LIFETIME_BUSINESS
UPDATE company_subscriptions
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-business'),
  is_lifetime = true,
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'business' AND is_lifetime = false);

-- 2.4 遷移 AGENCY 月費用戶到 LIFETIME_AGENCY
UPDATE company_subscriptions
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-agency'),
  is_lifetime = true,
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'agency' AND is_lifetime = false);

-- 2.5 遷移定期付款授權到對應的終身方案
UPDATE recurring_mandates
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-starter'),
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'starter' AND is_lifetime = false);

UPDATE recurring_mandates
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-professional'),
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'professional' AND is_lifetime = false);

UPDATE recurring_mandates
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-business'),
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'business' AND is_lifetime = false);

UPDATE recurring_mandates
SET
  plan_id = (SELECT id FROM subscription_plans WHERE slug = 'lifetime-agency'),
  updated_at = NOW()
WHERE plan_id = (SELECT id FROM subscription_plans WHERE slug = 'agency' AND is_lifetime = false);

-- ============================================================================
-- STEP 3: 刪除舊的月費方案（保留 FREE）
-- ============================================================================
DELETE FROM subscription_plans
WHERE slug IN ('starter', 'professional', 'business', 'agency')
  AND is_lifetime = false;

-- ============================================================================
-- STEP 4: 更新終身方案資料（符合 proposal 規格）
-- ============================================================================

-- 4.1 更新 STARTER 終身方案
UPDATE subscription_plans
SET
  name = 'STARTER',
  slug = 'starter',
  lifetime_price = 14900.00,
  base_tokens = 50000,
  features = jsonb_build_object(
    'models', ARRAY['deepseek-chat', 'gemini-2-flash', 'gpt-4o-mini']::text[],
    'wordpress_sites', 1,
    'images_per_article', -1,
    'team_members', 1,
    'brand_voices', 1,
    'api_access', false,
    'white_label', false,
    'support_level', 'standard',
    'batch_generation', -1,
    'team_collaboration', false
  ),
  is_lifetime = true,
  updated_at = NOW()
WHERE slug = 'lifetime-starter';

-- 4.2 更新 PROFESSIONAL 終身方案
UPDATE subscription_plans
SET
  name = 'PROFESSIONAL',
  slug = 'professional',
  lifetime_price = 59900.00,
  base_tokens = 250000,
  features = jsonb_build_object(
    'models', 'all',
    'wordpress_sites', 5,
    'images_per_article', -1,
    'team_members', 3,
    'brand_voices', 3,
    'api_access', true,
    'white_label', false,
    'support_level', 'priority',
    'batch_generation', -1,
    'team_collaboration', false
  ),
  is_lifetime = true,
  updated_at = NOW()
WHERE slug = 'lifetime-professional';

-- 4.3 更新 BUSINESS 終身方案
UPDATE subscription_plans
SET
  name = 'BUSINESS',
  slug = 'business',
  lifetime_price = 149900.00,
  base_tokens = 750000,
  features = jsonb_build_object(
    'models', 'all',
    'wordpress_sites', -1,
    'images_per_article', -1,
    'team_members', 10,
    'brand_voices', -1,
    'api_access', true,
    'white_label', false,
    'support_level', 'dedicated',
    'batch_generation', -1,
    'team_collaboration', true
  ),
  is_lifetime = true,
  updated_at = NOW()
WHERE slug = 'lifetime-business';

-- 4.4 更新 AGENCY 終身方案
UPDATE subscription_plans
SET
  name = 'AGENCY',
  slug = 'agency',
  lifetime_price = 299900.00,
  base_tokens = 2000000,
  features = jsonb_build_object(
    'models', 'all',
    'wordpress_sites', -1,
    'images_per_article', -1,
    'team_members', -1,
    'brand_voices', -1,
    'api_access', true,
    'white_label', true,
    'support_level', 'dedicated',
    'batch_generation', -1,
    'team_collaboration', true
  ),
  is_lifetime = true,
  updated_at = NOW()
WHERE slug = 'lifetime-agency';

-- 注意：FREE 方案保留，因為它是註冊時的預設方案
-- FREE 方案特性：
-- 1. base_tokens = 0（不參與月配額重置）
-- 2. 用戶註冊時一次性贈送 10K tokens（存入 purchased_token_balance）
-- 3. monthly_token_quota = 0（無月配額）
UPDATE subscription_plans
SET
  base_tokens = 0,
  features = jsonb_set(
    COALESCE(features, '{}'::jsonb),
    '{support_level}',
    '"community"'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'free';

-- ============================================================================
-- STEP 5: 遷移現有訂閱
-- ============================================================================

-- 5.1 將所有訂閱標記為終身（因為我們不再有月費方案）
UPDATE company_subscriptions
SET
  is_lifetime = true,
  updated_at = NOW();

-- 5.2 更新月配額（根據新方案）
UPDATE company_subscriptions cs
SET
  monthly_token_quota = sp.base_tokens,
  monthly_quota_balance = sp.base_tokens,
  current_period_end = NOW() + INTERVAL '1 month',
  updated_at = NOW()
FROM subscription_plans sp
WHERE cs.plan_id = sp.id
  AND sp.slug != 'free';

-- FREE 用戶不需要月配額重置
UPDATE company_subscriptions cs
SET
  monthly_token_quota = 0,
  monthly_quota_balance = 0,
  current_period_end = NULL,
  updated_at = NOW()
FROM subscription_plans sp
WHERE cs.plan_id = sp.id
  AND sp.slug = 'free';

-- ============================================================================
-- STEP 6: 建立月配額重置函數
-- ============================================================================
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 重置所有付費用戶的月配額
  UPDATE company_subscriptions cs
  SET
    monthly_quota_balance = cs.monthly_token_quota,
    current_period_end = current_period_end + INTERVAL '1 month',
    updated_at = NOW()
  FROM subscription_plans sp
  WHERE cs.plan_id = sp.id
    AND sp.slug != 'free'
    AND cs.current_period_end < NOW();

  RAISE NOTICE '月配額已重置';
END;
$$;

-- ============================================================================
-- STEP 7: 驗證遷移結果
-- ============================================================================
DO $$
DECLARE
  lifetime_plans_count INT;
  monthly_plans_count INT;
  total_subs INT;
  lifetime_subs INT;
BEGIN
  -- 統計終身方案數量
  SELECT COUNT(*) INTO lifetime_plans_count
  FROM subscription_plans
  WHERE is_lifetime = true;

  -- 統計月費方案數量（應該只剩 FREE）
  SELECT COUNT(*) INTO monthly_plans_count
  FROM subscription_plans
  WHERE is_lifetime = false;

  -- 統計訂閱總數
  SELECT COUNT(*) INTO total_subs FROM company_subscriptions;

  -- 統計終身訂閱數量
  SELECT COUNT(*) INTO lifetime_subs
  FROM company_subscriptions
  WHERE is_lifetime = true;

  RAISE NOTICE '============================================';
  RAISE NOTICE '遷移完成！';
  RAISE NOTICE '終身方案數量: %', lifetime_plans_count;
  RAISE NOTICE '月費方案數量: % (應為 1，即 FREE)', monthly_plans_count;
  RAISE NOTICE '總訂閱數: %', total_subs;
  RAISE NOTICE '終身訂閱數: %', lifetime_subs;
  RAISE NOTICE '============================================';

  -- 驗證是否符合預期
  IF lifetime_plans_count != 4 THEN
    RAISE EXCEPTION '錯誤：終身方案數量應為 4，實際為 %', lifetime_plans_count;
  END IF;

  IF monthly_plans_count != 1 THEN
    RAISE WARNING '警告：月費方案數量應為 1（FREE），實際為 %', monthly_plans_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: 顯示最終方案列表
-- ============================================================================
SELECT
  name,
  slug,
  lifetime_price,
  base_tokens,
  is_lifetime,
  features->>'support_level' as support_level
FROM subscription_plans
ORDER BY
  CASE
    WHEN slug = 'free' THEN 0
    WHEN slug = 'starter' THEN 1
    WHEN slug = 'professional' THEN 2
    WHEN slug = 'business' THEN 3
    WHEN slug = 'agency' THEN 4
    ELSE 99
  END;

COMMIT;

-- ============================================================================
-- 回滾指令（如果需要）
-- ============================================================================
-- ROLLBACK;
--
-- 或者從備份還原：
-- BEGIN;
-- TRUNCATE subscription_plans CASCADE;
-- INSERT INTO subscription_plans SELECT * FROM subscription_plans_backup_20251111;
-- TRUNCATE company_subscriptions CASCADE;
-- INSERT INTO company_subscriptions SELECT * FROM company_subscriptions_backup_20251111;
-- COMMIT;
