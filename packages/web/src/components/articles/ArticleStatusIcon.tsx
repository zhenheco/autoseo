"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getStatusConfig,
  getScheduledLabel,
  getPublishedLabel,
} from "@/constants/status-config";

interface ArticleStatusIconProps {
  status: string;
  scheduledAt?: string | null;
  wordpressStatus?: string | null;
  publishedToWebsiteName?: string | null;
  wordpressUrl?: string | null;
}

/**
 * 文章狀態圖示元件
 * 使用統一狀態配置，避免重複定義
 */
export function ArticleStatusIcon({
  status,
  scheduledAt,
  wordpressStatus,
  publishedToWebsiteName,
}: ArticleStatusIconProps) {
  const config = getStatusConfig(status);
  const Icon = config.statusIcon;

  // 根據狀態決定標籤
  const getLabel = (): string => {
    switch (status) {
      case "scheduled":
        return getScheduledLabel(scheduledAt);
      case "published":
        return getPublishedLabel(publishedToWebsiteName, wordpressStatus);
      default:
        return config.label;
    }
  };

  const label = getLabel();
  const iconClassName = `h-4 w-4 ${config.iconClassName} ${config.animate ? "animate-spin" : ""}`;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            role="img"
            aria-label={label}
            tabIndex={0}
            className="inline-flex items-center justify-center cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.currentTarget.click();
              }
            }}
          >
            <Icon className={iconClassName} />
          </div>
        </TooltipTrigger>
        <TooltipContent role="tooltip">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
