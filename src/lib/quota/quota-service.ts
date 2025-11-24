import { createClient } from "@/lib/supabase/server";

export interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  quota?: number;
  used?: number;
  remaining?: number;
}

export async function getCompanyQuotaStatus(
  companyId: string,
): Promise<QuotaStatus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_company_quota_status", {
    p_company_id: companyId,
  });

  if (error) {
    console.error("[Quota] 取得配額狀態失敗:", error);
    return null;
  }

  return data as QuotaStatus;
}

export async function checkAndIncrementQuota(
  companyId: string,
  increment: number = 1,
): Promise<QuotaCheckResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "check_and_increment_perplexity_quota",
    {
      p_company_id: companyId,
      p_increment: increment,
    },
  );

  if (error) {
    console.error("[Quota] 配額檢查失敗:", error);
    return {
      allowed: false,
      reason: "system_error",
      message: "系統錯誤，請稍後再試",
    };
  }

  return data as QuotaCheckResult;
}

export async function canUseCompetitorAnalysis(
  companyId: string,
): Promise<{ allowed: boolean; message?: string }> {
  const status = await getCompanyQuotaStatus(companyId);

  if (!status) {
    return { allowed: false, message: "無法取得配額狀態" };
  }

  if (!status.canUseCompetitors) {
    return {
      allowed: false,
      message: "您的方案不支援競爭對手分析，請升級至 STARTER 或更高方案",
    };
  }

  if (status.quota === -1) {
    return { allowed: true };
  }

  if (status.remaining <= 0) {
    return {
      allowed: false,
      message: `已達到每月配額上限（${status.quota} 次），請升級方案或等待下月重置`,
    };
  }

  return { allowed: true };
}
