-- =====================================================
-- 篇數制訂閱系統 - Step 4: 建立 purchased_article_credits 表
-- =====================================================
-- 說明：追蹤加購篇數，實現 FIFO（先買先用）

-- 1. 建立表
CREATE TABLE IF NOT EXISTS purchased_article_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_id UUID REFERENCES article_packages(id),
  payment_order_id UUID REFERENCES payment_orders(id),

  -- 來源類型
  source_type TEXT NOT NULL DEFAULT 'purchase'
    CHECK (source_type IN ('purchase', 'yearly_bonus', 'promotion', 'refund_credit', 'manual')),

  -- 篇數
  original_articles INTEGER NOT NULL,
  remaining_articles INTEGER NOT NULL,

  -- 時間
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 約束
  CONSTRAINT positive_remaining CHECK (remaining_articles >= 0),
  CONSTRAINT remaining_not_exceed_original CHECK (remaining_articles <= original_articles)
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_purchased_credits_company
  ON purchased_article_credits(company_id);
CREATE INDEX IF NOT EXISTS idx_purchased_credits_remaining
  ON purchased_article_credits(company_id, remaining_articles)
  WHERE remaining_articles > 0;
CREATE INDEX IF NOT EXISTS idx_purchased_credits_fifo
  ON purchased_article_credits(company_id, purchased_at ASC)
  WHERE remaining_articles > 0;

-- 3. 啟用 RLS
ALTER TABLE purchased_article_credits ENABLE ROW LEVEL SECURITY;

-- 4. RLS 政策
DROP POLICY IF EXISTS "Company members can view their credits" ON purchased_article_credits;
CREATE POLICY "Company members can view their credits"
ON purchased_article_credits FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  )
);

-- 5. 觸發器：更新 company_subscriptions 的 purchased_articles_remaining
CREATE OR REPLACE FUNCTION update_purchased_articles_total()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新公司的加購篇數總額
  UPDATE company_subscriptions
  SET purchased_articles_remaining = (
    SELECT COALESCE(SUM(remaining_articles), 0)
    FROM purchased_article_credits
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
  )
  WHERE company_id = COALESCE(NEW.company_id, OLD.company_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_purchased_articles ON purchased_article_credits;
CREATE TRIGGER trigger_update_purchased_articles
AFTER INSERT OR UPDATE OR DELETE ON purchased_article_credits
FOR EACH ROW EXECUTE FUNCTION update_purchased_articles_total();

-- 6. 註解
COMMENT ON TABLE purchased_article_credits IS '加購篇數記錄表：
- 用於追蹤每筆加購的剩餘篇數
- 扣款時按 purchased_at 排序（FIFO：先買先用）
- 年繳贈品也會記錄在此（source_type = yearly_bonus）';

COMMENT ON COLUMN purchased_article_credits.source_type IS '來源類型：
- purchase: 購買加購包
- yearly_bonus: 年繳贈品
- promotion: 促銷活動
- refund_credit: 退款補償
- manual: 人工調整';

COMMENT ON COLUMN purchased_article_credits.original_articles IS '原始購買篇數';
COMMENT ON COLUMN purchased_article_credits.remaining_articles IS '剩餘可用篇數';
