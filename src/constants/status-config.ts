/**
 * 文章狀態統一配置
 * 集中管理所有狀態的顯示配置，避免多個元件重複定義
 */

import {
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Loader2,
  Circle,
  type LucideIcon,
} from "lucide-react";

// 狀態類型定義
export type ArticleStatus =
  | "pending"
  | "processing"
  | "completed"
  | "generated"
  | "reviewed"
  | "scheduled"
  | "published"
  | "failed";

// Badge variant 類型
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// 狀態配置介面
export interface StatusConfig {
  /** 狀態標籤（中文） */
  label: string;
  /** Badge 元件的 icon */
  badgeIcon: LucideIcon;
  /** Icon 元件的 icon */
  statusIcon: LucideIcon;
  /** Badge 變體 */
  variant: BadgeVariant;
  /** Badge 自訂樣式 */
  badgeClassName: string;
  /** Icon 樣式 */
  iconClassName: string;
  /** Icon 是否需要動畫 */
  animate?: boolean;
}

/**
 * 文章狀態配置表
 * 所有狀態相關元件共用此配置
 */
export const ARTICLE_STATUS_CONFIG: Record<
  ArticleStatus | string,
  StatusConfig
> = {
  pending: {
    label: "生成中",
    badgeIcon: Loader2,
    statusIcon: Loader2,
    variant: "secondary",
    badgeClassName: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    iconClassName: "text-yellow-600 dark:text-yellow-400",
    animate: true,
  },
  processing: {
    label: "處理中",
    badgeIcon: Loader2,
    statusIcon: Loader2,
    variant: "secondary",
    badgeClassName: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    iconClassName: "text-yellow-600 dark:text-yellow-400",
    animate: true,
  },
  completed: {
    label: "已完成",
    badgeIcon: CheckCircle2,
    statusIcon: Check,
    variant: "default",
    badgeClassName: "bg-green-100 text-green-800 hover:bg-green-100",
    iconClassName: "text-green-600 dark:text-green-400",
  },
  generated: {
    label: "已完成",
    badgeIcon: CheckCircle2,
    statusIcon: Check,
    variant: "default",
    badgeClassName: "bg-green-100 text-green-800 hover:bg-green-100",
    iconClassName: "text-green-600 dark:text-green-400",
  },
  reviewed: {
    label: "已完成",
    badgeIcon: CheckCircle2,
    statusIcon: Check,
    variant: "default",
    badgeClassName: "bg-green-100 text-green-800 hover:bg-green-100",
    iconClassName: "text-green-600 dark:text-green-400",
  },
  scheduled: {
    label: "已排程",
    badgeIcon: Calendar,
    statusIcon: Calendar,
    variant: "secondary",
    badgeClassName: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
  published: {
    label: "已發佈",
    badgeIcon: Circle,
    statusIcon: Circle,
    variant: "default",
    badgeClassName: "bg-red-100 text-red-800 hover:bg-red-100",
    iconClassName: "text-red-600 dark:text-red-400 fill-current",
  },
  failed: {
    label: "失敗",
    badgeIcon: XCircle,
    statusIcon: XCircle,
    variant: "destructive",
    badgeClassName: "",
    iconClassName: "text-red-600 dark:text-red-400",
  },
};

// 預設配置（未知狀態）
const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: "",
  badgeIcon: Clock,
  statusIcon: Clock,
  variant: "outline",
  badgeClassName: "",
  iconClassName: "text-gray-600 dark:text-gray-400",
};

/**
 * 取得狀態配置
 * @param status 狀態字串
 * @returns 狀態配置
 */
export function getStatusConfig(status: string): StatusConfig {
  return (
    ARTICLE_STATUS_CONFIG[status] || {
      ...DEFAULT_STATUS_CONFIG,
      label: status,
    }
  );
}

/**
 * 格式化排程時間
 * @param scheduledAt 排程時間字串
 * @returns 格式化後的時間字串
 */
export function formatScheduledTime(
  scheduledAt: string | null | undefined,
): string {
  if (!scheduledAt) return "";
  return new Date(scheduledAt).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 取得排程狀態的標籤
 * @param scheduledAt 排程時間
 * @returns 標籤文字
 */
export function getScheduledLabel(
  scheduledAt: string | null | undefined,
): string {
  if (!scheduledAt) return "已排程";
  return `排程: ${formatScheduledTime(scheduledAt)}`;
}

/**
 * 取得發佈狀態的標籤
 * @param websiteName 網站名稱
 * @param wordpressStatus WordPress 狀態
 * @returns 標籤文字
 */
export function getPublishedLabel(
  websiteName?: string | null,
  wordpressStatus?: string | null,
): string {
  if (!websiteName) return "已發佈";
  const draftSuffix = wordpressStatus === "publish" ? "" : " (草稿)";
  return `已發佈到 ${websiteName}${draftSuffix}`;
}
