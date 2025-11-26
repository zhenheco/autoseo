"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Sparkles, AlertTriangle } from "lucide-react";

interface FreeTrialBannerProps {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

export function FreeTrialBanner({
  used,
  limit,
  remaining,
  isUnlimited,
}: FreeTrialBannerProps) {
  if (isUnlimited) return null;

  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isNearLimit = remaining <= 1 && remaining > 0;
  const isAtLimit = remaining === 0;

  if (isAtLimit) {
    return (
      <Alert className="mb-6 border-destructive text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>免費試用已達上限</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            您已使用完 {limit}{" "}
            篇免費文章配額。升級到付費方案即可繼續生成更多文章。
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard/subscription">立即升級</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={isNearLimit ? "border-orange-500" : ""}>
      <Sparkles className="h-4 w-4" />
      <AlertTitle>免費試用配額</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">
            已使用 {used} / {limit} 篇
          </span>
          <span
            className={`text-sm font-medium ${isNearLimit ? "text-orange-600" : ""}`}
          >
            剩餘 {remaining} 篇
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
        {isNearLimit && (
          <p className="text-sm text-orange-600 mt-2">
            即將達到免費上限！
            <Link
              href="/dashboard/subscription"
              className="underline ml-1 font-medium"
            >
              升級方案
            </Link>
            獲得無限文章生成。
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
