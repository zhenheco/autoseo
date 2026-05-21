import type { ReactNode } from "react";
import { Badge, type BadgeProps } from "./badge";
import { cn } from "@/lib/utils";

export type StatusBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface StatusBadgeProps
  extends Omit<BadgeProps, "children" | "variant"> {
  status: string;
  label?: ReactNode;
  tone?: StatusBadgeTone;
  icon?: ReactNode;
}

const toneClassNames: Record<StatusBadgeTone, string> = {
  success:
    "border-success-200 bg-success-50 text-success-800 hover:bg-success-100",
  warning:
    "border-warning-200 bg-warning-50 text-warning-800 hover:bg-warning-100",
  danger:
    "border-destructive-200 bg-destructive-50 text-destructive-800 hover:bg-destructive-100",
  info: "border-info-200 bg-info-50 text-info-800 hover:bg-info-100",
  neutral: "border-border-subtle bg-muted text-muted-foreground",
};

const statusTones: Record<string, StatusBadgeTone> = {
  active: "success",
  approved: "success",
  completed: "success",
  default: "success",
  published: "success",
  reserved: "success",
  success: "success",
  valid: "success",
  auto_processing: "info",
  info: "info",
  processing: "info",
  queued: "info",
  triggered: "info",
  warning: "warning",
  pending: "warning",
  pending_review: "warning",
  "pending-review": "warning",
  past_due: "warning",
  cancelled: "neutral",
  inactive: "neutral",
  manual: "neutral",
  skipped: "neutral",
  cancelled_by_user: "neutral",
  destructive: "danger",
  error: "danger",
  failed: "danger",
  rejected: "danger",
};

export function statusBadgeTone(status: string): StatusBadgeTone {
  return statusTones[status] ?? "neutral";
}

export function StatusBadge({
  status,
  label,
  tone,
  icon,
  className,
  ...props
}: StatusBadgeProps) {
  const resolvedTone = tone ?? statusBadgeTone(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent text-xs",
        toneClassNames[resolvedTone],
        className,
      )}
      {...props}
    >
      {icon}
      {label ?? status}
    </Badge>
  );
}
