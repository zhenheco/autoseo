"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { formatNumber } from "@/lib/utils";

interface TokenBalance {
  total: number;
  reserved: number;
  available: number;
}

interface TokenBalanceDisplayProps {
  compact?: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("無法取得 token 餘額");
  }
  return res.json();
};

export function TokenBalanceDisplay({
  compact = false,
}: TokenBalanceDisplayProps) {
  const {
    data: balance,
    error,
    isLoading,
    mutate,
  } = useSWR<TokenBalance>("/api/billing/balance", fetcher, {
    refreshInterval: 10000, // 降低輪詢頻率
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000, // 防止重複請求
  });

  // 監聽文章生成相關事件，立即更新餘額
  useEffect(() => {
    const handleBalanceUpdate = () => {
      mutate();
    };

    window.addEventListener("articleGenerated", handleBalanceUpdate);
    window.addEventListener("articlesUpdated", handleBalanceUpdate);
    window.addEventListener("tokenReserved", handleBalanceUpdate);

    return () => {
      window.removeEventListener("articleGenerated", handleBalanceUpdate);
      window.removeEventListener("articlesUpdated", handleBalanceUpdate);
      window.removeEventListener("tokenReserved", handleBalanceUpdate);
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

  if (error || !balance) {
    return (
      <div
        className={`flex items-center gap-2 ${compact ? "" : "rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2"}`}
      >
        <p className="text-xs text-destructive">
          {error?.message || "無法載入餘額"}
        </p>
      </div>
    );
  }

  const isLowBalance = balance.available < 1000;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Credits:</span>
        <span
          className={`text-sm font-semibold ${isLowBalance ? "text-destructive" : "text-foreground"}`}
        >
          {formatNumber(balance.available)}
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
        <span className="text-sm font-medium text-muted-foreground">
          可用餘額:
        </span>
        <span
          className={`text-lg font-bold transition-all duration-500 ease-in-out ${isLowBalance ? "text-destructive" : "text-foreground"}`}
          key={balance.available}
        >
          <span className="inline-block transition-transform duration-500 ease-out hover:scale-110">
            {formatNumber(balance.available)}
          </span>
        </span>
      </div>

      {balance.reserved > 0 && (
        <div className="flex items-center gap-3 border-l border-border pl-3 text-xs text-muted-foreground">
          <span className="transition-all duration-300 ease-in-out">
            處理中:{" "}
            <span className="font-medium text-amber-600 transition-colors duration-300">
              {formatNumber(balance.reserved)}
            </span>
          </span>
        </div>
      )}

      {isLowBalance && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            餘額不足
          </span>
          <a
            href="/dashboard/billing/upgrade"
            className="text-xs font-medium text-destructive underline hover:text-destructive/80"
          >
            立即升級
          </a>
        </div>
      )}
    </div>
  );
}
