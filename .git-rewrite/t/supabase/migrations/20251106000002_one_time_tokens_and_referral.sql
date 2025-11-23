-- =====================================================
-- 一次性 tokens + 推薦獎勵系統
-- =====================================================

-- 1. 創建推薦獎勵發放 Function
CREATE OR REPLACE FUNCTION award_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
  referral_record RECORD;
  reward_tokens INTEGER := 50000; -- 推薦獎勵 50k tokens
BEGIN
  -- 只在訂單成功付款時觸發
  IF NEW.status = 'success' AND OLD.status != 'success' THEN

    -- 查找推薦關係
    SELECT r.*, r.referrer_company_id
    INTO referral_record
    FROM referrals r
    WHERE r.referred_company_id = NEW.company_id
      AND r.status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      -- 1. 給推薦人增加 50k tokens
      UPDATE company_subscriptions
      SET purchased_token_balance = purchased_token_balance + reward_tokens,
          updated_at = NOW()
      WHERE company_id = referral_record.referrer_company_id
        AND status = 'active';

      -- 2. 記錄 token 變更
      INSERT INTO token_balance_changes (
        company_id,
        change_type,
        amount,
        balance_before,
        balance_after,
        reference_id,
        description,
        created_at
      )
      SELECT
        referral_record.referrer_company_id,
        'referral_reward',
        reward_tokens,
        cs.purchased_token_balance - reward_tokens,
        cs.purchased_token_balance,
        NEW.id,
        '推薦獎勵：朋友首次付款',
        NOW()
      FROM company_subscriptions cs
      WHERE cs.company_id = referral_record.referrer_company_id
        AND cs.status = 'active';

      -- 3. 更新推薦狀態為已完成
      UPDATE referrals
      SET status = 'completed',
          first_payment_at = NOW()
      WHERE id = referral_record.id;

      -- 4. 創建獎勵記錄
      INSERT INTO referral_rewards (
        referral_id,
        company_id,
        reward_type,
        token_amount,
        description,
        created_at
      ) VALUES (
        referral_record.id,
        referral_record.referrer_company_id,
        'first_payment',
        reward_tokens,
        '推薦朋友首次付款獎勵',
        NOW()
      );

      -- 5. 更新推薦統計
      UPDATE company_referral_codes
      SET successful_referrals = successful_referrals + 1,
          total_rewards_tokens = total_rewards_tokens + reward_tokens
      WHERE company_id = referral_record.referrer_company_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 創建觸發器：當付款成功時自動發放推薦獎勵
DROP TRIGGER IF EXISTS trigger_award_referral_bonus ON payment_orders;

CREATE TRIGGER trigger_award_referral_bonus
  AFTER UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION award_referral_bonus();

-- 4. 權限設定
GRANT EXECUTE ON FUNCTION award_referral_bonus() TO service_role;
GRANT EXECUTE ON FUNCTION award_referral_bonus() TO postgres;

-- 5. 註解說明
COMMENT ON FUNCTION award_referral_bonus() IS '當被推薦人首次付款成功時，自動給推薦人發放 50,000 tokens 獎勵';
COMMENT ON TRIGGER trigger_award_referral_bonus ON payment_orders IS '監聽付款狀態變更，自動發放推薦獎勵';

-- 6. 增加推薦計數的 RPC 函數（原子操作）
CREATE OR REPLACE FUNCTION increment_referral_count(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE company_referral_codes
  SET total_referrals = total_referrals + 1
  WHERE company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_referral_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_referral_count(UUID) TO postgres;
GRANT EXECUTE ON FUNCTION increment_referral_count(UUID) TO authenticated;

COMMENT ON FUNCTION increment_referral_count(UUID) IS '原子性地增加公司的推薦計數';
