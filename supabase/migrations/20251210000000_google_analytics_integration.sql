-- Google Analytics 與 Search Console 整合
-- 包含：OAuth tokens 儲存、分析數據快取、Cookie 同意記錄

-- ================================================
-- 1. Cookie 同意記錄表（GDPR 合規）
-- ================================================
CREATE TABLE IF NOT EXISTS cookie_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 訪客識別（匿名，使用瀏覽器指紋 hash）
  visitor_id VARCHAR(64) NOT NULL,

  -- 同意狀態
  analytics_consent BOOLEAN DEFAULT FALSE,
  marketing_consent BOOLEAN DEFAULT FALSE,

  -- 元數據
  consent_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  ip_country VARCHAR(2),  -- ISO 國碼，用於 GDPR 判斷
  user_agent TEXT,

  -- 時間戳
  consented_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 確保每個訪客只有一筆記錄
  CONSTRAINT cookie_consent_log_visitor_id_key UNIQUE (visitor_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cookie_consent_visitor ON cookie_consent_log(visitor_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_consented_at ON cookie_consent_log(consented_at);

-- ================================================
-- 2. Google OAuth Tokens 儲存表（加密儲存）
-- ================================================
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯
  website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 服務類型：gsc (Search Console) 或 ga4 (Analytics)
  service_type VARCHAR(10) NOT NULL CHECK (service_type IN ('gsc', 'ga4')),

  -- 加密儲存的 tokens（使用 AES-256-GCM）
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,

  -- Token 元數據
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,

  -- Google 帳戶資訊
  google_account_email VARCHAR(255),

  -- GSC 特定欄位
  gsc_site_url VARCHAR(500),  -- 例如：https://example.com/ 或 sc-domain:example.com
  gsc_verified_at TIMESTAMPTZ,

  -- GA4 特定欄位
  ga4_property_id VARCHAR(50),  -- 例如：properties/123456789
  ga4_stream_id VARCHAR(50),
  ga4_measurement_id VARCHAR(20),  -- 例如：G-XXXXXXXXXX

  -- 狀態
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 確保每個網站每種服務只有一個 token
  CONSTRAINT google_oauth_tokens_website_service_key UNIQUE (website_id, service_type)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_website ON google_oauth_tokens(website_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_company ON google_oauth_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_status ON google_oauth_tokens(status);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_expires ON google_oauth_tokens(token_expires_at);

-- ================================================
-- 3. 分析數據快取表（避免頻繁 API 調用）
-- ================================================
CREATE TABLE IF NOT EXISTS analytics_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 關聯
  website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,

  -- 數據類型
  -- gsc_performance: GSC 搜尋效能數據
  -- gsc_queries: GSC 熱門關鍵字
  -- gsc_pages: GSC 熱門頁面
  -- ga4_traffic: GA4 流量數據
  -- ga4_events: GA4 事件數據
  -- ga4_realtime: GA4 即時數據
  data_type VARCHAR(50) NOT NULL,

  -- 時間範圍
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,

  -- 額外過濾條件（JSON，用於區分不同維度的快取）
  filter_params JSONB DEFAULT '{}',

  -- 快取的數據（JSON）
  data JSONB NOT NULL,

  -- 快取元數據
  row_count INTEGER DEFAULT 0,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- 確保唯一性（相同網站、類型、時間範圍、過濾條件）
  CONSTRAINT analytics_data_cache_unique_key UNIQUE (website_id, data_type, date_start, date_end, filter_params)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_analytics_cache_website ON analytics_data_cache(website_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_type ON analytics_data_cache(data_type);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_dates ON analytics_data_cache(date_start, date_end);

-- ================================================
-- 4. RLS 政策
-- ================================================

-- 啟用 RLS
ALTER TABLE cookie_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_data_cache ENABLE ROW LEVEL SECURITY;

-- Cookie consent: 允許匿名插入和更新（不需要登入）
CREATE POLICY "Allow anonymous cookie consent insert"
  ON cookie_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous cookie consent update"
  ON cookie_consent_log
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Google OAuth Tokens: 只有公司成員可以存取
CREATE POLICY "Company members can view their tokens"
  ON google_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

CREATE POLICY "Company members can insert tokens"
  ON google_oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

CREATE POLICY "Company members can update their tokens"
  ON google_oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

CREATE POLICY "Company members can delete their tokens"
  ON google_oauth_tokens
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- Analytics Data Cache: 只有公司成員可以存取
CREATE POLICY "Company members can view analytics cache"
  ON analytics_data_cache
  FOR SELECT
  TO authenticated
  USING (
    website_id IN (
      SELECT wc.id FROM website_configs wc
      WHERE wc.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid() AND cm.status = 'active'
      )
    )
  );

CREATE POLICY "Company members can manage analytics cache"
  ON analytics_data_cache
  FOR ALL
  TO authenticated
  USING (
    website_id IN (
      SELECT wc.id FROM website_configs wc
      WHERE wc.company_id IN (
        SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = auth.uid() AND cm.status = 'active'
      )
    )
  );

-- ================================================
-- 5. 輔助函數
-- ================================================

-- 清理過期快取的函數
CREATE OR REPLACE FUNCTION cleanup_expired_analytics_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM analytics_data_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 取得網站的 OAuth 連接狀態
CREATE OR REPLACE FUNCTION get_website_oauth_status(p_website_id UUID)
RETURNS TABLE (
  gsc_connected BOOLEAN,
  gsc_email VARCHAR(255),
  gsc_site_url VARCHAR(500),
  ga4_connected BOOLEAN,
  ga4_email VARCHAR(255),
  ga4_property_id VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM google_oauth_tokens WHERE website_id = p_website_id AND service_type = 'gsc' AND status = 'active') as gsc_connected,
    (SELECT google_account_email FROM google_oauth_tokens WHERE website_id = p_website_id AND service_type = 'gsc' AND status = 'active' LIMIT 1) as gsc_email,
    (SELECT got.gsc_site_url FROM google_oauth_tokens got WHERE got.website_id = p_website_id AND got.service_type = 'gsc' AND got.status = 'active' LIMIT 1) as gsc_site_url,
    EXISTS(SELECT 1 FROM google_oauth_tokens WHERE website_id = p_website_id AND service_type = 'ga4' AND status = 'active') as ga4_connected,
    (SELECT google_account_email FROM google_oauth_tokens WHERE website_id = p_website_id AND service_type = 'ga4' AND status = 'active' LIMIT 1) as ga4_email,
    (SELECT got.ga4_property_id FROM google_oauth_tokens got WHERE got.website_id = p_website_id AND got.service_type = 'ga4' AND got.status = 'active' LIMIT 1) as ga4_property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_google_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_oauth_tokens_updated_at();

-- ================================================
-- 6. 註解
-- ================================================
COMMENT ON TABLE cookie_consent_log IS 'GDPR 合規的 Cookie 同意記錄';
COMMENT ON TABLE google_oauth_tokens IS 'Google OAuth tokens 加密儲存（GSC 和 GA4）';
COMMENT ON TABLE analytics_data_cache IS '分析數據快取，避免頻繁調用 Google API';

COMMENT ON COLUMN google_oauth_tokens.access_token_encrypted IS '使用 AES-256-GCM 加密的 access token';
COMMENT ON COLUMN google_oauth_tokens.refresh_token_encrypted IS '使用 AES-256-GCM 加密的 refresh token';
COMMENT ON COLUMN google_oauth_tokens.service_type IS 'gsc = Google Search Console, ga4 = Google Analytics 4';
