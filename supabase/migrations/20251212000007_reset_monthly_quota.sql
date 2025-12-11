-- =====================================================
-- 篇數制訂閱系統 - Step 7: 建立月配額重置 Function
-- =====================================================
-- 說明：Lazy Reset + Cron Job 並用的重置機制

-- 1. 單一用戶的配額重置函數（Lazy Reset 用）
CREATE OR REPLACE FUNCTION reset_monthly_quota_if_needed(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end TIMESTAMPTZ;
BEGIN
  -- 鎖定訂閱記錄
  SELECT
    id,
    articles_per_month,
    subscription_articles_remaining,
    current_period_start,
    current_period_end,
    billing_cycle,
    status
  INTO v_subscription
  FROM company_subscriptions
  WHERE company_id = p_company_id
  FOR UPDATE;

  -- 檢查是否存在有效訂閱
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reset', false, 'reason', 'no_subscription');
  END IF;

  -- 檢查訂閱是否有效
  IF v_subscription.status != 'active' THEN
    RETURN jsonb_build_object('reset', false, 'reason', 'subscription_not_active');
  END IF;

  -- 檢查是否有配額（免費方案跳過）
  IF v_subscription.articles_per_month = 0 THEN
    RETURN jsonb_build_object('reset', false, 'reason', 'free_plan');
  END IF;

  -- 檢查是否需要重置
  IF v_subscription.current_period_end IS NULL OR v_now < v_subscription.current_period_end THEN
    RETURN jsonb_build_object('reset', false, 'reason', 'period_not_ended');
  END IF;

  -- 計算新週期（每月重置）
  v_new_period_start := v_now;
  v_new_period_end := v_now + INTERVAL '1 month';

  -- 重置配額
  UPDATE company_subscriptions
  SET
    subscription_articles_remaining = articles_per_month,
    current_period_start = v_new_period_start,
    current_period_end = v_new_period_end,
    last_quota_reset_at = v_now,
    updated_at = NOW()
  WHERE id = v_subscription.id;

  -- 返回重置結果
  RETURN jsonb_build_object(
    'reset', true,
    'new_quota', v_subscription.articles_per_month,
    'old_remaining', v_subscription.subscription_articles_remaining,
    'new_period_start', v_new_period_start,
    'new_period_end', v_new_period_end
  );
END;
$$;

-- 2. 批量重置函數（Cron Job 用）
CREATE OR REPLACE FUNCTION reset_all_expired_quotas()
RETURNS TABLE (
  company_id UUID,
  reset_result JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.company_id,
    reset_monthly_quota_if_needed(cs.company_id) as reset_result
  FROM company_subscriptions cs
  WHERE cs.status = 'active'
    AND cs.current_period_end < NOW()
    AND cs.articles_per_month > 0;
END;
$$;

-- 3. 註解
COMMENT ON FUNCTION reset_monthly_quota_if_needed(UUID) IS
'單一用戶配額重置（Lazy Reset）：
- 檢查 current_period_end 是否已過
- 若已過，重置 subscription_articles_remaining 為 articles_per_month
- 更新 current_period_start/end 為新週期
- 返回 JSON 包含重置結果';

COMMENT ON FUNCTION reset_all_expired_quotas() IS
'批量配額重置（Cron Job 用）：
- 查詢所有已過期且需要重置的訂閱
- 對每個訂閱呼叫 reset_monthly_quota_if_needed
- 返回所有重置結果';
