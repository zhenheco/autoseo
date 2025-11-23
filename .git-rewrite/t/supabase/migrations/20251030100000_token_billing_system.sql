-- Token 計費系統完整架構

-- 1. 訂閱方案定義表
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- 'FREE', 'STARTER', 'PROFESSIONAL', 'AGENCY'
  slug TEXT UNIQUE NOT NULL,
  monthly_price DECIMAL(10,2) NOT NULL,
  base_tokens INTEGER NOT NULL, -- 每月基礎 Token
  is_lifetime BOOLEAN DEFAULT false,
  lifetime_price DECIMAL(10,2),
  features JSONB NOT NULL DEFAULT '{}', -- 功能權限
  limits JSONB NOT NULL DEFAULT '{}', -- 各項限制
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AI 模型定價表
CREATE TABLE ai_model_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'advanced')), -- 基礎/進階
  multiplier DECIMAL(3,1) NOT NULL DEFAULT 1.0, -- Token 倍率 (1.0 或 2.0)
  input_price_per_1m DECIMAL(10,6) NOT NULL, -- USD per 1M tokens
  output_price_per_1m DECIMAL(10,6) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 公司訂閱狀態表
CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  token_balance INTEGER NOT NULL DEFAULT 0, -- 當前剩餘 Token
  monthly_token_quota INTEGER NOT NULL, -- 每月配額
  is_lifetime BOOLEAN DEFAULT false,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id)
);

-- 4. Token 包購買記錄
CREATE TABLE token_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tokens INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  bonus_tokens INTEGER DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Token 購買歷史
CREATE TABLE token_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_id UUID REFERENCES token_packages(id),
  tokens_purchased INTEGER NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  payment_id TEXT, -- 金流商交易 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Token 使用記錄（核心計費表）
CREATE TABLE token_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_id UUID REFERENCES generated_articles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 模型資訊
  model_name TEXT NOT NULL,
  model_tier TEXT NOT NULL,
  model_multiplier DECIMAL(3,1) NOT NULL,

  -- Token 消耗
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_official_tokens INTEGER NOT NULL, -- 官方實際消耗
  charged_tokens INTEGER NOT NULL, -- 扣除用戶的 Token (official × multiplier × 2)

  -- 成本計算
  official_cost_usd DECIMAL(10,6) NOT NULL,
  charged_cost_usd DECIMAL(10,6) NOT NULL, -- official × 2

  -- 使用場景
  usage_type TEXT NOT NULL CHECK (usage_type IN ('article_generation', 'title_generation', 'image_description', 'perplexity_analysis')),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Token 餘額變動記錄
CREATE TABLE token_balance_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('purchase', 'usage', 'refund', 'quota_renewal', 'bonus', 'adjustment')),
  amount INTEGER NOT NULL, -- 正數為增加，負數為減少
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_id UUID, -- 關聯的購買或使用記錄 ID
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 每月 Token 使用統計（預聚合）
CREATE TABLE monthly_token_usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- 統計數據
  total_articles_generated INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,2) DEFAULT 0,

  -- 按模型分類
  tokens_by_model JSONB DEFAULT '{}', -- { "gpt-4o": 10000, "claude-3-5-sonnet": 5000 }

  -- 按用途分類
  tokens_by_usage JSONB DEFAULT '{}', -- { "article_generation": 12000, "title_generation": 3000 }

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, year, month)
);

-- 索引優化
CREATE INDEX idx_token_usage_logs_company ON token_usage_logs(company_id, created_at DESC);
CREATE INDEX idx_token_usage_logs_article ON token_usage_logs(article_id);
CREATE INDEX idx_token_usage_logs_model ON token_usage_logs(model_name);
CREATE INDEX idx_token_balance_changes_company ON token_balance_changes(company_id, created_at DESC);
CREATE INDEX idx_monthly_stats_company ON monthly_token_usage_stats(company_id, year, month);

-- RLS 策略
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balance_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_token_usage_stats ENABLE ROW LEVEL SECURITY;

-- 用戶只能查看自己公司的資料
CREATE POLICY "Users can view their company subscription"
  ON company_subscriptions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their company token usage"
  ON token_usage_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their company balance changes"
  ON token_balance_changes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- AI 模型定價表（公開可讀）
ALTER TABLE ai_model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view AI model pricing"
  ON ai_model_pricing FOR SELECT
  USING (true);

-- 初始化 AI 模型定價
INSERT INTO ai_model_pricing (model_name, provider, tier, multiplier, input_price_per_1m, output_price_per_1m) VALUES
-- 基礎模型 (1x Token)
('gemini-2-flash', 'google', 'basic', 1.0, 0.075, 0.30),
('deepseek-chat', 'deepseek', 'basic', 1.0, 0.14, 0.28),
('gpt-5-mini', 'openai', 'basic', 1.0, 1.00, 3.00), -- 預計價格

-- 進階模型 (2x Token)
('gemini-2.5-pro', 'google', 'advanced', 2.0, 1.25, 5.00),
('deepseek-reasoner', 'deepseek', 'advanced', 2.0, 0.55, 2.19),
('gpt-5', 'openai', 'advanced', 2.0, 10.00, 30.00), -- 預計價格
('claude-3-5-sonnet', 'anthropic', 'advanced', 2.0, 3.00, 15.00),
('claude-4-5-sonnet', 'anthropic', 'advanced', 2.0, 3.00, 15.00); -- 預計價格

-- 自動更新時間戳函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 應用到需要的表
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_model_pricing_updated_at BEFORE UPDATE ON ai_model_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_subscriptions_updated_at BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
