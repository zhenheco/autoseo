-- ===========================================
-- Row Level Security (RLS) 政策（不含加密函數）
-- ===========================================

-- ===========================================
-- 權限檢查函數
-- ===========================================

CREATE OR REPLACE FUNCTION has_permission(
  check_user_id UUID,
  check_company_id UUID,
  required_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM company_members
  WHERE user_id = check_user_id
    AND company_id = check_company_id
    AND status = 'active';

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = user_role AND permission = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Affiliate 佣金更新函數
-- ===========================================

CREATE OR REPLACE FUNCTION update_affiliate_commission(
  affiliate_id_param UUID,
  amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE affiliates
  SET
    total_commission_earned = total_commission_earned + amount,
    pending_commission = pending_commission + amount,
    updated_at = NOW()
  WHERE id = affiliate_id_param;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 啟用 Row Level Security
-- ===========================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- Companies 政策
-- ===========================================

-- 使用者可以查看自己是成員的公司
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 使用者可以更新自己擁有的公司
CREATE POLICY "Users can update companies they own"
  ON companies FOR UPDATE
  USING (owner_id = auth.uid());

-- 使用者可以建立新公司
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ===========================================
-- Company Members 政策
-- ===========================================

-- 使用者可以查看同公司的成員
CREATE POLICY "Users can view company members"
  ON company_members FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owner 和 Admin 可以新增成員
CREATE POLICY "Owners and Admins can insert members"
  ON company_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
  );

-- Owner 和 Admin 可以更新成員
CREATE POLICY "Owners and Admins can update members"
  ON company_members FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- ===========================================
-- Website Configs 政策
-- ===========================================

-- 可以查看所屬公司的網站
CREATE POLICY "Users can view website configs"
  ON website_configs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owner 和 Admin 可以管理網站
CREATE POLICY "Owners and Admins can manage websites"
  ON website_configs FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- ===========================================
-- Article Jobs 政策
-- ===========================================

-- Writer 只能看自己的，其他角色看全部
CREATE POLICY "Users can view article jobs"
  ON article_jobs FOR SELECT
  USING (
    user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor', 'viewer')
        AND status = 'active'
    )
  );

-- 有權限的使用者可以建立文章任務
CREATE POLICY "Users can create article jobs"
  ON article_jobs FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor', 'writer')
        AND status = 'active'
    )
  );

-- 可以更新自己的文章任務
CREATE POLICY "Users can update their article jobs"
  ON article_jobs FOR UPDATE
  USING (user_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- ===========================================
-- API Usage Logs 政策
-- ===========================================

-- 可以查看所屬公司的使用記錄
CREATE POLICY "Users can view API usage logs"
  ON api_usage_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ===========================================
-- Subscriptions 政策
-- ===========================================

-- 可以查看所屬公司的訂閱
CREATE POLICY "Users can view subscriptions"
  ON subscriptions FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owner 可以更新訂閱
CREATE POLICY "Owners can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ===========================================
-- Activity Logs 政策
-- ===========================================

-- Owner 和 Admin 可以查看活動日誌
CREATE POLICY "Owners and Admins can view activity logs"
  ON activity_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- ===========================================
-- White Label Configs 政策
-- ===========================================

-- 可以查看所屬公司的 White Label 配置
CREATE POLICY "Users can view white label configs"
  ON white_label_configs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owner 可以管理 White Label
CREATE POLICY "Owners can manage white label"
  ON white_label_configs FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ===========================================
-- Affiliates 政策
-- ===========================================

-- 使用者可以查看自己的 Affiliate 資料
CREATE POLICY "Users can view their affiliate data"
  ON affiliates FOR SELECT
  USING (user_id = auth.uid());

-- 使用者可以更新自己的 Affiliate 資料
CREATE POLICY "Users can update their affiliate data"
  ON affiliates FOR UPDATE
  USING (user_id = auth.uid());

-- ===========================================
-- Affiliate Referrals 政策
-- ===========================================

-- Affiliate 可以查看自己的推薦記錄
CREATE POLICY "Affiliates can view their referrals"
  ON affiliate_referrals FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );

-- ===========================================
-- Affiliate Commissions 政策
-- ===========================================

-- Affiliate 可以查看自己的佣金記錄
CREATE POLICY "Affiliates can view their commissions"
  ON affiliate_commissions FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
  );
