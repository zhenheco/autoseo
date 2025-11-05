-- ===========================================
-- OAuth 使用者自動建立公司和訂閱
-- ===========================================
-- 當使用者透過 Google 或 LINE OAuth 登入時，
-- 自動為他們建立公司、成員記錄和免費訂閱

-- ===========================================
-- Function: 處理新的 OAuth 使用者
-- ===========================================
CREATE OR REPLACE FUNCTION handle_new_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  user_provider TEXT;
  user_email TEXT;
  company_slug TEXT;
BEGIN
  -- 取得使用者的 provider 和 email
  user_provider := NEW.raw_app_meta_data->>'provider';
  user_email := NEW.email;

  -- 只處理 OAuth 登入（不是 email/password）
  -- provider 可能是：google, line, github 等
  IF user_provider IS NULL OR user_provider = 'email' THEN
    RETURN NEW;
  END IF;

  -- 檢查使用者是否已經有公司（透過 company_members）
  IF EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = NEW.id AND status = 'active'
  ) THEN
    -- 使用者已有公司，不需要建立
    RETURN NEW;
  END IF;

  -- 生成唯一的 slug
  -- 格式：email前綴-隨機字串-時間戳
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
    SPLIT_PART(user_email, '@', 1) || ' 的公司',  -- 公司名稱
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

  -- 3. 建立免費訂閱（5 篇文章/月）
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

  -- 記錄日誌（如果有 activity_logs 表的話）
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
        'auto_created', true
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Trigger: 監聽新使用者建立
-- ===========================================
-- 當 auth.users 表有新使用者時自動執行
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_oauth_user();

-- ===========================================
-- 權限設定
-- ===========================================
-- 允許 service_role 執行此 Function
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_oauth_user() TO postgres;

-- ===========================================
-- 測試資料（可選，用於驗證）
-- ===========================================
-- 您可以使用以下 SQL 來測試 Function 是否正常運作：
--
-- -- 模擬建立 OAuth 使用者
-- INSERT INTO auth.users (
--   id,
--   email,
--   raw_app_meta_data,
--   raw_user_meta_data,
--   created_at,
--   updated_at
-- ) VALUES (
--   uuid_generate_v4(),
--   'test-oauth@gmail.com',
--   '{"provider": "google", "providers": ["google"]}'::jsonb,
--   '{"name": "Test User"}'::jsonb,
--   NOW(),
--   NOW()
-- );
--
-- -- 檢查是否自動建立公司
-- SELECT
--   u.email,
--   c.name as company_name,
--   cm.role,
--   s.plan_name,
--   s.monthly_article_limit
-- FROM auth.users u
-- LEFT JOIN company_members cm ON cm.user_id = u.id
-- LEFT JOIN companies c ON c.id = cm.company_id
-- LEFT JOIN subscriptions s ON s.company_id = c.id
-- WHERE u.email = 'test-oauth@gmail.com';

-- ===========================================
-- 回滾說明
-- ===========================================
-- 如需回滾此 migration，執行：
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_oauth_user();
