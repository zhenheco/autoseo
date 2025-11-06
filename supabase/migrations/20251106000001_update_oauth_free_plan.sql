-- =====================================================
-- 更新 OAuth 自動建立公司的觸發器
-- 使用新的免費方案（20k tokens/月）
-- =====================================================

-- 重新建立 OAuth 使用者自動設定 Function
CREATE OR REPLACE FUNCTION handle_new_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  user_provider TEXT;
  user_email TEXT;
  company_slug TEXT;
  free_plan_id UUID;
  free_plan_tokens INTEGER;
BEGIN
  -- 取得使用者的 provider 和 email
  user_provider := NEW.raw_app_meta_data->>'provider';
  user_email := NEW.email;

  -- 只處理 OAuth 登入（不是 email/password）
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

  -- 2. 建立成員記錄（設定為 Owner）
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

  -- 3. 建立新的 token-based 訂閱
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
    free_plan_tokens,           -- 20,000 tokens
    free_plan_tokens,           -- 初始餘額 = 配額
    0,                          -- 免費用戶沒有購買的 tokens
    NOW(),
    NOW() + INTERVAL '1 month', -- 一個月後
    false,
    1.0,
    NOW(),
    NOW()
  );

  -- 4. 建立舊的 subscriptions 表記錄（向後兼容）
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
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
  );

  -- 記錄日誌
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'activity_logs'
  ) THEN
    INSERT INTO activity_logs (
      company_id,
      user_id,
      action,
      resource_type,
      resource_id,
      metadata,
      created_at
    ) VALUES (
      new_company_id,
      NEW.id,
      'oauth_signup_auto_setup',
      'company',
      new_company_id,
      jsonb_build_object(
        'provider', user_provider,
        'email', user_email,
        'auto_created', true,
        'free_plan_tokens', free_plan_tokens
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 確保觸發器存在（如果已存在則不會重複建立）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_oauth_user();

-- 權限設定
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO postgres;
