/**
 * 共用的價格和方案相關類型定義
 */

export interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
  features: unknown;
}

export interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
}

export interface PricingProps {
  plans: ArticlePlan[];
  articlePackages: ArticlePackage[];
}
