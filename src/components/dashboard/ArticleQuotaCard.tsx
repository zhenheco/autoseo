"use client";

import { useEffect, useState } from "react";
import { FileText, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function ArticleQuotaCard() {
  const [quota, setQuota] = useState<ArticleQuota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuota();

    const handleQuotaChange = () => {
      fetchQuota();
    };

    window.addEventListener("articleGenerated", handleQuotaChange);
    window.addEventListener("articlesUpdated", handleQuotaChange);
    window.addEventListener("tokenReserved", handleQuotaChange);

    return () => {
      window.removeEventListener("articleGenerated", handleQuotaChange);
      window.removeEventListener("articlesUpdated", handleQuotaChange);
      window.removeEventListener("tokenReserved", handleQuotaChange);
    };
  }, []);

  const fetchQuota = async () => {
    try {
      const response = await fetch("/api/article-quota");
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (error) {
      console.error("Failed to fetch article quota:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="group bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6 animate-pulse">
        <div className="h-24"></div>
      </div>
    );
  }

  if (!quota) {
    return null;
  }

  const usagePercentage =
    quota.balance.monthlyQuota > 0
      ? ((quota.balance.monthlyQuota - quota.balance.subscriptionRemaining) /
          quota.balance.monthlyQuota) *
        100
      : 0;

  const isLowBalance = quota.balance.totalAvailable <= 1;
  const isCritical = quota.balance.totalAvailable === 0;
  const isFree = quota.plan?.slug === "free" || !quota.plan;

  return (
    <div
      className={cn(
        "group bg-card/50 backdrop-blur-sm rounded-xl border p-6 card-hover-lift hover:shadow-xl transition-all duration-300",
        isCritical
          ? "border-red-500/50 hover:border-red-500/70"
          : isLowBalance
            ? "border-orange-500/50 hover:border-orange-500/70"
            : "border-border/50 hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            文章額度
          </p>
          <p
            className={cn(
              "text-4xl font-bold transition-colors",
              isCritical
                ? "text-red-600"
                : isLowBalance
                  ? "text-orange-600"
                  : "text-foreground group-hover:text-primary",
            )}
          >
            {quota.balance.totalAvailable} 篇
          </p>
        </div>
        <div
          className={cn(
            "p-4 rounded-xl group-hover:scale-110 transition-transform",
            isCritical
              ? "bg-red-500/10"
              : isLowBalance
                ? "bg-orange-500/10"
                : "bg-primary/10",
          )}
        >
          <FileText
            className={cn(
              "h-7 w-7",
              isCritical
                ? "text-red-600"
                : isLowBalance
                  ? "text-orange-600"
                  : "text-primary",
            )}
          />
        </div>
      </div>

      {/* 詳細資訊 */}
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>本期剩餘</span>
          <span className="font-medium text-foreground">
            {quota.balance.subscriptionRemaining} / {quota.balance.monthlyQuota}{" "}
            篇
          </span>
        </div>
        {quota.balance.purchasedRemaining > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Gift className="h-3 w-3" />
              加購額度
            </span>
            <span className="font-medium text-purple-600">
              {quota.balance.purchasedRemaining} 篇
            </span>
          </div>
        )}
        {quota.balance.reserved > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>處理中</span>
            <span className="font-medium text-amber-600">
              {quota.balance.reserved} 篇
            </span>
          </div>
        )}
        {quota.subscription.periodEnd && (
          <div className="flex justify-between text-muted-foreground">
            <span>重置日期</span>
            <span className="font-medium text-foreground">
              {new Date(quota.subscription.periodEnd).toLocaleDateString(
                "zh-TW",
                {
                  month: "short",
                  day: "numeric",
                },
              )}
            </span>
          </div>
        )}
      </div>

      {/* 使用量進度條 */}
      {quota.balance.monthlyQuota > 0 && (
        <div className="mt-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                usagePercentage > 90
                  ? "bg-red-500"
                  : usagePercentage > 70
                    ? "bg-orange-500"
                    : "bg-primary",
              )}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground text-right">
            已使用 {Math.round(usagePercentage)}%
          </p>
        </div>
      )}

      {/* 警告提示 */}
      {isCritical && (
        <div className="mt-4 p-2 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-700 font-medium">
            文章額度已用完，請升級或購買加購包
          </p>
        </div>
      )}
    </div>
  );
}
