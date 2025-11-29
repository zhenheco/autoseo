-- =====================================================
-- 推薦系統輔助函數
-- =====================================================

-- 增加推薦碼點擊數
CREATE OR REPLACE FUNCTION increment_referral_clicks(p_code VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE referral_codes
  SET total_clicks = total_clicks + 1
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 增加推薦碼推薦人數
CREATE OR REPLACE FUNCTION increment_referral_count(p_code VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE referral_codes
  SET total_referrals = total_referrals + 1
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 增加成功推薦人數
CREATE OR REPLACE FUNCTION increment_successful_referrals(p_code VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE referral_codes
  SET successful_referrals = successful_referrals + 1
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- 為公司增加 tokens
CREATE OR REPLACE FUNCTION add_company_tokens(
  p_company_id UUID,
  p_tokens INTEGER,
  p_reason VARCHAR DEFAULT 'referral'
)
RETURNS void AS $$
BEGIN
  UPDATE company_subscriptions
  SET purchased_token_balance = purchased_token_balance + p_tokens
  WHERE company_id = p_company_id
    AND status = 'active';

  INSERT INTO token_usage_logs (
    company_id,
    action,
    token_change,
    new_balance,
    metadata,
    created_at
  )
  SELECT
    p_company_id,
    CASE p_reason
      WHEN 'referral_reward' THEN 'referral_reward_credited'
      WHEN 'referred_reward' THEN 'referred_reward_credited'
      ELSE 'tokens_added'
    END,
    p_tokens,
    cs.purchased_token_balance,
    jsonb_build_object('reason', p_reason, 'tokens', p_tokens),
    NOW()
  FROM company_subscriptions cs
  WHERE cs.company_id = p_company_id AND cs.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 推薦系統輔助函數建立成功！';
END $$;
