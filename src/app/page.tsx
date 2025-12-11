import { createClient } from "@/lib/supabase/server";
import { HomeClient } from "./home-client";

/**
 * 篇數制方案資料類型
 * 註：在 migration 執行後需更新 database.types.ts
 */
interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
  features: unknown;
}

/**
 * 文章加購包資料類型
 */
interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

export default async function Home() {
  const supabase = await createClient();

  // 取得訂閱方案（篇數制，排除免費方案）
  const { data: plansRaw } = await supabase
    .from("subscription_plans")
    .select("*")
    .neq("slug", "free")
    .order("monthly_price", { ascending: true });

  // 類型斷言：新欄位在 migration 後才會被 database.types.ts 識別
  const plans = (plansRaw || []) as unknown as ArticlePlan[];

  // 取得文章加購包
  // 註：article_packages 表在 migration 後才會存在
  const { data: packagesRaw } = await (
    supabase.from("article_packages" as "companies") as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: boolean,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{ data: ArticlePackage[] | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  const articlePackages = packagesRaw || [];

  return <HomeClient plans={plans} articlePackages={articlePackages} />;
}
