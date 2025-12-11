-- =====================================================
-- 篇數制訂閱系統 - Step 2: 建立 article_packages 表
-- =====================================================
-- 說明：文章加購包定義，購買後永久有效

-- 1. 建立 article_packages 表
CREATE TABLE IF NOT EXISTS article_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  articles INTEGER NOT NULL,
  price INTEGER NOT NULL,  -- TWD 台幣
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_article_packages_slug ON article_packages(slug);
CREATE INDEX IF NOT EXISTS idx_article_packages_active ON article_packages(is_active) WHERE is_active = true;

-- 3. 插入加購包資料
INSERT INTO article_packages (name, slug, articles, price, description) VALUES
  ('單篇加購', 'single', 1, 2000, '單篇購買，永久有效'),
  ('5 篇加購包', 'pack_5', 5, 7500, '平均每篇 NT$1,500，省 25%'),
  ('10 篇加購包', 'pack_10', 10, 12000, '平均每篇 NT$1,200，省 40%')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  articles = EXCLUDED.articles,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

-- 4. 啟用 RLS
ALTER TABLE article_packages ENABLE ROW LEVEL SECURITY;

-- 5. RLS 政策：所有人可查看啟用的加購包
DROP POLICY IF EXISTS "Anyone can view active packages" ON article_packages;
CREATE POLICY "Anyone can view active packages"
ON article_packages FOR SELECT
USING (is_active = true);

-- 6. 註解
COMMENT ON TABLE article_packages IS '文章加購包定義：
- single: 單篇 NT$2,000
- pack_5: 5 篇 NT$7,500
- pack_10: 10 篇 NT$12,000
購買後永久有效，不會過期';

COMMENT ON COLUMN article_packages.articles IS '加購包含的文章篇數';
COMMENT ON COLUMN article_packages.price IS '價格（台幣）';
