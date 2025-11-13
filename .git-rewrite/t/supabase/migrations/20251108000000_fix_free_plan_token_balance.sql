-- 修正免費方案的 Token 餘額
-- 目的：將所有免費方案的 purchased_token_balance 從 20000 修正為 10000

-- 檢查並修正免費方案的 Token 餘額
UPDATE company_subscriptions
SET purchased_token_balance = 10000
WHERE plan_id IN (
  SELECT id
  FROM subscription_plans
  WHERE slug = 'free'
)
AND status = 'active'
AND purchased_token_balance != 10000;

-- 記錄修正結果
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '已修正 % 個免費方案的 Token 餘額', affected_count;
END $$;
