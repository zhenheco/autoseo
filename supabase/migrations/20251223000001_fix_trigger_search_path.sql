-- =====================================================
-- 修復觸發器函數的 search_path 問題
-- =====================================================
-- 問題：20251216100000_fix_function_search_path.sql 將 search_path 設為空字串
-- 結果：觸發器無法找到表，導致扣款失敗
-- 修復：將需要存取表的函數 search_path 設為 'public'

-- 修復 update_purchased_articles_total 觸發器函數
-- 這個函數需要存取 company_subscriptions 和 purchased_article_credits
CREATE OR REPLACE FUNCTION update_purchased_articles_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 更新公司的加購篇數總額
  UPDATE company_subscriptions
  SET purchased_articles_remaining = (
    SELECT COALESCE(SUM(remaining_articles), 0)
    FROM purchased_article_credits
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
  )
  WHERE company_id = COALESCE(NEW.company_id, OLD.company_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION update_purchased_articles_total() IS
'觸發器函數：當 purchased_article_credits 變更時，同步更新 company_subscriptions.purchased_articles_remaining
注意：search_path 必須設為 public 才能存取相關表';

-- 修復 deduct_article_quota 函數
-- 這個函數需要存取多個表
CREATE OR REPLACE FUNCTION deduct_article_quota(
  p_company_id UUID,
  p_article_job_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_article_title TEXT DEFAULT NULL,
  p_keywords TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_subscription_remaining INTEGER;
  v_purchased_remaining INTEGER;
  v_subscription_balance_before INTEGER;
  v_purchased_balance_before INTEGER;
  v_credit_id UUID;
  v_deducted_from TEXT;
  v_log_id UUID;
BEGIN
  -- 1. 鎖定公司訂閱記錄
  SELECT
    id,
    subscription_articles_remaining,
    purchased_articles_remaining
  INTO
    v_subscription_id,
    v_subscription_remaining,
    v_purchased_remaining
  FROM company_subscriptions
  WHERE company_id = p_company_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_subscription',
      'message', '找不到有效訂閱'
    );
  END IF;

  -- 記錄扣款前餘額
  v_subscription_balance_before := v_subscription_remaining;
  v_purchased_balance_before := v_purchased_remaining;

  -- 2. 優先從訂閱額度扣除
  IF v_subscription_remaining > 0 THEN
    UPDATE company_subscriptions
    SET
      subscription_articles_remaining = subscription_articles_remaining - 1,
      updated_at = NOW()
    WHERE id = v_subscription_id;

    v_deducted_from := 'subscription';

  -- 3. 訂閱額度用完，從加購額度扣除（FIFO）
  ELSIF v_purchased_remaining > 0 THEN
    -- 找到最早購買且有剩餘的加購記錄
    SELECT id INTO v_credit_id
    FROM purchased_article_credits
    WHERE company_id = p_company_id AND remaining_articles > 0
    ORDER BY purchased_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'no_credits',
        'message', '加購額度不足'
      );
    END IF;

    -- 扣除加購額度
    UPDATE purchased_article_credits
    SET
      remaining_articles = remaining_articles - 1,
      updated_at = NOW()
    WHERE id = v_credit_id;

    -- 注意：purchased_articles_remaining 會由觸發器自動更新

    v_deducted_from := 'purchased';

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_quota',
      'message', '額度不足，請升級方案或購買加購包'
    );
  END IF;

  -- 4. 記錄使用日誌
  INSERT INTO article_usage_logs (
    company_id,
    article_job_id,
    user_id,
    deducted_from,
    purchased_credit_id,
    subscription_balance_before,
    subscription_balance_after,
    purchased_balance_before,
    purchased_balance_after,
    article_title,
    keywords
  ) VALUES (
    p_company_id,
    p_article_job_id,
    p_user_id,
    v_deducted_from,
    v_credit_id,
    v_subscription_balance_before,
    CASE WHEN v_deducted_from = 'subscription'
      THEN v_subscription_balance_before - 1
      ELSE v_subscription_balance_before
    END,
    v_purchased_balance_before,
    CASE WHEN v_deducted_from = 'purchased'
      THEN v_purchased_balance_before - 1
      ELSE v_purchased_balance_before
    END,
    p_article_title,
    p_keywords
  )
  RETURNING id INTO v_log_id;

  -- 5. 重新讀取更新後的餘額
  SELECT
    subscription_articles_remaining,
    purchased_articles_remaining
  INTO
    v_subscription_remaining,
    v_purchased_remaining
  FROM company_subscriptions
  WHERE id = v_subscription_id;

  -- 6. 返回成功結果
  RETURN jsonb_build_object(
    'success', true,
    'deducted_from', v_deducted_from,
    'log_id', v_log_id,
    'subscription_remaining', v_subscription_remaining,
    'purchased_remaining', v_purchased_remaining,
    'total_remaining', v_subscription_remaining + v_purchased_remaining
  );
END;
$$;

COMMENT ON FUNCTION deduct_article_quota(UUID, UUID, UUID, TEXT, TEXT[]) IS
'原子性文章扣篇函數：
- 優先從訂閱額度扣除（subscription_articles_remaining）
- 訂閱額度用完後從加購額度扣除（FIFO：先買先用）
- 同時記錄使用日誌（article_usage_logs）
- 返回 JSON 包含：success, deducted_from, log_id, subscription_remaining, purchased_remaining
- search_path 設為 public 確保表可被存取';

-- 同樣修復其他需要存取表的關鍵函數
-- reset_monthly_quota_if_needed
DROP FUNCTION IF EXISTS reset_monthly_quota_if_needed(uuid);
CREATE OR REPLACE FUNCTION reset_monthly_quota_if_needed(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_end TIMESTAMPTZ;
  v_articles_per_month INTEGER;
BEGIN
  -- 檢查訂閱週期是否已過期
  SELECT current_period_end, articles_per_month
  INTO v_period_end, v_articles_per_month
  FROM company_subscriptions
  WHERE company_id = p_company_id AND status = 'active';

  -- 如果週期已過期，重置配額
  IF v_period_end IS NOT NULL AND v_period_end < NOW() THEN
    UPDATE company_subscriptions
    SET
      subscription_articles_remaining = COALESCE(v_articles_per_month, 0),
      current_period_end = v_period_end + INTERVAL '1 month',
      updated_at = NOW()
    WHERE company_id = p_company_id AND status = 'active';
  END IF;
END;
$$;

COMMENT ON FUNCTION reset_monthly_quota_if_needed(UUID) IS
'Lazy Reset：在讀取餘額時自動檢查並重置過期的月配額
- search_path 設為 public 確保表可被存取';
