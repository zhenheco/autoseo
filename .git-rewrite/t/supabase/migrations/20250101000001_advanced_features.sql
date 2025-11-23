-- ===========================================
-- 進階功能表 - White Label & Affiliate
-- ===========================================

-- ===========================================
-- 1. White Label Configs (品牌白標配置表)
-- ===========================================
CREATE TABLE white_label_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- 品牌資訊
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  brand_favicon_url TEXT,

  -- 自訂網域
  custom_domain TEXT UNIQUE,
  custom_domain_verified BOOLEAN DEFAULT false,

  -- 顏色配置
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#8b5cf6',
  accent_color TEXT DEFAULT '#10b981',

  -- 功能開關
  show_powered_by BOOLEAN DEFAULT true,
  custom_footer_text TEXT,
  custom_support_email TEXT,
  custom_support_url TEXT,

  -- SEO 設定
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,

  -- Email 客製化
  email_from_name TEXT,
  email_from_address TEXT,
  email_logo_url TEXT,

  white_label_tier TEXT DEFAULT 'basic' CHECK (white_label_tier IN ('basic', 'premium', 'enterprise')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

CREATE TRIGGER update_white_label_configs_updated_at BEFORE UPDATE ON white_label_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 2. Affiliates (Affiliate 用戶表)
-- ===========================================
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  affiliate_code TEXT UNIQUE NOT NULL,
  program_id UUID,

  -- 分潤資訊
  total_commission_earned DECIMAL(10, 2) DEFAULT 0,
  total_commission_paid DECIMAL(10, 2) DEFAULT 0,
  pending_commission DECIMAL(10, 2) DEFAULT 0,

  -- 統計資訊
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,

  -- 收款資訊
  payout_method TEXT,
  payout_details JSONB,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  approved_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_affiliates_code ON affiliates(affiliate_code);

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 3. Affiliate Referrals (推薦記錄表)
-- ===========================================
CREATE TABLE affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id),
  referred_user_id UUID REFERENCES auth.users(id),
  referred_company_id UUID REFERENCES companies(id),

  -- 追蹤資訊
  referral_source TEXT DEFAULT 'link',
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled')),
  first_payment_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(referred_company_id)
);

CREATE INDEX idx_affiliate_referrals_affiliate ON affiliate_referrals(affiliate_id);

-- ===========================================
-- 4. Affiliate Commissions (佣金記錄表)
-- ===========================================
CREATE TABLE affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id),
  referral_id UUID REFERENCES affiliate_referrals(id),
  order_id UUID REFERENCES orders(id),

  -- 佣金資訊（僅針對月租費）
  order_amount DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payout_batch_id TEXT,

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_status ON affiliate_commissions(status);
