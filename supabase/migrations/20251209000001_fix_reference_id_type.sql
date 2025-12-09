-- 修正 Token 扣款函數中 reference_id 類型錯誤
-- 問題：v_record_id::text 轉換導致類型不匹配（reference_id 是 uuid 類型）
-- 錯誤訊息：column "reference_id" is of type uuid but expression is of type text

CREATE OR REPLACE FUNCTION deduct_tokens_atomic(
  p_idempotency_key TEXT,
  p_company_id UUID,
  p_article_id UUID,
  p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscription_id UUID;
  v_monthly_balance INTEGER;
  v_purchased_balance INTEGER;
  v_total_balance INTEGER;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_deducted_from_monthly INTEGER := 0;
  v_deducted_from_purchased INTEGER := 0;
  v_record_id UUID;
  v_status TEXT;
BEGIN
  -- 1. 檢查是否已存在扣款記錄（冪等性檢查）
  SELECT id, status, balance_after INTO v_record_id, v_status, v_balance_after
  FROM token_deduction_records
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_status = 'completed' THEN
      -- 已完成，返回原始結果（冪等性重複請求）
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'record_id', v_record_id,
        'balance_after', v_balance_after
      );
    ELSIF v_status = 'pending' THEN
      -- 正在處理中，拒絕重複請求
      RAISE EXCEPTION 'Deduction already in progress for idempotency_key: %', p_idempotency_key;
    END IF;
    -- status = 'failed' 則繼續執行，允許重試
  END IF;

  -- 2. 建立 pending 記錄（佔位，防止併發請求）
  INSERT INTO token_deduction_records (
    idempotency_key,
    company_id,
    article_id,
    amount,
    status
  ) VALUES (
    p_idempotency_key,
    p_company_id,
    p_article_id,
    p_amount,
    'pending'
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET retry_count = token_deduction_records.retry_count + 1
  RETURNING id INTO v_record_id;

  -- 3. 鎖定公司訂閱記錄（FOR UPDATE，防止 race condition）
  SELECT
    id,
    monthly_quota_balance,
    purchased_token_balance
  INTO
    v_subscription_id,
    v_monthly_balance,
    v_purchased_balance
  FROM company_subscriptions
  WHERE company_id = p_company_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE token_deduction_records
    SET status = 'failed', error_message = 'Subscription not found'
    WHERE id = v_record_id;
    RAISE EXCEPTION 'Subscription not found for company_id: %', p_company_id;
  END IF;

  -- 4. 計算總餘額
  v_total_balance := COALESCE(v_monthly_balance, 0) + COALESCE(v_purchased_balance, 0);
  v_balance_before := v_total_balance;

  -- 5. 檢查餘額是否足夠
  IF v_total_balance < p_amount THEN
    UPDATE token_deduction_records
    SET
      status = 'failed',
      error_message = 'Insufficient balance',
      balance_before = v_balance_before
    WHERE id = v_record_id;
    RAISE EXCEPTION 'Insufficient balance: required %, available %', p_amount, v_total_balance;
  END IF;

  -- 6. 優先從購買的 Token 扣除，再從月配額扣除
  IF v_purchased_balance >= p_amount THEN
    v_deducted_from_purchased := p_amount;
    v_deducted_from_monthly := 0;
  ELSIF v_purchased_balance > 0 THEN
    v_deducted_from_purchased := v_purchased_balance;
    v_deducted_from_monthly := p_amount - v_purchased_balance;
  ELSE
    v_deducted_from_purchased := 0;
    v_deducted_from_monthly := p_amount;
  END IF;

  -- 7. 更新訂閱餘額
  UPDATE company_subscriptions
  SET
    monthly_quota_balance = monthly_quota_balance - v_deducted_from_monthly,
    purchased_token_balance = purchased_token_balance - v_deducted_from_purchased,
    last_token_deduction_at = NOW()
  WHERE id = v_subscription_id;

  v_balance_after := v_total_balance - p_amount;

  -- 8. 更新扣款記錄為 completed
  UPDATE token_deduction_records
  SET
    status = 'completed',
    balance_before = v_balance_before,
    balance_after = v_balance_after,
    completed_at = NOW(),
    metadata = jsonb_build_object(
      'deducted_from_monthly', v_deducted_from_monthly,
      'deducted_from_purchased', v_deducted_from_purchased
    )
  WHERE id = v_record_id;

  -- 9. 插入 token_balance_changes（審計日誌）
  -- 修正：移除 ::text 轉換，直接使用 UUID
  IF v_deducted_from_purchased > 0 THEN
    INSERT INTO token_balance_changes (
      company_id,
      change_type,
      amount,
      balance_before,
      balance_after,
      reference_id,
      description
    ) VALUES (
      p_company_id,
      'usage',
      -v_deducted_from_purchased,
      v_purchased_balance,
      v_purchased_balance - v_deducted_from_purchased,
      v_record_id,  -- 修正：不再使用 ::text 轉換
      '文章生成 - Token 扣款（購買）'
    );
  END IF;

  IF v_deducted_from_monthly > 0 THEN
    INSERT INTO token_balance_changes (
      company_id,
      change_type,
      amount,
      balance_before,
      balance_after,
      reference_id,
      description
    ) VALUES (
      p_company_id,
      'usage',
      -v_deducted_from_monthly,
      v_monthly_balance,
      v_monthly_balance - v_deducted_from_monthly,
      v_record_id,  -- 修正：不再使用 ::text 轉換
      '文章生成 - Token 扣款（月配額）'
    );
  END IF;

  -- 10. 返回成功結果
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'record_id', v_record_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'deducted_from_monthly', v_deducted_from_monthly,
    'deducted_from_purchased', v_deducted_from_purchased
  );
END;
$$;

COMMENT ON FUNCTION deduct_tokens_atomic(TEXT, UUID, UUID, INTEGER) IS
'原子性 Token 扣款函數，支援冪等性和併發控制。扣款順序：先購買的 Token (purchased)，再月配額 (monthly)。參數：idempotency_key, company_id, article_id, amount';
