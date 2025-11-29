-- 訂閱疊加功能 Migration
-- 允許用戶重複購買同一方案來疊加每月配額

-- 1. 新增 purchased_count 欄位（記錄同一方案購買次數）
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS purchased_count INTEGER DEFAULT 1;

-- 2. 新增 base_monthly_quota 欄位（記錄單次購買的基礎配額，用於計算）
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS base_monthly_quota INTEGER;

-- 3. 為現有記錄設定 base_monthly_quota（等於當前的 monthly_token_quota）
UPDATE company_subscriptions
SET base_monthly_quota = monthly_token_quota
WHERE base_monthly_quota IS NULL;

-- 4. 註解說明
COMMENT ON COLUMN company_subscriptions.purchased_count IS '同一方案購買次數（疊加購買）';
COMMENT ON COLUMN company_subscriptions.base_monthly_quota IS '單次購買的基礎月配額（用於計算疊加後的總配額）';

-- 5. 創建函數：計算疊加後的總配額
CREATE OR REPLACE FUNCTION calculate_stacked_quota(
  p_base_quota INTEGER,
  p_purchased_count INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN p_base_quota * COALESCE(p_purchased_count, 1);
END;
$$ LANGUAGE plpgsql;
