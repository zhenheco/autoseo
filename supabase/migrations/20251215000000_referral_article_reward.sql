-- =====================================================
-- 推薦獎勵：從 Token 改為文章篇數
-- =====================================================
-- 說明：
-- 1. 擴展 referral_token_rewards 表，添加文章獎勵欄位
-- 2. 建立 RPC 函數來增加推薦獎勵文章篇數

-- =====================================================
-- 1. 擴展 referral_token_rewards 表
-- =====================================================
-- 添加文章獎勵欄位（可選，保持向後兼容）
ALTER TABLE referral_token_rewards
ADD COLUMN IF NOT EXISTS referrer_articles INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referred_articles INTEGER DEFAULT 0;

COMMENT ON COLUMN referral_token_rewards.referrer_articles IS '推薦人獲得的文章篇數獎勵';
COMMENT ON COLUMN referral_token_rewards.referred_articles IS '被推薦人獲得的文章篇數獎勵';

-- =====================================================
-- 2. 建立 RPC 函數：增加推薦獎勵文章篇數
-- =====================================================
CREATE OR REPLACE FUNCTION add_referral_article_reward(
  p_company_id UUID,
  p_articles INTEGER,
  p_reason TEXT DEFAULT 'referral_reward'
)
RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 取得當前餘額
  SELECT COALESCE(purchased_articles_remaining, 0)
  INTO v_current_balance
  FROM company_subscriptions
  WHERE company_id = p_company_id;

  -- 如果找不到訂閱記錄，返回錯誤
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Company subscription not found'
    );
  END IF;

  -- 計算新餘額
  v_new_balance := v_current_balance + p_articles;

  -- 更新餘額
  UPDATE company_subscriptions
  SET
    purchased_articles_remaining = v_new_balance,
    updated_at = NOW()
  WHERE company_id = p_company_id;

  -- 返回成功結果
  RETURN json_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'articles_added', p_articles,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_referral_article_reward IS '增加推薦獎勵文章篇數到 purchased_articles_remaining';

-- =====================================================
-- 3. 授予執行權限
-- =====================================================
GRANT EXECUTE ON FUNCTION add_referral_article_reward TO authenticated;
GRANT EXECUTE ON FUNCTION add_referral_article_reward TO service_role;
