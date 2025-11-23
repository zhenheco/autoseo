-- =====================================================
-- 過渡到 Token 計費系統
-- =====================================================
-- 此 migration 將舊的文章計費系統轉換為新的 Token 計費系統

-- 1. 備份舊的訂閱方案表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS subscription_plans_backup AS SELECT * FROM subscription_plans';
  END IF;
END $$;

-- 2. 備份舊的訂閱表
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS subscriptions_backup AS SELECT * FROM subscriptions';
  END IF;
END $$;

-- 3. 刪除舊表和不相容的表（保留備份）
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS token_packages CASCADE;
DROP TABLE IF EXISTS token_purchases CASCADE;
DROP TABLE IF EXISTS token_usage_logs CASCADE;
DROP TABLE IF EXISTS token_balance_changes CASCADE;
DROP TABLE IF EXISTS monthly_token_usage_stats CASCADE;
DROP TABLE IF EXISTS company_subscriptions CASCADE;
DROP TABLE IF EXISTS ai_model_pricing CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;
DROP TABLE IF EXISTS company_referral_codes CASCADE;
DROP TABLE IF EXISTS resellers CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;

-- 4. 記錄備份完成
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_plans_backup') THEN
    EXECUTE 'COMMENT ON TABLE subscription_plans_backup IS ''文章計費系統的備份 - 備份時間: 2025-10-30''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions_backup') THEN
    EXECUTE 'COMMENT ON TABLE subscriptions_backup IS ''舊訂閱記錄的備份 - 備份時間: 2025-10-30''';
  END IF;
END $$;
