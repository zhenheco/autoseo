"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MetaAnalysisResult } from "@/types/health-check";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface MetaAnalysisDisplayProps {
  analysis: MetaAnalysisResult;
}

/**
 * Meta 標籤分析顯示元件
 */
export function MetaAnalysisDisplay({ analysis }: MetaAnalysisDisplayProps) {
  const metaItems = [
    { key: "title", label: "標題 (Title)", data: analysis.title },
    {
      key: "description",
      label: "描述 (Meta Description)",
      data: analysis.description,
    },
    { key: "ogTitle", label: "OG Title", data: analysis.ogTitle },
    {
      key: "ogDescription",
      label: "OG Description",
      data: analysis.ogDescription,
    },
    { key: "ogImage", label: "OG Image", data: analysis.ogImage },
    { key: "canonical", label: "Canonical URL", data: analysis.canonical },
    { key: "robots", label: "Robots", data: analysis.robots },
    { key: "viewport", label: "Viewport", data: analysis.viewport },
  ];

  const getStatusIcon = (exists: boolean, issueCount: number) => {
    if (!exists) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (issueCount > 0) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusBadge = (exists: boolean, issueCount: number) => {
    if (!exists) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600">
          缺少
        </Badge>
      );
    }
    if (issueCount > 0) {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
          需改進
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600">
        良好
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Meta 標籤分析</CardTitle>
          {analysis.totalIssues > 0 && (
            <Badge
              variant="outline"
              className="bg-yellow-500/10 text-yellow-600"
            >
              {analysis.totalIssues} 個問題
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metaItems.map(({ key, label, data }) => (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-4",
                !data.exists && "bg-red-500/5",
                data.exists && data.issues.length > 0 && "bg-yellow-500/5",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(data.exists, data.issues.length)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{label}</span>
                      {getStatusBadge(data.exists, data.issues.length)}
                      {data.length !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          ({data.length} 字元)
                        </span>
                      )}
                    </div>

                    {/* 內容預覽 */}
                    {data.content && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {data.content}
                      </p>
                    )}

                    {/* URL 顯示 */}
                    {data.url && (
                      <p className="mt-2 text-sm text-muted-foreground truncate">
                        {data.url}
                      </p>
                    )}

                    {/* 問題列表 */}
                    {data.issues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {data.issues.map((issue, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-yellow-600 dark:text-yellow-500"
                          >
                            • {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
