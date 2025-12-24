"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  title: string;
  score: number;
  icon: React.ReactNode;
  description?: string;
}

/**
 * 分數卡片元件
 * 顯示 Lighthouse 各項分數，根據分數顯示不同顏色
 */
export function ScoreCard({ title, score, icon, description }: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getBackgroundColor = (score: number) => {
    if (score >= 90) return "bg-green-500/10 border-green-500/20";
    if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getRingColor = (score: number) => {
    if (score >= 90) return "stroke-green-500";
    if (score >= 50) return "stroke-yellow-500";
    return "stroke-red-500";
  };

  // 計算圓環進度
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className={cn("border", getBackgroundColor(score))}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* 圓環分數 */}
          <div className="relative h-20 w-20 flex-shrink-0">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 100 100">
              {/* 背景圓環 */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              {/* 進度圓環 */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-500",
                  getRingColor(score),
                )}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: offset,
                }}
              />
            </svg>
            {/* 分數數字 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-2xl font-bold", getScoreColor(score))}>
                {score}
              </span>
            </div>
          </div>

          {/* 標題和描述 */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{icon}</span>
              <span className="font-medium">{title}</span>
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
