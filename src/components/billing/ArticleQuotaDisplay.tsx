"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { FileText } from "lucide-react";

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("無法取得文章額度");
  }
  return res.json();
};

export function ArticleQuotaDisplay({
  compact = false,
}: ArticleQuotaDisplayProps) {
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
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2"}`}
      >
        <p className="text-xs text-destructive">
          {error?.message || "無法載入額度"}
        </p>
      </div>
    );
  }

  const isLowQuota = quota.balance.available <= 1;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">額度:</span>
        <span
          className={`text-sm font-semibold ${isLowQuota ? "text-destructive" : "text-foreground"}`}
        >
          {quota.balance.available} 篇
        </span>
        <a
          href="/dashboard/subscription"
          className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          升級
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          可用額度:
        </span>
        <span
          className={`text-lg font-bold transition-all duration-500 ease-in-out ${isLowQuota ? "text-destructive" : "text-foreground"}`}
          key={quota.balance.available}
        >
          <span className="inline-block transition-transform duration-500 ease-out hover:scale-110">
            {quota.balance.available} 篇
          </span>
        </span>
      </div>

      {quota.balance.reserved > 0 && (
        <div className="flex items-center gap-3 border-l border-border pl-3 text-xs text-muted-foreground">
          <span className="transition-all duration-300 ease-in-out">
            處理中:{" "}
            <span className="font-medium text-amber-600 transition-colors duration-300">
              {quota.balance.reserved} 篇
            </span>
          </span>
        </div>
      )}

      {quota.balance.purchasedRemaining > 0 && (
        <div className="flex items-center gap-3 border-l border-border pl-3 text-xs text-muted-foreground">
          <span>
            加購:{" "}
            <span className="font-medium text-purple-600">
              {quota.balance.purchasedRemaining} 篇
            </span>
          </span>
        </div>
      )}

      {isLowQuota && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            額度不足
          </span>
          <a
            href="/dashboard/subscription"
            className="text-xs font-medium text-destructive underline hover:text-destructive/80"
          >
            立即升級
          </a>
        </div>
      )}
    </div>
  );
}
