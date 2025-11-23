-- Migration: OAuth Setup RPC Function
-- Description: Creates the create_company_for_oauth_user RPC function with advisory lock
-- Author: Claude Code
-- Date: 2025-11-10

-- ============================================================================
-- Helper Function: Generate Referral Code
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- ============================================================================
-- Main RPC Function: create_company_for_oauth_user
-- ============================================================================

CREATE OR REPLACE FUNCTION create_company_for_oauth_user(
  p_user_id UUID,
  p_email TEXT,
  p_company_name TEXT
)
RETURNS TABLE(
  company_id UUID,
  subscription_id UUID,
  tokens_balance INTEGER,
  referral_code TEXT,
  created_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_subscription_id UUID;
  v_referral_code TEXT;
  v_created_new BOOLEAN := FALSE;
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 權限檢查：確保調用者是用戶本人
  -- ─────────────────────────────────────────────────────────────────────
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only create company for themselves';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- Advisory Lock：防止並發建立
  -- 使用 user_id 的 hash 作為 lock key
  -- ─────────────────────────────────────────────────────────────────────
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- ─────────────────────────────────────────────────────────────────────
  -- 雙重檢查：確認用戶是否已有公司
  -- ─────────────────────────────────────────────────────────────────────
  SELECT c.id, cs.subscription_id
  INTO v_company_id, v_subscription_id
  FROM companies c
  JOIN company_members cm ON c.id = cm.company_id
  LEFT JOIN company_subscriptions cs ON c.id = cs.company_id
  WHERE cm.user_id = p_user_id
  LIMIT 1;

  -- 如果已有公司，返回現有資料
  IF v_company_id IS NOT NULL THEN
    SELECT code INTO v_referral_code
    FROM referral_codes
    WHERE user_id = p_user_id
    LIMIT 1;

    RETURN QUERY
    SELECT
      v_company_id,
      v_subscription_id,
      COALESCE((SELECT balance FROM one_time_tokens WHERE company_id = v_company_id LIMIT 1), 0)::INTEGER,
      v_referral_code,
      FALSE; -- created_new = false
    RETURN;
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 建立新公司和所有相關資料（事務中）
  -- ─────────────────────────────────────────────────────────────────────
  v_created_new := TRUE;

  -- 1. 建立公司
  INSERT INTO companies (name, email, plan, billing_cycle)
  VALUES (p_company_name, p_email, 'free', 'monthly')
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

  -- 4. 建立公司成員（owner）
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_company_id, p_user_id, 'owner');

  -- 5. 建立 one_time_tokens（50 個免費 tokens）
  INSERT INTO one_time_tokens (company_id, balance)
  VALUES (v_company_id, 50);

  -- 6. 建立推薦碼
  v_referral_code := generate_referral_code();
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_referral_code);

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
    p_user_id,
    'company_created',
    jsonb_build_object(
      'method', 'oauth_rpc',
      'provider', 'google',
      'plan', 'free'
    ),
    NOW()
  );

  -- ─────────────────────────────────────────────────────────────────────
  -- 返回建立的資料
  -- ─────────────────────────────────────────────────────────────────────
  RETURN QUERY
  SELECT
    v_company_id,
    v_subscription_id,
    50::INTEGER, -- tokens_balance
    v_referral_code,
    v_created_new;

EXCEPTION
  WHEN OTHERS THEN
    -- 記錄錯誤
    RAISE LOG 'Error in create_company_for_oauth_user: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================

-- 授權給 authenticated 用戶
GRANT EXECUTE ON FUNCTION create_company_for_oauth_user TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION create_company_for_oauth_user IS
  'Creates a complete company setup for OAuth users with advisory lock to prevent concurrent creation';

COMMENT ON FUNCTION generate_referral_code IS
  'Generates a unique 8-character alphanumeric referral code';
