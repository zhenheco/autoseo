-- =====================================================
-- 添加免費方案 - 20k tokens/月，只能寫文章
-- =====================================================

-- 1. 插入免費方案到 subscription_plans
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
) VALUES (
  'FREE',
  'free',
  0,
  0,
  20000, -- 20k tokens/月
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
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  base_tokens = 20000,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

-- 2. 添加註解說明
COMMENT ON TABLE subscription_plans IS '訂閱方案定義
FREE 方案限制：
- 20,000 tokens/月（每月重置）
- 只能寫文章（article_generation = true）
- 不能連接 WordPress 網站（wordpress_sites = 0）
- 使用基本 AI 模型（deepseek-chat, gemini-2-flash）
- 每篇文章最多 3 張圖片
- 社群支援（無優先客服）';
