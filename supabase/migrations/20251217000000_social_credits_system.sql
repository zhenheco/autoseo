-- ============================================
-- 社群發文點數系統 Migration
-- 建立日期：2025-12-17
-- 功能：社群文章自動發布功能的資料庫架構
-- ============================================

-- 1. 社群發文點數套餐
CREATE TABLE IF NOT EXISTS social_credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 預設套餐資料
INSERT INTO social_credit_packages (name, slug, credits, price, description) VALUES
('試用包', 'social_trial', 10, 199, '適合初次體驗'),
('基本包', 'social_basic', 50, 599, '適合小型創作者'),
('進階包', 'social_advanced', 150, 1199, '適合中型企業'),
('專業包', 'social_pro', 300, 1999, '適合大量發文需求')
ON CONFLICT (slug) DO NOTHING;

-- 2. 公司社群點數餘額
CREATE TABLE IF NOT EXISTS company_social_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credits_remaining INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- 3. 社群點數購買記錄（FIFO 追蹤）
CREATE TABLE IF NOT EXISTS purchased_social_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_id UUID REFERENCES social_credit_packages(id),
  payment_order_id UUID REFERENCES payment_orders(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('purchase', 'promotion', 'refund_credit', 'manual')),
  original_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 社群帳號連接設定（儲存巴斯 API 憑證）
CREATE TABLE IF NOT EXISTS social_account_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bas_user_id TEXT NOT NULL,
  bas_api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- 5. 已連結的社群帳號快取
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES social_account_configs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  page_id TEXT,
  page_name TEXT,
  followers_count INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, platform, account_id)
);

-- 6. 社群發文記錄
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  article_id UUID REFERENCES generated_articles(id) ON DELETE SET NULL,
  account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),
  external_post_id TEXT,
  content TEXT NOT NULL,
  content_style TEXT CHECK (content_style IN ('professional', 'catchy', 'story')),
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  hashtags TEXT[],
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'cancelled')),
  error_message TEXT,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 索引建立
-- ============================================

-- 公司社群點數索引
CREATE INDEX IF NOT EXISTS idx_company_social_credits_company ON company_social_credits(company_id);

-- 購買記錄索引
CREATE INDEX IF NOT EXISTS idx_purchased_social_credits_company ON purchased_social_credits(company_id);
CREATE INDEX IF NOT EXISTS idx_purchased_social_credits_remaining ON purchased_social_credits(remaining_credits) WHERE remaining_credits > 0;

-- 社群帳號索引
CREATE INDEX IF NOT EXISTS idx_social_accounts_company ON social_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

-- 社群發文索引
CREATE INDEX IF NOT EXISTS idx_social_posts_company ON social_posts(company_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_article ON social_posts(article_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'pending';

-- ============================================
-- 擴展 payment_orders 支援社群點數購買
-- ============================================

-- 先移除舊的 CHECK 約束（如果存在）
ALTER TABLE payment_orders
DROP CONSTRAINT IF EXISTS payment_orders_payment_type_check;

-- 新增包含 social_credit_package 的 CHECK 約束
ALTER TABLE payment_orders
ADD CONSTRAINT payment_orders_payment_type_check
CHECK (payment_type IN (
  'subscription',
  'token_package',
  'lifetime',
  'article_package',
  'social_credit_package'
));

-- ============================================
-- RLS 政策（Row Level Security）
-- ============================================

-- 啟用 RLS
ALTER TABLE social_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_social_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchased_social_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_account_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- social_credit_packages: 所有人可讀（公開套餐資訊）
CREATE POLICY "社群點數套餐公開可讀" ON social_credit_packages
  FOR SELECT USING (is_active = true);

-- company_social_credits: 只有公司成員可讀
CREATE POLICY "公司成員可讀社群點數餘額" ON company_social_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = company_social_credits.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- purchased_social_credits: 只有公司成員可讀
CREATE POLICY "公司成員可讀購買記錄" ON purchased_social_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = purchased_social_credits.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- social_account_configs: 只有公司成員可讀寫
CREATE POLICY "公司成員可讀社群帳號設定" ON social_account_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_account_configs.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

CREATE POLICY "公司成員可寫社群帳號設定" ON social_account_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_account_configs.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

CREATE POLICY "公司成員可更新社群帳號設定" ON social_account_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_account_configs.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- social_accounts: 只有公司成員可讀
CREATE POLICY "公司成員可讀已連結帳號" ON social_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_accounts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- social_posts: 公司成員可讀寫
CREATE POLICY "公司成員可讀社群發文" ON social_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_posts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

CREATE POLICY "公司成員可寫社群發文" ON social_posts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_posts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

CREATE POLICY "公司成員可更新社群發文" ON social_posts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_posts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

CREATE POLICY "公司成員可刪除社群發文" ON social_posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = social_posts.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.status = 'active'
    )
  );

-- ============================================
-- Service Role 政策（後端服務使用）
-- ============================================

-- Service Role 可以完全操作所有表格
CREATE POLICY "Service Role 完全存取社群點數套餐" ON social_credit_packages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role 完全存取公司社群點數" ON company_social_credits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role 完全存取購買記錄" ON purchased_social_credits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role 完全存取社群帳號設定" ON social_account_configs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role 完全存取已連結帳號" ON social_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role 完全存取社群發文" ON social_posts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 更新觸發器
-- ============================================

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_social_credit_packages_updated_at
  BEFORE UPDATE ON social_credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER trigger_company_social_credits_updated_at
  BEFORE UPDATE ON company_social_credits
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER trigger_social_account_configs_updated_at
  BEFORE UPDATE ON social_account_configs
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

CREATE TRIGGER trigger_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

-- ============================================
-- 完成
-- ============================================
COMMENT ON TABLE social_credit_packages IS '社群發文點數套餐';
COMMENT ON TABLE company_social_credits IS '公司社群點數餘額';
COMMENT ON TABLE purchased_social_credits IS '社群點數購買記錄（FIFO 追蹤）';
COMMENT ON TABLE social_account_configs IS '社群帳號連接設定（巴斯 API 憑證）';
COMMENT ON TABLE social_accounts IS '已連結的社群帳號快取';
COMMENT ON TABLE social_posts IS '社群發文記錄';
