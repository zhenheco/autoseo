"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusConfig, getScheduledLabel } from "@/constants/status-config";

interface ArticleStatusBadgeProps {
  status: string;
  scheduledAt?: string | null;
}

/**
 * 文章狀態標籤元件
 * 使用統一狀態配置，避免重複定義
 */
export function ArticleStatusBadge({
  status,
  scheduledAt,
}: ArticleStatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.badgeIcon;

  // 排程狀態使用動態標籤
  const label =
    status === "scheduled" ? getScheduledLabel(scheduledAt) : config.label;

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1 ${config.badgeClassName}`}
    >
      <Icon className={`h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />
      <span className="text-xs">{label}</span>
    </Badge>
  );
}
