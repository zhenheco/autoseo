DROP TRIGGER IF EXISTS trigger_award_referral_bonus ON public.payment_orders;

DROP FUNCTION IF EXISTS public.award_referral_bonus() CASCADE;
DROP FUNCTION IF EXISTS public.generate_referral_code() CASCADE;
DROP FUNCTION IF EXISTS public.increment_referral_clicks(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.increment_referral_count(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.increment_referral_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_successful_referrals(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.get_referrals_with_email(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_referral_loop(UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.add_referral_article_reward(UUID, INTEGER, TEXT) CASCADE;

DROP TABLE IF EXISTS referral_token_rewards CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;
DROP TABLE IF EXISTS referral_codes CASCADE;
DROP TABLE IF EXISTS company_referral_codes CASCADE;

DROP TABLE IF EXISTS referral_tracking_logs CASCADE;
DROP TABLE IF EXISTS suspicious_referrals CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;

ALTER TABLE IF EXISTS public.companies
  DROP COLUMN IF EXISTS referred_by_code,
  DROP COLUMN IF EXISTS referred_by_affiliate_code,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS referral_credit;

ALTER TABLE IF EXISTS public.company_subscriptions
  DROP COLUMN IF EXISTS referred_by_code,
  DROP COLUMN IF EXISTS referred_by_affiliate_code,
  DROP COLUMN IF EXISTS referral_code,
  DROP COLUMN IF EXISTS referral_credit;

DROP TRIGGER IF EXISTS trigger_update_reseller_stats ON public.commissions;

ALTER TABLE IF EXISTS public.resellers
  DROP COLUMN IF EXISTS total_referrals;

CREATE OR REPLACE FUNCTION public.update_reseller_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.resellers
    SET
      total_revenue = total_revenue + NEW.order_amount,
      total_commission = total_commission + NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reseller_stats
  AFTER INSERT ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reseller_stats();
