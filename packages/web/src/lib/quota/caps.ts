export interface QuotaCaps {
  articles: number; // per month
  cards: number; // per month
  social_posts: number; // per month
  brands: number; // absolute
  websites: number; // absolute per brand
  audits: number; // per month
}

export const PLAN_CAPS: Record<"solo" | "pro", QuotaCaps> = {
  solo: {
    articles: 30,
    cards: 100,
    social_posts: 100,
    brands: 1,
    websites: 1,
    audits: 10,
  },
  pro: {
    articles: 200,
    cards: 500,
    social_posts: 1000,
    brands: 5,
    websites: 3,
    audits: 100,
  },
};

export const MONTHLY_RESOURCES = [
  "articles",
  "cards",
  "social_posts",
  "audits",
] as const;

export const ABSOLUTE_RESOURCES = ["brands", "websites"] as const;
