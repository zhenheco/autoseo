-- =====================================================
-- 篇數制訂閱系統 - Step 1: 修改 subscription_plans 表
-- =====================================================
-- 說明：將 Token 制改為篇數制，新增 articles_per_month 和 yearly_bonus_months 欄位

-- 1. 新增欄位到 subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS articles_per_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_bonus_months INTEGER NOT NULL DEFAULT 0;

-- 2. 註解說明
COMMENT ON COLUMN subscription_plans.articles_per_month IS '每月可生成文章篇數';
COMMENT ON COLUMN subscription_plans.yearly_bonus_months IS '年繳贈送的額外月數（篇數會加入加購額度）';

-- 3. 清空現有方案並插入新的篇數制方案
-- 注意：目前無付費用戶，可以安全清空
TRUNCATE subscription_plans CASCADE;

INSERT INTO subscription_plans (
  name, slug, monthly_price, yearly_price,
  articles_per_month, yearly_bonus_months,
  base_tokens, features, limits, is_lifetime, lifetime_price
) VALUES

-- FREE (免費方案) - 贈送 3 篇試寫
('FREE', 'free', 0, NULL, 3, 0, 0,
  '{
    "models": ["deepseek-chat"],
    "wordpress_sites": 1,
    "images_per_article": 0,
    "team_members": 1,
    "user_seats": 1,
    "api_access": false,
    "support_level": "none"
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  false, NULL),

-- STARTER (入門版) - NT$2,990/月
('STARTER', 'starter', 2990, 35880, 3, 2, 0,
  '{
    "models": "all",
    "wordpress_sites": 3,
    "images_per_article": -1,
    "team_members": 1,
    "user_seats": 1,
    "api_access": false,
    "auto_image": true,
    "scheduled_publish": true,
    "support_level": "standard"
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  false, NULL),

-- PRO (專業版) - NT$6,990/月 - 最受歡迎
('PRO', 'pro', 6990, 83880, 10, 2, 0,
  '{
    "models": "all",
    "wordpress_sites": 10,
    "images_per_article": -1,
    "team_members": 3,
    "user_seats": 3,
    "api_access": true,
    "auto_image": true,
    "scheduled_publish": true,
    "support_level": "priority"
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  false, NULL),

-- BUSINESS (商業版) - NT$14,990/月
('BUSINESS', 'business', 14990, 179880, 30, 2, 0,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "team_members": -1,
    "user_seats": -1,
    "api_access": true,
    "auto_image": true,
    "scheduled_publish": true,
    "support_level": "dedicated"
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": true
  }'::jsonb,
  false, NULL);

-- 4. 更新註解
COMMENT ON TABLE subscription_plans IS '訂閱方案定義表（篇數制）：
- FREE: 免費方案，贈送 3 篇試寫
- STARTER: 入門版 NT$2,990/月，每月 3 篇
- PRO: 專業版 NT$6,990/月，每月 10 篇
- BUSINESS: 商業版 NT$14,990/月，每月 30 篇
年繳優惠：年繳價格 = 月費 × 12，額外贈送 2 個月篇數作為加購額度';
