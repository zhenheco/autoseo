-- Migration: Update OAuth Trigger
-- Description: Updates handle_new_oauth_user trigger to create one_time_tokens and referral_codes
-- Author: Claude Code
-- Date: 2025-11-10

-- ============================================================================
-- Updated Trigger Function: handle_new_oauth_user
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_oauth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_subscription_id UUID;
  v_provider TEXT;
  v_email TEXT;
  v_user_name TEXT;
  v_company_name TEXT;
  v_referral_code TEXT;
BEGIN
  -- 只處理 OAuth 登入（provider !== 'email'）
  v_provider := NEW.raw_app_meta_data->>'provider';

  IF v_provider IS NULL OR v_provider = 'email' THEN
    RETURN NEW;
  END IF;

  -- 檢查用戶是否已有公司（防止重複建立）
  SELECT c.id INTO v_company_id
  FROM companies c
  JOIN company_members cm ON c.id = cm.company_id
  WHERE cm.user_id = NEW.id
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    -- 用戶已有公司，跳過
    RETURN NEW;
  END IF;

  -- 取得用戶資訊
  v_email := NEW.email;
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  v_company_name := SPLIT_PART(v_user_name, '@', 1);

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 建立完整的公司設定（與 RPC function 一致）
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  -- 1. 建立公司
  INSERT INTO companies (name, email, plan, billing_cycle)
  VALUES (v_company_name, v_email, 'free', 'monthly')
  RETURNING id INTO v_company_id;

  -- 2. 建立訂閱
  INSERT INTO subscriptions (
    plan_name,
    status,
    billing_cycle,
    current_period_start,
    current_period_end
  )
  VALUES (
    'free',
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  RETURNING id INTO v_subscription_id;

  -- 3. 建立公司訂閱關聯
  INSERT INTO company_subscriptions (company_id, subscription_id)
  VALUES (v_company_id, v_subscription_id);

  -- 4. 建立公司成員
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_company_id, NEW.id, 'owner');

  -- 5. 建立 one_time_tokens（與 RPC 一致）
  INSERT INTO one_time_tokens (company_id, balance)
  VALUES (v_company_id, 50);

  -- 6. 建立推薦碼（與 RPC 一致）
  v_referral_code := generate_referral_code();
  INSERT INTO referral_codes (user_id, code)
  VALUES (NEW.id, v_referral_code);

  -- 7. 記錄活動日誌
  INSERT INTO activity_logs (
    company_id,
    user_id,
    action,
    details,
    timestamp
  )
  VALUES (
    v_company_id,
    NEW.id,
    'company_created',
    jsonb_build_object(
      'method', 'database_trigger',
      'provider', v_provider,
      'plan', 'free'
    ),
    NOW()
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- 記錄錯誤但不阻止用戶建立
    RAISE LOG 'Error in handle_new_oauth_user trigger: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- Ensure Trigger Exists
-- ============================================================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_oauth_user();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION handle_new_oauth_user IS
  'Trigger function that creates complete company setup for OAuth users including tokens and referral codes';
