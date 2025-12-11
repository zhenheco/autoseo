-- =====================================================
-- 篇數制訂閱系統 - Step 6: 建立扣篇 PostgreSQL Function
-- =====================================================
-- 說明：原子性文章扣篇，優先訂閱額度，再扣加購額度（FIFO）

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

-- 加上函數註解
COMMENT ON FUNCTION deduct_article_quota(UUID, UUID, UUID, TEXT, TEXT[]) IS
'原子性文章扣篇函數：
- 優先從訂閱額度扣除（subscription_articles_remaining）
- 訂閱額度用完後從加購額度扣除（FIFO：先買先用）
- 同時記錄使用日誌（article_usage_logs）
- 返回 JSON 包含：success, deducted_from, log_id, subscription_remaining, purchased_remaining';
