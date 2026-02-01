"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";

interface ArticleQuota {
  balance: {
    subscriptionRemaining: number;
    purchasedRemaining: number;
    totalAvailable: number;
    monthlyQuota: number;
    reserved: number;
    available: number;
  };
  subscription: {
    billingCycle: "monthly" | "yearly" | null;
    periodEnd: string | null;
    periodStart: string | null;
  };
  plan: {
    name: string;
    slug: string;
    features: unknown;
  } | null;
}

interface ArticleQuotaDisplayProps {
  compact?: boolean;
}

// 自定義錯誤類別，包含 HTTP 狀態碼
class FetchError extends Error {
  status: number;
  errorCode: string;
  constructor(message: string, status: number, errorCode: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // 根據狀態碼提供錯誤碼，讓組件使用 i18n 翻譯
    if (res.status === 401) {
      throw new FetchError("Session expired", 401, "sessionExpired");
    }
    if (res.status === 404) {
      throw new FetchError("Company not found", 404, "companyNotFound");
    }
    throw new FetchError("Failed to fetch quota", res.status, "fetchFailed");
  }
  return res.json();
};

export function ArticleQuotaDisplay({
  compact = false,
}: ArticleQuotaDisplayProps) {
  const t = useTranslations("dashboard.quota");
  const tDashboard = useTranslations("dashboard");
  const router = useRouter();
  const {
    data: quota,
    error,
    isLoading,
    mutate,
  } = useSWR<ArticleQuota>("/api/article-quota", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });

  // 監聽文章生成相關事件，立即更新額度
  useEffect(() => {
    const handleQuotaUpdate = () => {
      mutate();
    };

    window.addEventListener("articleGenerated", handleQuotaUpdate);
    window.addEventListener("articlesUpdated", handleQuotaUpdate);
    window.addEventListener("tokenReserved", handleQuotaUpdate);

    return () => {
      window.removeEventListener("articleGenerated", handleQuotaUpdate);
      window.removeEventListener("articlesUpdated", handleQuotaUpdate);
      window.removeEventListener("tokenReserved", handleQuotaUpdate);
    };
  }, [mutate]);

  // 偵測 401 錯誤，自動導向登入頁面
  useEffect(() => {
    if (error && error instanceof FetchError && error.status === 401) {
      // 延遲一秒後導向登入頁，讓用戶看到錯誤訊息
      const timer = setTimeout(() => {
        router.push("/login?message=" + encodeURIComponent(t("sessionExpired")));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [error, router, t]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "rounded-lg border border-border bg-background px-3 py-2"}`}
      >
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-muted"></div>
          <div className="h-5 w-20 rounded bg-muted"></div>
        </div>
      </div>
    );
  }

  if (error || !quota) {
    const errorMessage = error instanceof FetchError
      ? t(error.errorCode as "sessionExpired" | "companyNotFound" | "fetchFailed")
      : t("fetchFailed");
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2"}`}
      >
        <p className="text-xs text-destructive">
          {errorMessage}
        </p>
      </div>
    );
  }

  const isLowQuota = quota.balance.available <= 1;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t("label")}</span>
        <span
          className={`text-sm font-semibold ${isLowQuota ? "text-destructive" : "text-foreground"}`}
        >
          {quota.balance.available} {tDashboard("articles")}
        </span>
        <a
          href="/dashboard/subscription"
          className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("upgrade")}
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          {t("availableLabel")}
        </span>
        <span
          className={`text-lg font-bold transition-all duration-500 ease-in-out ${isLowQuota ? "text-destructive" : "text-foreground"}`}
          key={quota.balance.available}
        >
          <span className="inline-block transition-transform duration-500 ease-out hover:scale-110">
            {quota.balance.available} {tDashboard("articles")}
          </span>
        </span>
      </div>

      {quota.balance.reserved > 0 && (
        <div className="flex items-center gap-3 border-l border-border pl-3 text-xs text-muted-foreground">
          <span className="transition-all duration-300 ease-in-out">
            {tDashboard("processing")}:{" "}
            <span className="font-medium text-amber-600 transition-colors duration-300">
              {quota.balance.reserved} {tDashboard("articles")}
            </span>
          </span>
        </div>
      )}

      {quota.balance.purchasedRemaining > 0 && (
        <div className="flex items-center gap-3 border-l border-border pl-3 text-xs text-muted-foreground">
          <span>
            {t("purchase")}:{" "}
            <span className="font-medium text-purple-600">
              {quota.balance.purchasedRemaining} {tDashboard("articles")}
            </span>
          </span>
        </div>
      )}

      {isLowQuota && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {t("lowQuota")}
          </span>
          <a
            href="/dashboard/subscription"
            className="text-xs font-medium text-destructive underline hover:text-destructive/80"
          >
            {t("upgradeNow")}
          </a>
        </div>
      )}
    </div>
  );
}
