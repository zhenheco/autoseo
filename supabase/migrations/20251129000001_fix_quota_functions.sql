-- 修復配額函式：使用 subscription_tier 而非 subscription_plan_id
-- 問題：companies 表沒有 subscription_plan_id 欄位，應該使用 subscription_tier 與 subscription_plans.slug 進行 JOIN

-- 函式：檢查並增加配額使用
CREATE OR REPLACE FUNCTION public.check_and_increment_perplexity_quota(
  p_company_id UUID,
  p_increment INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month TEXT;
  v_plan_quota INTEGER;
  v_current_usage INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- 取得當前年月
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  -- 取得公司訂閱方案的配額（使用 subscription_tier 與 slug 進行 JOIN）
  SELECT sp.monthly_perplexity_quota
  INTO v_plan_quota
  FROM public.companies c
  JOIN public.subscription_plans sp ON c.subscription_tier = sp.slug
  WHERE c.id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'company_not_found',
      'message', '找不到公司資料'
    );
  END IF;

  -- 檢查配額設定
  IF v_plan_quota = 0 THEN
    -- 完全禁用（FREE plan）
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_disabled',
      'message', '您的方案不支援競爭對手分析功能，請升級方案',
      'quota', 0,
      'used', 0
    );
  END IF;

  IF v_plan_quota = -1 THEN
    -- 無限制（AGENCY plan）
    INSERT INTO public.monthly_quota_usage (company_id, year_month, perplexity_queries_used)
    VALUES (p_company_id, v_current_month, p_increment)
    ON CONFLICT (company_id, year_month)
    DO UPDATE SET
      perplexity_queries_used = monthly_quota_usage.perplexity_queries_used + p_increment,
      updated_at = CURRENT_TIMESTAMP;

    RETURN jsonb_build_object(
      'allowed', true,
      'quota', -1,
      'used', (SELECT perplexity_queries_used FROM public.monthly_quota_usage WHERE company_id = p_company_id AND year_month = v_current_month),
      'remaining', -1,
      'message', '無限制方案'
    );
  END IF;

  -- 取得當前使用量
  SELECT COALESCE(perplexity_queries_used, 0)
  INTO v_current_usage
  FROM public.monthly_quota_usage
  WHERE company_id = p_company_id AND year_month = v_current_month;

  IF NOT FOUND THEN
    v_current_usage := 0;
  END IF;

  -- 檢查是否超過配額
  v_allowed := (v_current_usage + p_increment) <= v_plan_quota;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'message', '已達到每月查詢配額上限，請升級方案或等待下月重置',
      'quota', v_plan_quota,
      'used', v_current_usage,
      'remaining', 0
    );
  END IF;

  -- 增加使用量
  INSERT INTO public.monthly_quota_usage (company_id, year_month, perplexity_queries_used)
  VALUES (p_company_id, v_current_month, p_increment)
  ON CONFLICT (company_id, year_month)
  DO UPDATE SET
    perplexity_queries_used = monthly_quota_usage.perplexity_queries_used + p_increment,
    updated_at = CURRENT_TIMESTAMP;

  RETURN jsonb_build_object(
    'allowed', true,
    'quota', v_plan_quota,
    'used', v_current_usage + p_increment,
    'remaining', v_plan_quota - (v_current_usage + p_increment),
    'message', '配額已更新'
  );
END;
$$;

-- 函式：取得公司配額狀態
CREATE OR REPLACE FUNCTION public.get_company_quota_status(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month TEXT;
  v_plan_quota INTEGER;
  v_current_usage INTEGER;
  v_plan_slug TEXT;
BEGIN
  v_current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  -- 使用 subscription_tier 與 slug 進行 JOIN
  SELECT sp.monthly_perplexity_quota, sp.slug
  INTO v_plan_quota, v_plan_slug
  FROM public.companies c
  JOIN public.subscription_plans sp ON c.subscription_tier = sp.slug
  WHERE c.id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'company_not_found');
  END IF;

  SELECT COALESCE(perplexity_queries_used, 0)
  INTO v_current_usage
  FROM public.monthly_quota_usage
  WHERE company_id = p_company_id AND year_month = v_current_month;

  IF NOT FOUND THEN
    v_current_usage := 0;
  END IF;

  RETURN jsonb_build_object(
    'plan', v_plan_slug,
    'quota', v_plan_quota,
    'used', v_current_usage,
    'remaining', CASE
      WHEN v_plan_quota = -1 THEN -1
      WHEN v_plan_quota = 0 THEN 0
      ELSE v_plan_quota - v_current_usage
    END,
    'can_use_competitors', v_plan_quota != 0,
    'month', v_current_month
  );
END;
$$;

-- 確保權限
GRANT EXECUTE ON FUNCTION public.check_and_increment_perplexity_quota TO service_role;
GRANT EXECUTE ON FUNCTION public.get_company_quota_status TO service_role, authenticated;
