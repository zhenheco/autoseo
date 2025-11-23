-- =====================================================
-- 恢復訂閱方案 - 根據用戶確認的定價
-- =====================================================
-- 定價規則：
-- - FREE: 10K tokens (一次性)
-- - STARTER: NT$ 699/月, 25K tokens
-- - PROFESSIONAL: NT$ 2499/月, 100K tokens (最受歡迎)
-- - BUSINESS: NT$ 5999/月, 300K tokens
-- - AGENCY: NT$ 11990/月, 750K tokens
-- - 年繳：月費 × 10 (相當於 83 折)
-- - 終身：年費 × 2.5
-- =====================================================

-- 1. 刪除現有方案（避免衝突）
DELETE FROM subscription_plans;

-- 2. 插入完整方案配置
INSERT INTO subscription_plans (
  name,
  slug,
  monthly_price,
  yearly_price,
  base_tokens,
  is_lifetime,
  lifetime_price,
  features,
  limits
) VALUES

-- ==================== 免費方案 ====================
('FREE', 'free', 0, 0, 10000,
  false,
  NULL,
  '{
    "models": ["deepseek-chat", "gemini-2-flash"],
    "wordpress_sites": 0,
    "images_per_article": 3,
    "team_members": 1,
    "user_seats": 1,
    "brand_voices": 0,
    "api_access": false,
    "team_collaboration": false,
    "white_label": false,
    "support_level": "community",
    "article_generation": true
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false,
    "dedicated_manager": false,
    "wordpress_connection": false
  }'::jsonb),

-- ==================== 月費方案 ====================

-- STARTER (入門版)
('STARTER', 'starter', 699, 6990, 25000,
  false,
  17475,
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
  }'::jsonb),

-- PROFESSIONAL (專業版) - 最受歡迎
('PROFESSIONAL', 'professional', 2499, 24990, 100000,
  false,
  62475,
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
  }'::jsonb),

-- BUSINESS (商務版)
('BUSINESS', 'business', 5999, 59990, 300000,
  false,
  149975,
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
  }'::jsonb),

-- AGENCY (代理商版)
('AGENCY', 'agency', 11990, 119900, 750000,
  false,
  299750,
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
  }'::jsonb),

-- ==================== 終身方案 (年費 × 2.5) ====================

-- LIFETIME_STARTER (終身入門版)
('LIFETIME_STARTER', 'lifetime-starter', 0, 0, 25000,
  true,
  17475,  -- 6990 × 2.5 = 17475
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
  }'::jsonb),

-- LIFETIME_PROFESSIONAL (終身專業版)
('LIFETIME_PROFESSIONAL', 'lifetime-professional', 0, 0, 100000,
  true,
  62475,  -- 24990 × 2.5 = 62475
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
  }'::jsonb),

-- LIFETIME_BUSINESS (終身商務版)
('LIFETIME_BUSINESS', 'lifetime-business', 0, 0, 300000,
  true,
  149975,  -- 59990 × 2.5 = 149975
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
  }'::jsonb),

-- LIFETIME_AGENCY (終身代理商版)
('LIFETIME_AGENCY', 'lifetime-agency', 0, 0, 750000,
  true,
  299750,  -- 119900 × 2.5 = 299750
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
  }'::jsonb);

-- 3. 驗證插入結果
SELECT name, slug, monthly_price, yearly_price, base_tokens, lifetime_price, is_lifetime
FROM subscription_plans
ORDER BY
  CASE
    WHEN slug = 'free' THEN 0
    WHEN is_lifetime = false THEN 1
    ELSE 2
  END,
  monthly_price;
