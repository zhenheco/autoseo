"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type {
  Recommendation,
  RecommendationPriority,
  RecommendationCategory,
} from "@/types/health-check";
import {
  Zap,
  Search,
  Accessibility,
  Shield,
  AlertTriangle,
  ArrowUp,
  ArrowRight,
} from "lucide-react";

interface RecommendationsListProps {
  recommendations: Recommendation[];
}

const PRIORITY_CONFIG: Record<
  RecommendationPriority,
  { label: string; color: string; icon: React.ReactNode }
> = {
  high: {
    label: "高優先",
    color: "bg-red-500/10 text-red-600 border-red-500/30",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  medium: {
    label: "中優先",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    icon: <ArrowUp className="h-4 w-4" />,
  },
  low: {
    label: "低優先",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    icon: <ArrowRight className="h-4 w-4" />,
  },
};

const CATEGORY_CONFIG: Record<
  RecommendationCategory,
  { label: string; icon: React.ReactNode }
> = {
  performance: { label: "效能", icon: <Zap className="h-4 w-4" /> },
  seo: { label: "SEO", icon: <Search className="h-4 w-4" /> },
  accessibility: {
    label: "無障礙",
    icon: <Accessibility className="h-4 w-4" />,
  },
  "best-practices": { label: "最佳實踐", icon: <Shield className="h-4 w-4" /> },
};

/**
 * AI 改善建議列表元件
 */
export function RecommendationsList({
  recommendations,
}: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI 改善建議</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>恭喜！目前沒有重大問題需要改善。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 按優先級排序
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const highCount = recommendations.filter((r) => r.priority === "high").length;
  const mediumCount = recommendations.filter(
    (r) => r.priority === "medium",
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI 改善建議</CardTitle>
          <div className="flex gap-2">
            {highCount > 0 && (
              <Badge variant="outline" className={PRIORITY_CONFIG.high.color}>
                {highCount} 高優先
              </Badge>
            )}
            {mediumCount > 0 && (
              <Badge variant="outline" className={PRIORITY_CONFIG.medium.color}>
                {mediumCount} 中優先
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {sortedRecommendations.map((rec, index) => {
            const priorityConfig = PRIORITY_CONFIG[rec.priority];
            const categoryConfig = CATEGORY_CONFIG[rec.category];

            return (
              <AccordionItem
                key={rec.id || index}
                value={rec.id || String(index)}
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div className={cn("p-1.5 rounded", priorityConfig.color)}>
                      {priorityConfig.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{rec.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {categoryConfig.icon}
                          <span className="ml-1">{categoryConfig.label}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-10 space-y-4">
                    {/* 描述 */}
                    <p className="text-sm text-muted-foreground">
                      {rec.description}
                    </p>

                    {/* 影響和努力程度 */}
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          預期影響:
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {rec.impact}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          實施難度:
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {rec.effort}
                        </Badge>
                      </div>
                    </div>

                    {/* 具體步驟 */}
                    {rec.steps && rec.steps.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">建議步驟:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {rec.steps.map((step, stepIdx) => (
                            <li
                              key={stepIdx}
                              className="text-sm text-muted-foreground"
                            >
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
