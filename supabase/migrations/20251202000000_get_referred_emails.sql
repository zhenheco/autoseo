-- 建立函數：獲取推薦記錄包含被推薦者 email
CREATE OR REPLACE FUNCTION get_referrals_with_email(p_referrer_company_id UUID)
RETURNS TABLE (
  id UUID,
  referrer_company_id UUID,
  referred_company_id UUID,
  referral_code TEXT,
  status TEXT,
  registered_at TIMESTAMPTZ,
  first_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  referred_email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.referrer_company_id,
    r.referred_company_id,
    r.referral_code,
    r.status,
    r.registered_at,
    r.first_payment_at,
    r.created_at,
    u.email AS referred_email
  FROM referrals r
  LEFT JOIN company_members cm ON cm.company_id = r.referred_company_id AND cm.role = 'owner'
  LEFT JOIN auth.users u ON u.id = cm.user_id
  WHERE r.referrer_company_id = p_referrer_company_id
  ORDER BY r.created_at DESC
  LIMIT 20;
END;
$$;
