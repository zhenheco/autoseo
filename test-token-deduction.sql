-- 測試冪等性 Token 扣款功能

-- 1. 查詢測試用的 company_id（使用現有的公司）
SELECT 
  c.id as company_id,
  cs.monthly_quota_balance,
  cs.purchased_token_balance,
  (cs.monthly_quota_balance + cs.purchased_token_balance) as total_balance
FROM companies c
JOIN company_subscriptions cs ON c.id = cs.company_id
WHERE cs.status = 'active'
LIMIT 1;

-- 2. 測試扣款函數（使用測試 idempotency_key）
-- 注意：這是測試，實際扣款請使用真實的 company_id
SELECT deduct_tokens_atomic(
  'test-idempotency-key-' || extract(epoch from now())::text,
  (SELECT id FROM companies LIMIT 1),
  NULL,
  100
) as result;

-- 3. 查看扣款記錄
SELECT * FROM token_deduction_records 
ORDER BY created_at DESC 
LIMIT 3;
