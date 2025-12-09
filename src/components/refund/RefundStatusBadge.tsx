"use client";

type RefundStatus =
  | "pending"
  | "retention_accepted"
  | "auto_processing"
  | "pending_review"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

interface RefundStatusBadgeProps {
  status: RefundStatus;
}

const statusConfig: Record<RefundStatus, { label: string; className: string }> =
  {
    pending: { label: "待處理", className: "bg-yellow-100 text-yellow-800" },
    retention_accepted: {
      label: "已接受慰留",
      className: "bg-green-100 text-green-800",
    },
    auto_processing: {
      label: "自動處理中",
      className: "bg-blue-100 text-blue-800",
    },
    pending_review: {
      label: "待審核",
      className: "bg-orange-100 text-orange-800",
    },
    approved: { label: "已核准", className: "bg-green-100 text-green-800" },
    processing: { label: "處理中", className: "bg-purple-100 text-purple-800" },
    completed: { label: "已完成", className: "bg-green-200 text-green-900" },
    rejected: { label: "已拒絕", className: "bg-red-100 text-red-800" },
    failed: { label: "失敗", className: "bg-red-200 text-red-900" },
  };

export function RefundStatusBadge({ status }: RefundStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs ${config.className}`}>
      {config.label}
    </span>
  );
}
