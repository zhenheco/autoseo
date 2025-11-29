-- Token 預扣機制 - 用於防止並發任務超額使用 Credits
-- 設計原則：預扣是內部額度控制，不顯示在用戶面板

CREATE TABLE IF NOT EXISTS token_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES article_jobs(id) ON DELETE CASCADE,
  reserved_amount INTEGER NOT NULL DEFAULT 3000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CONSTRAINT positive_reserved_amount CHECK (reserved_amount > 0)
);

CREATE INDEX idx_token_reservations_company_id ON token_reservations(company_id);
CREATE INDEX idx_token_reservations_job_id ON token_reservations(job_id);
CREATE INDEX idx_token_reservations_status ON token_reservations(status);
CREATE INDEX idx_token_reservations_active ON token_reservations(company_id) WHERE status = 'active';

ALTER TABLE token_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company reservations"
ON token_reservations FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage reservations"
ON token_reservations FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE OR REPLACE FUNCTION get_active_reservations_total(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COALESCE(SUM(reserved_amount), 0) INTO total
  FROM token_reservations
  WHERE company_id = p_company_id AND status = 'active';

  RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION create_token_reservation(
  p_company_id UUID,
  p_job_id UUID,
  p_reserved_amount INTEGER DEFAULT 3000
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reservation_id UUID;
BEGIN
  INSERT INTO token_reservations (company_id, job_id, reserved_amount, status)
  VALUES (p_company_id, p_job_id, p_reserved_amount, 'active')
  RETURNING id INTO reservation_id;

  RETURN reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION release_token_reservation(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE token_reservations
  SET status = 'released', released_at = NOW()
  WHERE job_id = p_job_id AND status = 'active';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION consume_token_reservation(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE token_reservations
  SET status = 'consumed', released_at = NOW()
  WHERE job_id = p_job_id AND status = 'active';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_reserve_tokens(
  p_company_id UUID,
  p_job_id UUID,
  p_article_count INTEGER DEFAULT 1,
  p_estimated_per_article INTEGER DEFAULT 3000
)
RETURNS TABLE (
  success BOOLEAN,
  available_balance INTEGER,
  total_reserved INTEGER,
  required_amount INTEGER,
  reservation_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INTEGER;
  pending_reserved INTEGER;
  available INTEGER;
  required INTEGER;
  new_reservation_id UUID;
BEGIN
  SELECT tb.total_tokens INTO current_balance
  FROM token_balances tb
  WHERE tb.company_id = p_company_id;

  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  SELECT get_active_reservations_total(p_company_id) INTO pending_reserved;

  available := current_balance - pending_reserved;
  required := p_article_count * p_estimated_per_article;

  IF available >= required THEN
    SELECT create_token_reservation(p_company_id, p_job_id, required) INTO new_reservation_id;
    RETURN QUERY SELECT TRUE, available, pending_reserved, required, new_reservation_id;
  ELSE
    RETURN QUERY SELECT FALSE, available, pending_reserved, required, NULL::UUID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_stale_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE token_reservations
  SET status = 'released', released_at = NOW()
  WHERE status = 'active'
    AND created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;
