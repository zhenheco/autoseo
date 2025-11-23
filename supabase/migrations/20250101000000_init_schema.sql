-- ===========================================
-- SEO 寫文 SaaS 平台 - 資料庫 Schema
-- ===========================================

-- 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgsodium";

-- ===========================================
-- 1. Companies (公司/組織表)
-- ===========================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
  newebpay_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_owner ON companies(owner_id);
CREATE INDEX idx_companies_slug ON companies(slug);

-- ===========================================
-- 2. Company Members (成員表 - 多對多)
-- ===========================================
CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'writer', 'viewer')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_company_members_company ON company_members(company_id);

-- ===========================================
-- 3. Role Permissions (角色權限表)
-- ===========================================
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  description TEXT,
  UNIQUE(role, permission)
);

-- 插入預設權限
INSERT INTO role_permissions (role, permission, description) VALUES
-- Owner 權限
('owner', 'company.manage', '管理公司設定'),
('owner', 'billing.manage', '管理訂閱和計費'),
('owner', 'members.invite_all', '邀請所有角色成員'),
('owner', 'members.remove_all', '移除所有成員'),
('owner', 'websites.manage', '管理所有網站配置'),
('owner', 'articles.create', '生成文章'),
('owner', 'articles.view_all', '查看所有文章'),
('owner', 'articles.delete_all', '刪除所有文章'),
('owner', 'usage.view_all', '查看所有使用統計'),
('owner', 'logs.view', '查看活動日誌'),

-- Admin 權限
('admin', 'members.invite_limited', '邀請 Editor/Writer/Viewer'),
('admin', 'members.remove_limited', '移除 Editor/Writer/Viewer'),
('admin', 'websites.manage', '管理網站配置'),
('admin', 'articles.create', '生成文章'),
('admin', 'articles.view_all', '查看所有文章'),
('admin', 'articles.delete_all', '刪除所有文章'),
('admin', 'usage.view_all', '查看所有使用統計'),
('admin', 'logs.view', '查看活動日誌'),

-- Editor 權限
('editor', 'websites.edit_assigned', '編輯指定網站'),
('editor', 'members.invite_writer', '邀請 Writer'),
('editor', 'articles.create', '生成文章'),
('editor', 'articles.view_team', '查看團隊文章'),
('editor', 'articles.delete_own', '刪除自己的文章'),
('editor', 'usage.view_own', '查看自己的使用統計'),

-- Writer 權限
('writer', 'articles.create', '生成文章'),
('writer', 'articles.view_own', '查看自己的文章'),
('writer', 'usage.view_own', '查看自己的使用統計'),

-- Viewer 權限
('viewer', 'articles.view_own', '查看自己的文章');

-- ===========================================
-- 4. Website Configs (網站配置表)
-- ===========================================
CREATE TABLE website_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  website_name TEXT NOT NULL,
  wordpress_url TEXT NOT NULL,

  -- WordPress OAuth 認證
  wordpress_oauth_client_id TEXT,
  wordpress_oauth_client_secret TEXT, -- 將加密
  wordpress_access_token TEXT, -- 將加密
  wordpress_refresh_token TEXT, -- 將加密
  wordpress_token_expires_at TIMESTAMP WITH TIME ZONE,

  -- 品牌語調配置
  brand_voice JSONB DEFAULT '{
    "brand_name": "",
    "tone": "專業且親切",
    "vocabulary": "使用白話文，避免過於學術",
    "sentence_style": "短句為主，每句不超過 20 字",
    "interactivity": "適度加入問句引導讀者思考"
  }'::jsonb,

  -- 語言和配置
  language TEXT DEFAULT 'zh-TW',

  -- API 配置
  api_config JSONB DEFAULT '{
    "use_own_keys": false,
    "openai_key": null,
    "deepseek_key": null,
    "perplexity_key": null,
    "serpapi_key": null
  }'::jsonb,

  -- N8N Webhook URL
  n8n_webhook_url TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_website_configs_company ON website_configs(company_id);

-- ===========================================
-- 5. Article Jobs (文章生成任務表)
-- ===========================================
CREATE TABLE article_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  website_id UUID REFERENCES website_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- 任務參數
  keywords TEXT[] NOT NULL,
  region TEXT DEFAULT 'TW',
  article_type TEXT DEFAULT 'blog_post',

  -- 狀態追蹤
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,

  -- 結果
  result_url TEXT,
  wordpress_post_id TEXT,
  error_message TEXT,

  -- 排程功能
  scheduled_publish_at TIMESTAMP WITH TIME ZONE,
  auto_publish BOOLEAN DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE,

  -- 圖片生成
  featured_image_url TEXT,
  image_generation_prompt TEXT,
  image_alt_text TEXT,

  -- 其他元數據
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_article_jobs_company ON article_jobs(company_id);
CREATE INDEX idx_article_jobs_user ON article_jobs(user_id);
CREATE INDEX idx_article_jobs_status ON article_jobs(status);
CREATE INDEX idx_article_jobs_scheduled ON article_jobs(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;

-- ===========================================
-- 6. API Usage Logs (API 使用記錄表)
-- ===========================================
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES article_jobs(id) ON DELETE CASCADE,

  service TEXT NOT NULL, -- 'openai', 'deepseek', 'perplexity', 'serpapi'
  model TEXT,
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),

  used_own_key BOOLEAN DEFAULT false,
  markup_percentage DECIMAL(5, 2) DEFAULT 50.00,
  final_cost_usd DECIMAL(10, 6),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_company ON api_usage_logs(company_id, created_at);

-- ===========================================
-- 7. Subscription Plans (訂閱方案表)
-- ===========================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,

  price_twd DECIMAL(10, 2) NOT NULL,
  billing_period TEXT DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),

  article_limit INTEGER,
  website_limit INTEGER,
  team_member_limit INTEGER,

  features JSONB DEFAULT '{}'::jsonb,

  can_use_own_api_keys BOOLEAN DEFAULT false,
  priority_processing BOOLEAN DEFAULT false,

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入預設方案
INSERT INTO subscription_plans (name, display_name, price_twd, article_limit, website_limit, team_member_limit, features, can_use_own_api_keys, priority_processing, sort_order) VALUES
('free', 'Free', 0, 5, 1, 1, '{"support": "社群", "logs_retention": 7, "batch_max": 0, "scheduling": false, "image_generation": false}', false, false, 1),
('basic', 'Basic', 1680, 50, 3, 5, '{"support": "Email", "logs_retention": 30, "batch_max": 10, "scheduling": true, "image_generation": false}', false, false, 2),
('pro', 'Pro', 5040, 200, 10, 20, '{"support": "Email + Chat", "logs_retention": 90, "batch_max": 50, "api_access": true, "scheduling": true, "image_generation": true}', true, true, 3),
('enterprise', 'Enterprise', 0, 999999, 999999, 999999, '{"support": "專人服務", "logs_retention": 365, "batch_max": 999999, "api_access": true, "custom_workflow": true, "scheduling": true, "image_generation": true}', true, true, 4);

-- ===========================================
-- 8. Subscriptions (訂閱表)
-- ===========================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  newebpay_order_no TEXT,

  plan_name TEXT NOT NULL CHECK (plan_name IN ('free', 'basic', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),

  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,

  monthly_article_limit INTEGER,
  articles_used_this_month INTEGER DEFAULT 0,

  auto_renew BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ===========================================
-- 9. Orders (訂單表 - 藍新金流)
-- ===========================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  order_no TEXT UNIQUE NOT NULL,
  order_type TEXT DEFAULT 'subscription' CHECK (order_type IN ('subscription', 'overage')),
  plan_id UUID,

  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'TWD',

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),

  -- 藍新金流相關
  newebpay_trade_no TEXT,
  payment_method TEXT, -- 'credit_card', 'atm', 'webatm'
  payment_data JSONB,

  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ===========================================
-- 10. Activity Logs (活動日誌表)
-- ===========================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,

  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_company ON activity_logs(company_id, created_at);

-- ===========================================
-- 更新時間戳觸發器
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_website_configs_updated_at BEFORE UPDATE ON website_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
