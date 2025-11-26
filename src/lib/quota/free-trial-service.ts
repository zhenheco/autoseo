import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface FreeTrialStatus {
  canGenerate: boolean;
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

export class FreeTrialService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase;
  }

  async checkFreeTrialLimit(companyId: string): Promise<FreeTrialStatus> {
    const { data: company } = await this.supabase
      .from("companies")
      .select("subscription_tier")
      .eq("id", companyId)
      .single();

    if (!company || company.subscription_tier !== "free") {
      return {
        canGenerate: true,
        used: 0,
        limit: -1,
        remaining: -1,
        isUnlimited: true,
      };
    }

    const { data: subscription } = await this.supabase
      .from("company_subscriptions")
      .select("lifetime_free_articles_used, lifetime_free_articles_limit")
      .eq("company_id", companyId)
      .single();

    if (!subscription) {
      return {
        canGenerate: true,
        used: 0,
        limit: 3,
        remaining: 3,
        isUnlimited: false,
      };
    }

    const used = subscription.lifetime_free_articles_used ?? 0;
    const limit = subscription.lifetime_free_articles_limit ?? 3;

    if (limit === -1) {
      return {
        canGenerate: true,
        used,
        limit: -1,
        remaining: -1,
        isUnlimited: true,
      };
    }

    const remaining = Math.max(0, limit - used);

    return {
      canGenerate: remaining > 0,
      used,
      limit,
      remaining,
      isUnlimited: false,
    };
  }

  async incrementFreeTrialUsage(
    companyId: string,
    articleJobId: string,
  ): Promise<boolean> {
    const { data: job } = await this.supabase
      .from("article_jobs")
      .select("free_quota_deducted")
      .eq("id", articleJobId)
      .single();

    if (job?.free_quota_deducted) {
      console.log(
        `[FreeTrialService] Job ${articleJobId} already deducted, skipping`,
      );
      return false;
    }

    const { data: subscription } = await this.supabase
      .from("company_subscriptions")
      .select("id, lifetime_free_articles_used")
      .eq("company_id", companyId)
      .single();

    if (!subscription) {
      console.error(
        `[FreeTrialService] No subscription found for company ${companyId}`,
      );
      return false;
    }

    const newUsed = (subscription.lifetime_free_articles_used ?? 0) + 1;

    const { error: updateError } = await this.supabase
      .from("company_subscriptions")
      .update({ lifetime_free_articles_used: newUsed })
      .eq("id", subscription.id);

    if (updateError) {
      console.error(
        "[FreeTrialService] Failed to increment usage:",
        updateError,
      );
      return false;
    }

    const { error: markError } = await this.supabase
      .from("article_jobs")
      .update({ free_quota_deducted: true })
      .eq("id", articleJobId);

    if (markError) {
      console.error(
        "[FreeTrialService] Failed to mark job as deducted:",
        markError,
      );
    }

    console.log(
      `[FreeTrialService] Incremented free trial usage for company ${companyId}: ${newUsed}`,
    );
    return true;
  }
}

export async function checkFreeTrialLimit(
  supabase: ReturnType<typeof createClient<Database>>,
  companyId: string,
): Promise<FreeTrialStatus> {
  const service = new FreeTrialService(supabase);
  return service.checkFreeTrialLimit(companyId);
}

export async function incrementFreeTrialUsage(
  supabase: ReturnType<typeof createClient<Database>>,
  companyId: string,
  articleJobId: string,
): Promise<boolean> {
  const service = new FreeTrialService(supabase);
  return service.incrementFreeTrialUsage(companyId, articleJobId);
}
