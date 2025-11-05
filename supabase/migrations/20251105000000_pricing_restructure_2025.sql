-- =====================================================
-- 2025 定價重構 - 優化價值曲線與功能差異化
-- =====================================================

-- 1. 清空現有方案資料
TRUNCATE subscription_plans CASCADE;
TRUNCATE token_packages CASCADE;

-- 2. 更新月費方案（新定價結構）
INSERT INTO subscription_plans (name, slug, monthly_price, yearly_price, base_tokens, features, limits, is_lifetime, lifetime_price) VALUES

-- ==================== 月費方案 ====================

-- STARTER (入門版)
('STARTER', 'starter', 699, 6990, 25000,
  '{
    "models": ["deepseek-chat", "gemini-2-flash", "gpt-5-mini"],
    "wordpress_sites": 1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 1,
    "user_seats": 1,
    "scheduling": "basic",
    "seo_score": true,
    "brand_voices": 0,
    "api_access": false,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "standard"
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  false, NULL),

-- PROFESSIONAL (專業版) - 最受歡迎
('PROFESSIONAL', 'professional', 2499, 24990, 100000,
  '{
    "models": "all",
    "wordpress_sites": 5,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 3,
    "user_seats": 3,
    "scheduling": "advanced",
    "seo_score": true,
    "brand_voices": 1,
    "api_access": true,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "priority"
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  false, NULL),

-- BUSINESS (商務版)
('BUSINESS', 'business', 5999, 59990, 300000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 10,
    "user_seats": 10,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": 3,
    "api_access": true,
    "team_collaboration": true,
    "white_label": false,
    "support_level": "dedicated"
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": true
  }'::jsonb,
  false, NULL),

-- AGENCY (代理商版)
('AGENCY', 'agency', 11990, 119900, 750000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": -1,
    "user_seats": -1,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": -1,
    "api_access": true,
    "team_collaboration": true,
    "white_label": true,
    "support_level": "dedicated"
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": true,
    "dedicated_manager": true
  }'::jsonb,
  false, NULL),

-- ==================== 終身方案 ====================

-- LIFETIME_STARTER (終身入門版)
('LIFETIME_STARTER', 'lifetime-starter', 0, 0, 25000,
  '{
    "models": ["deepseek-chat", "gemini-2-flash", "gpt-5-mini"],
    "wordpress_sites": 1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 1,
    "user_seats": 1,
    "scheduling": "basic",
    "seo_score": true,
    "brand_voices": 0,
    "api_access": false,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "standard",
    "lifetime_token_discount": 0.8
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  true, 17475),

-- LIFETIME_PROFESSIONAL (終身專業版)
('LIFETIME_PROFESSIONAL', 'lifetime-professional', 0, 0, 100000,
  '{
    "models": "all",
    "wordpress_sites": 5,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 3,
    "user_seats": 3,
    "scheduling": "advanced",
    "seo_score": true,
    "brand_voices": 1,
    "api_access": true,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "priority",
    "lifetime_token_discount": 0.8
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": false
  }'::jsonb,
  true, 62475),

-- LIFETIME_BUSINESS (終身商務版)
('LIFETIME_BUSINESS', 'lifetime-business', 0, 0, 300000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": 10,
    "user_seats": 10,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": 3,
    "api_access": true,
    "team_collaboration": true,
    "white_label": false,
    "support_level": "dedicated",
    "lifetime_token_discount": 0.8
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false,
    "dedicated_manager": true
  }'::jsonb,
  true, 149975),

-- LIFETIME_AGENCY (終身代理商版) - 新增
('LIFETIME_AGENCY', 'lifetime-agency', 0, 0, 750000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": -1,
    "team_members": -1,
    "user_seats": -1,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": -1,
    "api_access": true,
    "team_collaboration": true,
    "white_label": true,
    "support_level": "dedicated",
    "lifetime_token_discount": 0.8
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": true,
    "dedicated_manager": true
  }'::jsonb,
  true, 299750);

-- 3. 更新 Token 購買包（新定價）
INSERT INTO token_packages (name, slug, tokens, price, bonus_tokens, description) VALUES
('入門包 10K', 'entry-10k', 10000, 299, 0, '彈性加值，永不過期'),
('標準包 50K', 'standard-50k', 50000, 1299, 0, '彈性加值，永不過期'),
('進階包 100K', 'advanced-100k', 100000, 2399, 0, '彈性加值，永不過期');

-- 4. 新增欄位到 subscription_plans 如果不存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
    AND column_name = 'yearly_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN yearly_price DECIMAL(10,2);
  END IF;
END $$;

-- 5. 更新註解
COMMENT ON COLUMN subscription_plans.features IS '功能特性：
- models: 可用的 AI 模型
- wordpress_sites: WordPress 網站數量 (-1 = 無限)
- images_per_article: 每篇文章圖片數量 (-1 = 無限)
- batch_generation: 批次生成數量 (-1 = 無限)
- team_members: 團隊成員數量 (-1 = 無限)
- user_seats: 使用者席位數量 (-1 = 無限)
- scheduling: 排程等級 (basic, advanced, smart)
- seo_score: SEO 分數優化
- brand_voices: 品牌聲音數量 (-1 = 無限)
- api_access: API 存取權限
- team_collaboration: 團隊協作功能
- white_label: 白標服務
- support_level: 客服等級 (standard, priority, dedicated)
- lifetime_token_discount: 終身會員 Token 購買折扣 (僅終身方案)';

COMMENT ON COLUMN subscription_plans.monthly_price IS '月費價格（台幣）';
COMMENT ON COLUMN subscription_plans.yearly_price IS '年費價格（台幣），相當於月費 × 10';
COMMENT ON COLUMN subscription_plans.lifetime_price IS '終身方案價格（台幣），相當於年費 × 2.5';
COMMENT ON COLUMN subscription_plans.base_tokens IS '每月基礎 Token 配額';

-- 6. 確保所有 token_packages 都是啟用狀態
UPDATE token_packages SET is_active = true WHERE slug IN ('entry-10k', 'standard-50k', 'advanced-100k');
