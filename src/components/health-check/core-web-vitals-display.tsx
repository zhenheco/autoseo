"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CoreWebVitals, VitalRating } from "@/types/health-check";
import { HelpCircle } from "lucide-react";

interface CoreWebVitalsDisplayProps {
  vitals: CoreWebVitals;
}

/** 指標說明 */
const VITAL_INFO = {
  lcp: {
    name: "LCP",
    fullName: "Largest Contentful Paint",
    description: "最大內容繪製時間，衡量載入效能",
    thresholds: "良好: ≤2.5s | 需改進: ≤4s | 差: >4s",
  },
  inp: {
    name: "INP",
    fullName: "Interaction to Next Paint",
    description: "互動到下一次繪製時間，衡量互動回應速度",
    thresholds: "良好: ≤200ms | 需改進: ≤500ms | 差: >500ms",
  },
  cls: {
    name: "CLS",
    fullName: "Cumulative Layout Shift",
    description: "累積版面配置位移，衡量視覺穩定性",
    thresholds: "良好: ≤0.1 | 需改進: ≤0.25 | 差: >0.25",
  },
  fcp: {
    name: "FCP",
    fullName: "First Contentful Paint",
    description: "首次內容繪製時間，衡量感知載入速度",
    thresholds: "良好: ≤1.8s | 需改進: ≤3s | 差: >3s",
  },
  ttfb: {
    name: "TTFB",
    fullName: "Time to First Byte",
    description: "首位元組時間，衡量伺服器回應速度",
    thresholds: "良好: ≤800ms | 需改進: ≤1.8s | 差: >1.8s",
  },
};

/**
 * Core Web Vitals 顯示元件
 */
export function CoreWebVitalsDisplay({ vitals }: CoreWebVitalsDisplayProps) {
  const getRatingColor = (rating: VitalRating): string => {
    switch (rating) {
      case "good":
        return "bg-green-500/10 text-green-600 border-green-500/30";
      case "needs-improvement":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
      case "poor":
        return "bg-red-500/10 text-red-600 border-red-500/30";
    }
  };

  const getRatingLabel = (rating: VitalRating): string => {
    switch (rating) {
      case "good":
        return "良好";
      case "needs-improvement":
        return "需改進";
      case "poor":
        return "差";
    }
  };

  const formatValue = (key: keyof CoreWebVitals, value: number): string => {
    switch (key) {
      case "lcp":
      case "fcp":
        return `${(value / 1000).toFixed(1)} 秒`;
      case "inp":
      case "ttfb":
        return `${Math.round(value)} ms`;
      case "cls":
        return value.toFixed(3);
      default:
        return String(value);
    }
  };

  const vitalEntries = Object.entries(vitals) as Array<
    [keyof CoreWebVitals, CoreWebVitals[keyof CoreWebVitals]]
  >;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Core Web Vitals
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Core Web Vitals 是 Google 用來評估網頁使用者體驗的關鍵指標，
                  會影響搜尋排名。
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vitalEntries.map(([key, vital]) => {
            const info = VITAL_INFO[key];
            return (
              <div
                key={key}
                className={cn(
                  "rounded-lg border p-4",
                  getRatingColor(vital.rating),
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <span className="text-sm font-medium">
                            {info.name}
                          </span>
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-medium">{info.fullName}</p>
                          <p className="mt-1 text-sm">{info.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {info.thresholds}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <p className="mt-1 text-2xl font-bold">
                      {formatValue(key, vital.value)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getRatingColor(vital.rating))}
                  >
                    {getRatingLabel(vital.rating)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
