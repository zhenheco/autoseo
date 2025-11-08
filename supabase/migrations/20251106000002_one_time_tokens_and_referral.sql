-- =====================================================
-- 修改免費方案為一次性 tokens + 推薦獎勵系統
-- =====================================================

-- 1. 更新 OAuth 自動設置觸發器（改為一次性 tokens）
CREATE OR REPLACE FUNCTION handle_new_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  user_provider TEXT;
  user_email TEXT;
  company_slug TEXT;
  free_plan_id UUID;
  free_plan_tokens INTEGER;
  new_referral_code TEXT;
  referrer_code TEXT;
  referrer_company_id_var UUID;
BEGIN
  -- 取得使用者的 provider 和 email
  user_provider := NEW.raw_app_meta_data->>'provider';
  user_email := NEW.email;

  -- 只處理 OAuth 登入
  IF user_provider IS NULL OR user_provider = 'email' THEN
    RETURN NEW;
  END IF;

  -- 檢查使用者是否已經有公司
  IF EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = NEW.id AND status = 'active'
  ) THEN
    RETURN NEW;
  END IF;

  -- 取得免費方案資訊
  SELECT id, base_tokens INTO free_plan_id, free_plan_tokens
  FROM subscription_plans
  WHERE slug = 'free'
  LIMIT 1;

  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION '找不到免費方案（slug=free），請先執行 migration';
  END IF;

  -- 生成唯一的 slug
  company_slug := LOWER(
    SPLIT_PART(user_email, '@', 1) || '-' ||
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6) || '-' ||
    EXTRACT(EPOCH FROM NOW())::TEXT
  );

  -- 1. 建立公司
  INSERT INTO companies (
    name,
    slug,
    owner_id,
    subscription_tier,
    created_at,
    updated_at
  ) VALUES (
    SPLIT_PART(user_email, '@', 1) || ' 的公司',
    company_slug,
    NEW.id,
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_company_id;

  -- 2. 建立成員記錄
  INSERT INTO company_members (
    company_id,
    user_id,
    role,
    status,
    joined_at,
    created_at
  ) VALUES (
    new_company_id,
    NEW.id,
    'owner',
    'active',
    NOW(),
    NOW()
  );

  -- 3. 建立訂閱（一次性 tokens，不再每月重置）
  INSERT INTO company_subscriptions (
    company_id,
    plan_id,
    status,
    monthly_token_quota,
    monthly_quota_balance,
    purchased_token_balance,
    current_period_start,
    current_period_end,
    is_lifetime,
    lifetime_discount,
    created_at,
    updated_at
  ) VALUES (
    new_company_id,
    free_plan_id,
    'active',
    0,                    -- 免費方案不使用月配額
    0,
    free_plan_tokens,     -- 一次性給 10,000 tokens
    NULL,
    NULL,
    false,
    1.0,
    NOW(),
    NOW()
  );

  -- 4. 生成推薦碼
  new_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || new_company_id::TEXT) FROM 1 FOR 8));

  INSERT INTO company_referral_codes (
    company_id,
    referral_code,
    created_at
  ) VALUES (
    new_company_id,
    new_referral_code,
    NOW()
  );

  -- 5. 檢查是否有推薦人（從 cookie 中讀取，需要在應用層處理）
  -- 這部分在應用代碼中處理

  -- 6. 建立舊 subscriptions 記錄（向後兼容）
  INSERT INTO subscriptions (
    company_id,
    plan_name,
    status,
    monthly_article_limit,
    articles_used_this_month,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  ) VALUES (
    new_company_id,
    'free',
    'active',
    5,
    0,
    NOW(),
    NULL,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 創建推薦獎勵發放 Function
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
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO postgres;
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
